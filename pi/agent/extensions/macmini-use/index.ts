/**
 * macmini-use：把重活分流到 macmini 的常驻算力机，给本机（用户正在用的 MacBook）减负。
 *
 * 2026-11-03 用户立：本机是 8 核 / 8GB 的 MacBook Air，用户此刻就在用它；macmini 是
 * 12 核 / 32GB 的常驻算力机；2026-11-05 起两机只共享 `~/.pi/agent` 与 `~/.dev/private`，
 * 项目代码走 GitHub、各自 clone（见
 * `~/.pi/agent/docs/macmini-mirror.md`）。目标是「用户的日常操作要流畅」，所以：
 *
 *   ① **每轮触发判断**：`before_agent_start` 往系统提示里追加一段很短的「分流判断」
 *      要求——用户每下一条指令，AI 先花一秒判断里面的重活能不能放到 macmini，
 *      判断完直接做、不用问用户。文本基本固定（只有负载档位会变），缓存友好。
 *   ② **两条执行通道**：`macmini_run`（首选，cwd 自动映射到镜像路径、长任务可后台）
 *      与 `macmini_status`（看两机负载）。比让模型手写 ssh 引号可靠得多。
 *   ③ **工具强制**：`tool_call` 拦下明显的重型本机命令（swift / cargo / go / cmake /
 *      make -j / ffmpeg / tesseract / whisper …，只收 macmini 接得住的类型），要求改用
 *      macmini_run；确需本机执行时命令末尾加 `# AI_LOCAL_OK: <理由>` 重发（逃生门，不是禁用）。
 *   ④ **镜像安全**：远端 `rm -rf` 会经 Syncthing 删到本机，所以 `macmini_run` 里递归
 *      删除镜像目录默认拒绝（/tmp 除外），要删须带 `AI_REMOTE_RM_OK` 并说清理由；
 *      远端 git 写操作一律拒绝（macmini 是只读镜像，写了会污染本机 `.git/index`）。
 *
 * 只在非 macmini 上生效（hostname 判定）：在 macmini 上「分流给自己」没有意义。
 * 判定逻辑在 classify.ts / remote.ts（纯函数，可单独测），本文件只做接线与 UI。
 */

import { cpus, loadavg } from "node:os";
import { resolve } from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { LOCAL_MARK, REMOTE_RM_MARK, detectHeavy, detectMirrorDelete, detectTaskSignals, isMacminiHost } from "./classify.ts";
import { STATUS_SCRIPT, buildScript, execRemote, launchRemote, mapPath } from "./remote.ts";
import { createIndicator } from "./status.ts";

/** 工具默认 / 最长同步等待（长任务请用 background）。 */
const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_TIMEOUT_MS = 1_800_000;

/** 本机负载档位（只按 1 分钟 load / 核数粗分，够做分流判断即可）。 */
function localLoad(): { cores: number; level: "轻" | "中" | "重" } {
	const cores = Math.max(1, cpus().length);
	const perCore = (loadavg()[0] ?? 0) / cores;
	const level = perCore >= 0.8 ? "重" : perCore >= 0.4 ? "中" : "轻";
	return { cores, level };
}

/** 每轮追加进系统提示的分流判断（内容基本固定，避免破坏 prompt 缓存）。 */
function buildBrief(): string {
	const { cores, level } = localLoad();
	return `【macmini-use 分流判断（2026-11-03 用户立）】
用户正在用这台 ${cores} 核 / 8GB 的 MacBook（此刻负载「${level}」）；macmini 是 12 核 x64 / 32GB 的常驻算力机，与本机共享 \`~/.pi/agent\` 与 \`~/.dev/private\`（项目代码走 GitHub、各自 clone）。**每条用户指令先花一秒判断「里面的重活要不要放 macmini」**，判断完直接执行、不要问用户——目的是保住用户本机的流畅度。
- 分流（用 \`macmini_run\` 工具，别手写 ssh）：预计会占本机 CPU / 内存十几秒以上的编译 / 构建 / 测试套件 / 媒体转码 / 批量渲染 / 数据回测 / 大文件扫描 / 大下载；上面负载是「中 / 重」时把门槛再降，看着会跑一阵就分流。
- 留本机：几秒内结束的短命令；需要 GUI / VSCode / osascript / 焦点 / 剪贴板 / Keychain；需要 arm64 产物或本机 node_modules；git 写 / gh / 发版 / CI；操作未镜像路径（~/Downloads、/Volumes、~/Library、~/Key、~/.ssh）。
- 硬约束：只有 \`~/.pi/agent\` 与 \`~/.dev/private\` 在同步（改前需飞书快照、删根禁止）；项目代码走 GitHub，macmini 上是独立 clone；构建缓存导到 /tmp。
- 结论落到行动：分流时说一句「这个放 macmini 跑」；长任务用 \`macmini_run\` 的 background，稍后读日志把结果带回来。`;
}

