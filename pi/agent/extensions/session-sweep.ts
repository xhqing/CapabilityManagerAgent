/**
 * 收尾自动巡视后台会话（pi 端扩展，agent_settled 钩子）。
 *
 * 2026-10-04 用户立规 + 定调：用户**看不到 tmux 后台会话**（「后台会话对他而言等于
 * 不存在」），所以「用完即清、不活跃即清」；清扫方式**不挂系统定时器**，而是
 * 「agent 干完活收尾时顺手跑一次 `session-sweep.py`」——本扩展就是这个「顺手」的工具化：
 * 每个会话跑完一轮（`agent_settled` = Pi 不会再自动继续）时自动巡视一次。
 *
 * 分级处理（避免误伤「在等工作流反馈」的会话）：
 *   - **空闲 ≥ 6 小时** → 明显僵尸，直接 `--kill` 清掉；
 *   - **空闲 30 分钟 – 6 小时** → 可能只是刚用完或在等反馈，**不自动杀**，列出清单提示
 *     由 agent / 用户判断（要清就 `session-sweep.py --kill --idle-min 30`）；
 *   - 别的安全阀全在脚本里：只动 tmux 里 `pi-` 前缀的会话、有客户端附着的跳过、
 *     用户终端里的会话（非 tmux）天然不在扫描范围。
 *
 * 节流：全局 10 分钟最多跑一次（stamp 文件），避免每个小回合都去扫一遍。
 * 防御性 catch：本扩展失灵不影响会话（与其它 guard 一致）。
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SWEEPER = join(homedir(), ".claude", "patch", "session-sweep", "session-sweep.py");
const STAMP = join(tmpdir(), "pi-session-sweep.stamp");
const THROTTLE_S = 600; // 全局节流：10 分钟
const AUTO_KILL_IDLE_MIN = 360; // 自动清理阈值：空闲 ≥ 6 小时（明显僵尸）
const NOTIFY_IDLE_MIN = 30; // 提示阈值：空闲 ≥ 30 分钟（交人判断）

type Row = { session: string; idle_min: number | null; started: string; last_active: string | null };
type SweepResult = { candidates: Row[]; killed: string[]; dry_run: boolean };

function sweep(args: string[]): SweepResult {
	const out = execFileSync("python3", [SWEEPER, ...args], { encoding: "utf8", timeout: 60000 });
	return JSON.parse(out);
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_settled", async (_event, ctx) => {
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

			// ① 明显僵尸：直接清
			const zombies = sweep(["--idle-min", String(AUTO_KILL_IDLE_MIN), "--kill", "--json"]);

			// ② 30 分钟 – 6 小时：只列清单，不自动杀
			const pending = sweep(["--idle-min", String(NOTIFY_IDLE_MIN), "--json"]);

			const killedCount = zombies.killed.length;
			const pendingRows = pending.candidates;
			if (killedCount === 0 && pendingRows.length === 0) return;

			const lines: string[] = [];
			if (killedCount > 0) {
				lines.push(
					`已自动关闭 ${killedCount} 个空闲 ≥ ${AUTO_KILL_IDLE_MIN / 60} 小时的后台会话：` +
						zombies.killed.join("、"),
				);
			}
			if (pendingRows.length > 0) {
				lines.push(
					`另有 ${pendingRows.length} 个空闲 ${NOTIFY_IDLE_MIN} 分钟 – ${AUTO_KILL_IDLE_MIN / 60} 小时、` +
						`可能刚用完或在等反馈（**未自动清**）：` +
						pendingRows
							.map((c) => `${c.session}(${c.idle_min} 分钟)`)
							.join("、"),
				);
				lines.push(
					`要清可跑：\`python3 ${SWEEPER} --kill --idle-min ${NOTIFY_IDLE_MIN}\``,
				);
			}
			ctx.ui.notify(
				"[session-sweep] 收尾巡视（2026-10-04 用户立规：看不见的后台会话 = 不存在）\n" +
					lines.join("\n"),
				"info",
			);
		} catch {
			// 防御性放行：巡视失灵不影响会话
		}
	});
}
