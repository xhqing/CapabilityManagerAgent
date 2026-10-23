/**
 * 收尾自动巡视后台会话（pi 端扩展，agent_settled 钩子）。
 *
 * 2026-10-04 用户立规 + 定调：用户**看不到 tmux 后台会话**（「后台会话对他而言等于
 * 不存在」），所以「用完即清、不活跃即清」；清扫方式**不挂系统定时器**，而是
 * 「agent 干完活收尾时顺手跑一次 `session-sweep.py`」——本扩展就是这个「顺手」的工具化：
 * 每个会话跑完一轮（`agent_settled` = Pi 不会再自动继续）时自动巡视一次。
 *
 * 分级处理（避免误伤「在等工作流反馈」的会话）：
 *   - **空闲 ≥ 6 小时** → 明显僵尸，直接清（每批最多 3 个，其余留待下次巡视）；
 *   - **空闲 30 分钟 – 6 小时** → 可能只是刚用完或在等反馈，**不自动杀**，留待下一次巡视
 *     （等它跨过 6 小时阈值后自动清）；
 *   - **疑似失控 / 忙死型**（跑得久 + 平均 CPU 高）→ 只记日志、不自动杀：这类靠 mtime
 *     判空闲永远躲过清扫，误杀代价大。
 *
 * 全程静默（2026-10-23 用户定调）：巡视是后台自动维护，**不向会话 / 用户弹任何提示**——
 * 用户说「这个巡视不需要提示，要做到用户无感，提示给用户也没啥意义，用户不会自己去执行
 * 程序的」。原实现用 `ctx.ui.notify` 报告「已清 N 个 / 还有 N 个待人工处理 / 要清可跑 …」，
 * 既打断用户、又给用户根本不会执行的命令建议。现在所有结果只写
 * `~/.pi/agent/logs/session-sweep.log`，需要排查时看日志。
 *
 * 节流：全局 10 分钟最多跑一次（stamp 文件），避免每个小回合都去扫一遍。
 * 防御性 catch：本扩展失灵不影响会话（与其它 guard 一致）。
 *
 * 2026-10-23 修复（清扫长期静默失效事故）：
 *   用户实测：后台会话积到 18 个、跑了 5~15 天没被清，pi-Hopper 空转 8 天 11 小时吃 87%
 *   CPU 也没人管。追查发现两层问题：
 *     ① 脚本侧：候选 > 3 个就**整体拒绝执行**（`return 2`）——僵尸积到第 4 个后永久死锁。
 *        已在 `session-sweep.py` 改为**分批清理**（每批 ≤ 3 个，其余 deferred 留待下次）。
 *     ② 扩展侧（本文件）：原用 `execFileSync`，脚本非零退出码会**抛异常**，被外层
 *        `catch {}` 静默吞掉；且拒绝时输出的是人类可读文字不是 JSON，`JSON.parse` 也会
 *        失败——两头都失败、又无任何日志，于是「清理一直没生效」一年无人知晓。
 *        现改用 `spawnSync`（不因退出码抛异常）+ 容错解析 + **写日志到
 *        `~/.pi/agent/logs/session-sweep.log`**，失败可见可追。
 */

import { spawnSync } from "node:child_process";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SWEEPER = join(homedir(), ".pi", "agent", "patch", "session-sweep", "session-sweep.py");
const LOG_FILE = join(homedir(), ".pi", "agent", "logs", "session-sweep.log");
const LOG_MAX_BYTES = 1_000_000; // 日志超过 1MB 就滚成 .log.1（静默运行写很多轮，防占地）
const STAMP = join(tmpdir(), "pi-session-sweep.stamp");
const THROTTLE_S = 600; // 全局节流：10 分钟
const AUTO_KILL_IDLE_MIN = 360; // 自动清理阈值：空闲 ≥ 6 小时（明显僵尸）
const NOTIFY_IDLE_MIN = 30; // 提示阈值：空闲 ≥ 30 分钟（交人判断）

type Row = {
	session: string;
	idle_min: number | null;
	started: string;
	last_active: string | null;
	pcpu?: number;
	run_hours?: number | null;
	runaway?: boolean;
};
type SweepResult = {
	idle_min: number;
	dry_run: boolean;
	candidates: Row[];
	killed: string[];
	deferred?: string[];
	refused?: string | null;
	runaways?: Row[];
	skipped?: { row: Row; why: string }[];
};