/** 本机与 macmini 的负载概览文本。 */
async function statusText(): Promise<string> {
	const { cores, level } = localLoad();
	const local = [
		`本机（MacBook）：${cores} 核 / 8GB，1 分钟负载档位「${level}」（load ${(loadavg()[0] ?? 0).toFixed(2)}）`,
	].join("\n");
	const res = await execRemote(STATUS_SCRIPT, { timeoutMs: 20_000 });
	if (res.code !== 0 || !res.stdout.trim()) {
		const why = res.timedOut ? "超时" : res.stderr.trim() || `ssh 退出码 ${res.code ?? "?"}`;
		return `${local}\nmacmini：连不上（${why}）——先按本机负载决定，重活仍可尝试分流并说明可能失败。`;
	}
	return `${local}\nmacmini：\n${res.stdout.trim()}`;
}

/** 结果截断：保留开头与结尾（长日志两头最重要）。 */
function trimOutput(text: string, max = 20_000): string {
	if (text.length <= max) return text;
	const head = 7_000;
	const tail = max - head - 200;
	return `${text.slice(0, head)}\n\n…（中间省略 ${text.length - head - tail} 字符）…\n\n${text.slice(-tail)}`;
}

interface GitVerdict {
	blocked: boolean;
	hit?: string;
}

/**
 * 远端 git 写操作判定（2026-11-05 修订）。
 *
 * 旧版拦的是「一切 git 子命令」（包括 `git remote -v` / `git branch` / `git fetch` 这类只读），
 * 前提是「macmini 的 `.git` 与本机逐文件同步」——该前提已在 2026-11-05 架构改造后消失
 * （`~/Developer` 不再同步，每台机器各自 clone；`git-readonly-guard.ts` 已删除）。
 * 现在只拦**真正会改写仓库的子命令**，读操作（status / diff / log / show / branch / remote /
 * config / ls-files / rev-parse / fetch / worktree list）一律放行。
 */
const GIT_WRITE_RE =
	/\bgit\s+(?:-C\s+\S+\s+|--git-dir=\S+\s+)?(add|commit|push|merge|rebase|cherry-pick|revert|am|apply|rm|mv|reset|restore|checkout|switch|clean|stash|tag|submodule|init|clone|gc|prune|filter-[a-z]+|update-ref)\b/;

function checkGitWrite(command: string): GitVerdict {
	const m = command.match(GIT_WRITE_RE);
	return m ? { blocked: true, hit: `git ${m[1]}` } : { blocked: false };
}

