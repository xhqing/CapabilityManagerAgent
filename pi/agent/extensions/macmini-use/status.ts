/**
 * macmini 使用状态指示器（2026-11-04 用户立）。
 *
 * 需求原话：「触发 macmini-use 并使用 macmini 的时候，需要在 pi-tui 输入框下方显示
 * 当前使用的是 macmini，使用完之后需要撤销掉这个状态」。
 *
 * 为什么值得有：macmini 的活是在另一台机器上跑的，本机这边只有一个工具调用结果——用户在
 * 界面上看不到「现在有东西正在那台机器上跑」，容易误以为本机空闲、随手关机或断网。给一行
 * 常驻提示，用完即撤，是为了让「这台机器此刻在借 macmini 的算力」变成一眼可见的事实。
 *
 * ## 显示位置
 *
 * `ctx.ui.setWidget(key, [text], { placement: "belowEditor" })`——belowEditor 就是编辑器
 * （输入框）正下方那一行，与用户说的位置一致；用法结束传 `undefined` 清除。没用 footer 状态行
 * （`ui.setStatus`）是因为那是终端最底部的一行、和用户说的「输入框下方」不是同一个位置。
 * 用纯字符串数组而不是自定义组件，是为了不额外依赖 `pi-tui` 的运行时导入（少一个失败点）。
 *
 * ## 什么算「正在使用 macmini」
 *
 *   1. **前台调用**：`macmini_run` / `macmini_status` / `/macmini ...` 执行期间，以及
 *      `ssh mac-mini ...` 这类直接用 bash 打远端的命令（由 index.ts 在 tool_call 里登记）；
 *   2. **后台任务**：`macmini_run` 用 background:true 起的远端任务——工具调用早已返回，
 *      但进程还在 macmini 上跑，所以每 20 秒用 `pgrep -f <脚本路径>` 探一次，全都跑完就撤。
 *
 * 计数归零（没有前台调用、没有活着的后台任务）就撤掉指示器，不留残影。
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execRemote, shq } from "./remote.ts";

/** widget 的 key（多扩展共用 widget 区，各自占自己的 key）。 */
const WIDGET_KEY = "macmini-use";

/** 指示器文案（计数 > 1 时补任务数，好让用户知道不止一件事在跑）。 */
const LABEL = "🖥  当前使用的是 macmini（算力机）";
const labelWith = (n: number) => `🖥  当前使用的是 macmini（算力机 · ${n} 个任务）`;

/** 前台登记的超期时限：tool_result 因故没回来时，别让指示器永久挂着（30 分钟）。 */
const INFLIGHT_TTL_MS = 30 * 60_000;
/** 后台任务跟踪的超期时限：再久也不追了（6 小时），防远端失联时永久挂着。 */
const JOB_TTL_MS = 6 * 60 * 60_000;
/** 后台任务存活探测间隔。 */
const JOB_POLL_MS = 20_000;

export interface RemoteJob {
	/** 任务 id（launchRemote 返回的 jobId，仅用于去重与日志）。 */
	id: string;
	/** 远端脚本路径（/tmp/macmini-jobs/job-xxx.sh）——存活探测就按它 pgrep。 */
	scriptPath: string;
}

export interface MacminiIndicator {
	/** 记录最新一次 ctx（每次拿到新的 ctx 都调一下，指示器才能画出来）。 */
	attach(ctx: ExtensionContext): void;
	/** 前台调用开始（id 用 toolCallId 或自造的唯一串）。 */
	begin(id: string): void;
	/** 前台调用结束。 */
	end(id: string): void;
	/** 登记一个远端后台任务（已经在 macmini 上跑起来的那种）。 */
	trackJob(job: RemoteJob): void;
	/** 清空全部登记并撤掉指示器（会话开始 / 结束、扩展卸载时用）。 */
	reset(ctx?: ExtensionContext): void;
	/** 停掉轮询定时器（扩展卸载时用）。 */
	dispose(): void;
}

export function createIndicator(): MacminiIndicator {
	/** 最新 ctx：widget 只能通过某个 ctx 的 ui 来设置。 */
	let latestCtx: ExtensionContext | undefined;
	/** 进行中的前台调用（id → 开始时间）。 */
	const inflight = new Map<string, number>();
	/** 还在 macmini 上跑的后台任务（jobId → 任务信息 + 登记时间）。 */
	const jobs = new Map<string, RemoteJob & { since: number }>();

	/** 按「前台计数 + 后台任务数」重画（0 就撤掉；任何异常都不抛）。 */
	const render = (): void => {
		const now = Date.now();
		// 兜底清理：tool_result 丢失的前台登记、失联太久的后台任务
		for (const [id, startedAt] of inflight) {
			if (now - startedAt > INFLIGHT_TTL_MS) inflight.delete(id);
		}
		for (const [id, job] of jobs) {
			if (now - job.since > JOB_TTL_MS) jobs.delete(id);
		}
		if (!latestCtx) return;
		const total = inflight.size + jobs.size;
		const content = total === 0 ? undefined : total === 1 ? [LABEL] : [labelWith(total)];
		try {
			latestCtx.ui.setWidget(WIDGET_KEY, content, { placement: "belowEditor" });
		} catch {
			// 非交互模式（print / json）里没有 widget 区：静默放行，不影响执行
		}
	};

	/**
	 * 探测后台任务是否还活着：一次 ssh 问所有登记过的脚本路径，返回 DONE 的销号。
	 * 连不上 macmini 时不动登记（网络抖一下不代表任务没了），交给 JOB_TTL_MS 兜底。
	 */
	let polling = false;
	const pollJobs = async (): Promise<void> => {
		if (polling || jobs.size === 0) return;
		polling = true;
		try {
			const lines = [...jobs.values()].map(
				(job) =>
					`if pgrep -f ${shq(job.scriptPath)} >/dev/null 2>&1; then echo "RUNNING ${job.scriptPath}"; else echo "DONE ${job.scriptPath}"; fi`,
			);
			const res = await execRemote(lines.join("\n"), { timeoutMs: 20_000 });
			if (res.code !== 0) return;
			const done = new Set([...res.stdout.matchAll(/^DONE (.+)$/gm)].map((m) => m[1]?.trim() ?? ""));
			if (done.size === 0) return;
			for (const [id, job] of jobs) {
				if (done.has(job.scriptPath)) jobs.delete(id);
			}
			render();
		} catch {
			// 探测失败不影响会话
		} finally {
			polling = false;
		}
	};

	const timer = setInterval(() => {
		void pollJobs();
	}, JOB_POLL_MS);
	(timer as { unref?: () => void }).unref?.();

	return {
		attach(ctx: ExtensionContext) {
			if (!ctx) return;
			const unchanged = latestCtx === ctx;
			latestCtx = ctx;
			if (!unchanged) render();
		},
		begin(id: string) {
			inflight.set(id || `anon-${Date.now()}`, Date.now());
			render();
		},
		end(id: string) {
			if (inflight.delete(id)) render();
		},
		trackJob(job: RemoteJob) {
			if (!job?.scriptPath) return;
			jobs.set(job.id || job.scriptPath, { ...job, since: Date.now() });
			render();
		},
		reset(ctx?: ExtensionContext) {
			inflight.clear();
			jobs.clear();
			if (ctx) latestCtx = ctx;
			render();
		},
		dispose() {
			clearInterval(timer);
			inflight.clear();
			jobs.clear();
			render();
		},
	};
}