function log(msg: string): void {
	try {
		mkdirSync(join(homedir(), ".pi", "agent", "logs"), { recursive: true });
		try {
			if (statSync(LOG_FILE).size > LOG_MAX_BYTES) renameSync(LOG_FILE, `${LOG_FILE}.1`);
		} catch {
			// 文件还不存在或轮转失败：照常追加
		}
		appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
	} catch {
		// 日志失败不影响主流程
	}
}

/** 跑脚本并解析 JSON。**不因非零退出码抛异常**（旧实现在这里静默失败）。 */
function sweep(args: string[]): SweepResult | null {
	const r = spawnSync("python3", [SWEEPER, ...args], { encoding: "utf8", timeout: 60000 });
	if (r.error) {
		log(`ERROR spawn ${args.join(" ")}: ${r.error.message}`);
		return null;
	}
	if (!r.stdout) {
		log(`ERROR 无输出 exit=${r.status} stderr=${(r.stderr || "").slice(0, 400)}`);
		return null;
	}
	try {
		return JSON.parse(r.stdout) as SweepResult;
	} catch {
		log(
			`ERROR JSON 解析失败 exit=${r.status} stdout=${r.stdout.slice(0, 400)} ` +
				`stderr=${(r.stderr || "").slice(0, 400)}`,
		);
		return null;
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_settled", async (_event, _ctx) => {
		try {
			if (!existsSync(SWEEPER)) return;

			// 全局节流：10 分钟内只巡视一次
			const now = Math.floor(Date.now() / 1000);
			try {
				const last = Number.parseInt(readFileSync(STAMP, "utf8").trim(), 10);
				if (Number.isFinite(last) && now - last < THROTTLE_S) return;
			} catch {
				// 无 stamp，照常继续
			}
			writeFileSync(STAMP, String(now));

			// ① 明显僵尸：直接清（脚本内部每批最多 3 个，其余 deferred）
			const zombies = sweep(["--idle-min", String(AUTO_KILL_IDLE_MIN), "--kill", "--json"]);
			if (zombies?.refused) {
				log(`REFUSED autokill: ${zombies.refused}`);
			}

			// ② 30 分钟 – 6 小时：只列清单，不自动杀
			const pending = sweep(["--idle-min", String(NOTIFY_IDLE_MIN), "--json"]);

			const killed = zombies?.killed ?? [];
			const deferred = zombies?.deferred ?? [];
			const runaways = pending?.runaways ?? [];
			// 30min–6h 区间里的（排除本轮已清与疑似失控，后者单独记录）：本轮不动，等跨过 6 小时阈值后自动清
			const pendingRows = (pending?.candidates ?? []).filter(
				(c) => !killed.includes(c.session) && !runaways.some((r) => r.session === c.session),
			);

			// 全程只写日志、不向用户弹任何提示（2026-10-23 用户定调：巡视要用户无感）
			if (killed.length === 0 && pendingRows.length === 0 && runaways.length === 0) {
				log(`OK 无需处理（refused=${zombies?.refused ?? "-"}）`);
				return;
			}

			if (killed.length > 0) {
				log(
					`KILLED ${killed.length} 个空闲 ≥ ${AUTO_KILL_IDLE_MIN / 60} 小时的后台会话：` +
						killed.join("、"),
				);
			}
			if (deferred.length > 0) {
				log(
					`DEFERRED ${deferred.length} 个僵尸本轮未清（每批上限 3 个）：` +
						`${deferred.join("、")}——下次巡视继续`,
				);
			}
			if (runaways.length > 0) {
				log(
					`WARN 疑似失控 / 忙死型 ${runaways.length} 个（未自动清，误杀风险）：` +
						runaways.map((r) => `${r.session}(跑 ${r.run_hours}h、CPU ${r.pcpu}%)`).join("、"),
				);
			}
			if (pendingRows.length > 0) {
				log(
					`PENDING ${pendingRows.length} 个空闲 ${NOTIFY_IDLE_MIN} 分钟 – ${AUTO_KILL_IDLE_MIN / 60} ` +
						`小时、暂不动（等跨过 ${AUTO_KILL_IDLE_MIN / 60} 小时阈值）：` +
						pendingRows.map((c) => `${c.session}(${c.idle_min} 分钟)`).join("、"),
				);
			}

			log(
				`SWEEP killed=${killed.length} deferred=${deferred.length} ` +
					`runaway=${runaways.length} pending=${pendingRows.length}`,
			);
		} catch (e) {
			// 防御性放行：巡视失灵不影响会话（但要留痕，别再静默）
			log(`FATAL ${(e as Error)?.message ?? String(e)}`);
		}
	});
}