/** 命令里是否真的在打 macmini（`ssh mac-mini …` 这类直接调用，不走 macmini_run 的路径）。 */
function callsRemote(command: string): boolean {
	return /(?:^|[\s;&|(])ssh\b[^\n]*\bmac-mini\b/.test(command) || /\bmac@mac-mini\b/.test(command);
}

const HEAVY_DENY = (label: string, segment: string) =>
	`[macmini-use] 已拦下这条本机命令：**${label}** 属于重型任务，默认应分流到 macmini。\n` +
	`命中片段：\`${segment}\`\n` +
	`本机是用户正在用的 8 核 / 8GB MacBook，macmini 是 12 核 / 32GB 的常驻算力机（两机共享 \`~/.pi/agent\` 与 \`~/.dev/private\`，项目代码走 GitHub）。\n` +
	`- 首选：改用 \`macmini_run\` 工具（cwd 自动映射到镜像路径；长任务传 background:true，之后 tail 日志取结果）。\n` +
	`- 确需在本机跑（产物必须 arm64 / 要操作本机路径 / 需要 GUI），在命令末尾加 \`# ${LOCAL_MARK}: <一句话理由>\` 重发，并在回复里向用户说明为什么留本机。\n` +
	`细则见 skill \`macmini-use\`。`;

export default function (pi: ExtensionAPI) {
	// macmini 上不启用：不能把活分流给自己
	if (isMacminiHost()) return;

	// 使用状态指示器：正在用 macmini 时，在输入框下方挂一行提示，用完即撤（见 status.ts）
	const indicator = createIndicator();
	pi.on("session_start", async (_event, ctx) => {
		indicator.attach(ctx);
	});
	pi.on("session_shutdown", async () => {
		indicator.dispose();
	});
	// 工具调用结束 → 销掉前台使用登记（后台任务另有 trackJob 跟踪进程存活）
	pi.on("tool_result", async (event) => {
		try {
			const { toolCallId } = (event ?? {}) as { toolCallId?: string };
			if (toolCallId) indicator.end(toolCallId);
		} catch {
			// 防御性放行
		}
	});

	// ① 每轮注入分流判断；指令本身像重活时再补一条定向提醒（只给 AI 看）
	pi.on("before_agent_start", async (event) => {
		try {
			const { systemPrompt = "", prompt: userPrompt = "" } =
				(event ?? {}) as { systemPrompt?: string; prompt?: string };
			const result: Record<string, unknown> = {};

			const signals = detectTaskSignals(userPrompt);
			if (signals.length > 0) {
				const { level } = localLoad();
				result.message = {
					customType: "macmini-use",
					display: false, // 只进 AI 上下文，界面上不显示
					content:
						`【macmini-use 触发】这条指令命中重型特征「${signals.join("、")}」，本机负载「${level}」。` +
						`先判断一次：若预计占本机 CPU / 内存十几秒以上，直接用 macmini_run 分流（回复里说一句「这个放 macmini 跑」）；` +
						`若其实是几秒的短命令、或必须本机（GUI / arm64 产物 / 本机依赖），就本机跑，不要为了分流而分流。`,
				};
			}

			if (!systemPrompt.includes("【macmini-use 分流判断")) {
				result.systemPrompt = `${systemPrompt}\n\n${buildBrief()}`;
			}

			return Object.keys(result).length > 0 ? result : undefined;
		} catch {
			// 注入失败不影响会话
		}
	});

	// ③ 本机重型命令闸门（bash 与 background_run 两条路径都盖）
	pi.on("tool_call", async (event, ctx) => {
		try {
			const { toolName, toolCallId, input } = event as {
				toolName?: string;
				toolCallId?: string;
				input?: { command?: string };
			};
			// 使用 macmini 的工具调用：登记前台使用状态（结束时由 tool_result 销号）
			if (toolName === "macmini_run" || toolName === "macmini_status") {
				indicator.attach(ctx);
				indicator.begin(toolCallId ?? `anon-${Date.now()}`);
				return;
			}
			if (toolName !== "bash" && toolName !== "background_run") return;
			const command = input?.command ?? "";
			if (!command) return;
			// 直接 `ssh mac-mini …` 也是在用 macmini：同样亮起指示器
			if (callsRemote(command)) {
				indicator.attach(ctx);
				indicator.begin(toolCallId ?? `anon-${Date.now()}`);
			}
			if (command.includes(LOCAL_MARK)) return;
			const hit = detectHeavy(command);
			if (hit) return { block: true, reason: HEAVY_DENY(hit.label, hit.segment) };
		} catch {
			// 判定异常时不阻塞会话（与其它守卫一致）
		}
	});

	// ② 远端执行工具
	pi.registerTool({
		name: "macmini_run",
		label: "在 macmini 上执行",
		description:
			"在 macmini（12 核 x64 / 32GB 常驻算力机）上执行命令，用来把重活从本机分流出去：编译 / 构建 / 测试套件 / 转码 / 批量渲染 / 数据回测 / 大文件扫描 / 大下载。" +
			"cwd 传本机会话里的路径即可，自动映射成 macmini 的镜像路径（/Users/xhq → /Users/mac）；产物写进 `~/.pi/agent` 或 `~/.dev/private` 会同步回本机（改前需快照）；写在 `~/Developer` 下**不会**回流——项目代码走 GitHub，需要产物就落 /tmp 再 scp，或按流程提交推送。" +
			"长任务传 background:true，拿到 /tmp/macmini-jobs/ 下的日志路径后，再用本工具执行 tail 取进度 / 结果。" +
			"远端前置：x64 / 32GB；2026-11-05 架构改造后项目代码走 GitHub（`~/Developer` 不再同步），只有 `~/.pi/agent` 与 `~/.dev/private` 双向同步——这两个目录允许改删内容但必须先做飞书快照，且目录根本身禁止删除；其余路径的递归删除默认被拒。" +
			"几秒就能结束的短命令不要用它（SSH 往返更慢），留本机 bash 即可。",
		promptSnippet: "在 macmini 算力机上跑重活（构建 / 转码 / 回测 / 长任务），给本机减负",
		promptGuidelines: [
			"Use macmini_run（而不是本机 bash）执行重型、长耗时任务：编译 / 构建 / 测试套件 / 媒体转码 / 批量渲染 / 数据回测 / 大文件扫描 / 大下载；几秒内结束的短命令仍用本机 bash。",
		],
		parameters: Type.Object({
			command: Type.String({ description: "要在 macmini 上执行的 shell 命令（原样执行，不需要自己加 ssh）" }),
			cwd: Type.Optional(
				Type.String({ description: "工作目录，传本机路径即可（自动映射 /Users/xhq → /Users/mac）；默认当前会话工作目录" }),
			),
			timeout_ms: Type.Optional(
				Type.Number({ description: `同步等待上限，默认 ${DEFAULT_TIMEOUT_MS}；超过建议用 background:true` }),
			),
			background: Type.Optional(Type.Boolean({ description: "后台跑（nohup + /tmp/macmini-jobs 日志），立即返回日志路径" })),
			label: Type.Optional(Type.String({ description: "任务标签（background 时写进远端启动信息，便于识别）" })),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx: ExtensionContext) {
			indicator.attach(ctx);
			const command = String(params.command ?? "").trim();
			if (!command) {
				return { content: [{ type: "text", text: "[macmini-use] command 为空：没有可执行的内容。" }], isError: true, details: {} };
			}
			const sessionCwd = ctx?.cwd ?? process.cwd();
			const rawCwd = String(params.cwd ?? sessionCwd);
			const resolvedCwd = rawCwd.startsWith("/") || rawCwd.startsWith("~")
				? rawCwd
				: resolve(sessionCwd, rawCwd);
			const mapped = mapPath(resolvedCwd);
			const mirroredNote = mapped.mirrored
				? ""
				: `\n[macmini-use] 注意：\`${mapped.remote}\` 不在两机镜像范围内，macmini 上看到的是它自己的目录（不是本机这份数据的副本）。`;

			// 远端 git 写操作：拒绝（会污染本机同步过去的 .git/index）
			const git = checkGitWrite(command);
			if (git.blocked) {
				return {
					content: [
						{
							type: "text",
							text:
								`[macmini-use] 已拒绝：远端命令包含 git 写操作（${git.hit ?? "git"}）。\n` +
								`团队口径（2026-11-05）：**git 写 / 发版一律在本机做**——两机各自 clone 同一批仓库，但提交、PR、打 tag 只需要一个权威源，两边同时写会把历史分叉。\n` +
								`macmini 现在能正常读仓库（status / diff / log / fetch 都行），请你把改动拿回本机走 add → commit → PR。`,
						},
					],
					isError: true,
					details: {},
				};
			}

			// 远端递归删除：默认拒绝（删除会经镜像同步到本机）
			if (!command.includes(REMOTE_RM_MARK)) {
				const del = detectMirrorDelete(command, mapped.remote);
				if (del) {
					return {
						content: [
							{
								type: "text",
								text:
									`[macmini-use] 已拦截远端递归删除：\`${del.segment}\`\n` +
									`以下目标不在允许范围内：\`${del.targets.join(" ")}\`\n` +
									`规则（2026-11-05 架构改造后）：/tmp 可自由删；\`~/.pi/agent\` 与 \`~/.dev/private\` ` +
									`允许改删里面的内容（改前快照由 snapshot-guard 强制），**但两个目录根本身永远不许删**；` +
									`其余路径（含项目目录）维持默认拒绝。\n` +
									`- 临时文件请放 /tmp 再删（/tmp 不在同步范围内）；\n` +
									`- 确需删其它路径时，在命令里带上 \`# ${REMOTE_RM_MARK}\` 重试，并在回复里向用户说明删什么、为什么。`,
							},
						],
						isError: true,
						details: {},
					};
				}
			}

			const script = buildScript(mapped.remote || null, command);

			if (params.background) {
				const job = await launchRemote(script, String(params.label ?? ""));
				// 后台任务在工具调用返回后仍占着 macmini：登记存活跟踪，跑完自动撤指示器
				if (!job.error) indicator.trackJob({ id: job.jobId, scriptPath: job.scriptPath });
				if (job.error) {
					return {
						content: [{ type: "text", text: `[macmini-use] 后台启动失败：\n${trimOutput(job.error, 4000)}` }],
						isError: true,
						details: {},
					};
				}
				return {
					content: [
						{
							type: "text",
							text:
								`[macmini-use] 已在 macmini 后台启动 ${job.jobId}${job.pid ? `（PID ${job.pid}）` : ""}\n` +
								`cwd：${mapped.remote || "(远端 $HOME)"}\n` +
								`日志：${job.logPath}\n` +
								`取进度 / 结果：再调 macmini_run 执行 \`tail -n 60 ${job.logPath}\`（进程还在跑时只显示已有输出；看是否结束：\`pgrep -f ${job.scriptPath} >/dev/null && echo running || echo done\`）。` +
								mirroredNote,
						},
					],
					details: { jobId: job.jobId, pid: job.pid, logPath: job.logPath },
				};
			}

			const timeoutMs = Math.min(
				MAX_TIMEOUT_MS,
				Math.max(5_000, Number(params.timeout_ms) || DEFAULT_TIMEOUT_MS),
			);
			const res = await execRemote(script, { timeoutMs, signal });
			const out = [res.stdout.trim(), res.stderr.trim()].filter(Boolean).join("\n--- stderr ---\n");
			const unreachable = res.code === 255 || /ssh: (?:connect to host|Could not resolve hostname)/i.test(res.stderr);
			const header =
				`[macmini] cwd=${mapped.remote || "(远端 $HOME)"}  用时 ${(res.durationMs / 1000).toFixed(1)}s  ` +
				`退出码 ${res.code ?? "?"}` +
				(res.timedOut ? "（已超时，远端进程可能仍在跑；长任务请用 background:true）" : "") +
				(unreachable
					? "\n[macmini-use] 连不上 macmini（网络 / Tailscale？）。先 `ssh mac-mini 'echo ok'` 确认；确需继续可改在本机执行，并在命令末尾加 `# AI_LOCAL_OK: <理由>`。"
					: "");
			return {
				content: [{ type: "text", text: `${header}\n${trimOutput(out) || "(无输出)"}${mirroredNote}` }],
				isError: res.code !== 0,
				details: { code: res.code, timedOut: res.timedOut, durationMs: res.durationMs },
			};
		},
	});

	pi.registerTool({
		name: "macmini_status",
		label: "macmini 负载",
		description:
			"查看本机（MacBook，8 核 / 8GB）与 macmini（12 核 x64 / 32GB）的实时负载、可用磁盘、占 CPU 的进程，用来判断重活该不该分流。几秒返回。",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx: ExtensionContext) {
			indicator.attach(ctx);
			const text = await statusText();
			return { content: [{ type: "text", text: trimOutput(text, 8000) }], details: {} };
		},
	});

	// 用户手动入口：/macmini status | /macmini <命令> | /macmini bg <命令>
	pi.registerCommand("macmini", {
		description: "在 macmini 上跑命令：/macmini status 看两机负载；/macmini <命令> 远端执行；/macmini bg <命令> 后台执行",
		handler: async (args, ctx: ExtensionContext) => {
			// 用户手敲 /macmini 也是一次「正在使用 macmini」：挂出指示器，执行完就撤
			indicator.attach(ctx);
			const useId = `cmd-${Date.now()}`;
			indicator.begin(useId);
			try {
				await runMacminiCommand((args ?? "").trim(), ctx);
			} finally {
				indicator.end(useId);
			}
		},
	});

	/** `/macmini` 的执行体（指示器的 begin / end 由命令处理函数统一收口）。 */
	async function runMacminiCommand(raw: string, ctx: ExtensionContext): Promise<void> {
		const cwdRemote = mapPath(ctx?.cwd ?? process.cwd()).remote;
		if (raw === "" || raw === "status") {
			ctx.ui.notify(trimOutput(await statusText(), 4000), "info");
			return;
		}
		if (raw.startsWith("bg ")) {
			const job = await launchRemote(buildScript(cwdRemote, raw.slice(3).trim()), "slash-command");
			// 后台任务同样登记存活跟踪（跑完自动撤指示器）
			if (!job.error) indicator.trackJob({ id: job.jobId, scriptPath: job.scriptPath });
			ctx.ui.notify(
				job.error
					? `后台启动失败：${job.error}`
					: `已在 macmini 后台启动 ${job.jobId}${job.pid ? `（PID ${job.pid}）` : ""}\n日志：${job.logPath}`,
				job.error ? "error" : "info",
			);
			return;
		}
		const res = await execRemote(buildScript(cwdRemote, raw), { timeoutMs: DEFAULT_TIMEOUT_MS });
		const out = [res.stdout.trim(), res.stderr.trim()].filter(Boolean).join("\n--- stderr ---\n");
		ctx.ui.notify(
			trimOutput(
				`[macmini] cwd=${cwdRemote}  用时 ${(res.durationMs / 1000).toFixed(1)}s  退出码 ${res.code ?? "?"}\n${out || "(无输出)"}`,
				4000,
			),
			res.code === 0 ? "info" : "error",
		);
	}
}
