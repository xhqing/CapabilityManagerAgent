/**
 * 子项目仓库收尾巡检（pi 端扩展，agent_settled 钩子）。
 *
 * 2026-10-09 用户立规：所有 Agent 会话结束任务之前必须检查自己负责的子项目仓库是否
 * 干净，不干净的全部要处理干净。本扩展 = 该规则的「顺手检查 + 提醒」工具化：每轮收尾
 * （agent_settled = Pi 不会再自动继续）时调用 ~/.claude/hooks/settle-repo-check.py 巡检
 * 本会话所在 Agent 项目的子项目仓库——
 *   - 全部干净 → 什么都不做（清空去重签名）；
 *   - 发现不干净 → ① 通知用户（ctx.ui.notify）；② 就同一批不干净仓库向会话注入一次
 *     提醒（pi.sendMessage + triggerTurn，促其按规则处理）。
 *
 * 防循环：去重签名（不干净仓库集合）——同一批只注入一次；集合变化（清掉一些 / 又脏了
 * 新的）或全部干净后重新计数。真是在途 WIP 的，Agent 向用户说明即可，不会被反复打断。
 *
 * 判定逻辑与 CC 端 Stop hook 同源（同一个 Python 脚本，见全局 CLAUDE.md「会话收尾检查」节）。
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CHECKER = join(homedir(), ".claude", "hooks", "settle-repo-check.py");

type Dirty = { repo: string; changes: number; path: string };

// 已提醒过的「不干净仓库集合」签名：同一批不重复注入 / 通知，防循环
let nudged = "";

export default function (pi: ExtensionAPI) {
	pi.on("agent_settled", async (_event, ctx) => {
		try {
			if (!existsSync(CHECKER)) return;

			const out = execFileSync("python3", [CHECKER, "--cwd", ctx.cwd, "--json"], {
				encoding: "utf8",
				timeout: 30000,
			});
			const data = JSON.parse(out) as { agent: string; dirty: Dirty[] };
			const dirty = data.dirty ?? [];

			if (dirty.length === 0) {
				nudged = "";
				return;
			}

			const sig = dirty
				.map((d) => d.repo)
				.sort()
				.join(",");
			if (sig === nudged) return; // 同一批已提醒过：保持安静，等它自己处理
			nudged = sig;

			const list = dirty.map((d) => `${d.repo}（${d.changes} 处改动）`).join("、");
			ctx.ui.notify(
				`[settle-repo-check] ${data.agent} 名下还有 ${dirty.length} 个子项目仓库不干净：${list} ` +
					`（2026-10-09 用户规则：收尾前必须处理干净）`,
				"warning",
			);

			const send = (
				pi as unknown as {
					sendMessage?: (
						message: { customType: string; content: string; display: boolean },
						options?: { triggerTurn?: boolean },
					) => void;
				}
			).sendMessage;
			send?.(
				{
					customType: "settle-repo-check",
					content:
						`[settle-repo-check] 你名下还有 ${dirty.length} 个子项目仓库不干净：${list}。` +
						`按用户 2026-10-09 立的规则，收尾前要全部处理干净——各仓库走 /add → /commit` +
						`（该 bump / 发版就照常走）；若是在途 WIP（如 dev-workflow 先行的测试产物），` +
						`向用户说明即可，不要硬提交。`,
					display: true,
				},
				{ triggerTurn: true },
			);
		} catch {
			// 防御性放行：巡检失灵不影响会话（与其它 guard 一致）
		}
	});
}
