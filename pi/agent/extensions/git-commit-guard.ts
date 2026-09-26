/**
 * git commit 未授权拦截（pi 端，tool_call 拦截）。
 *
 * 与 ~/.claude/hooks/pre-tool-use-guard.sh 规则 3（CC / Zcode / CodeBuddy /
 * Trae 端共用）的判定逻辑对齐：commit 不论分支 / worktree / 流程一律须
 * 用户明确授权（2026-09-21 用户立规，全局 CLAUDE.md 铁律配套工具强制），
 * hook 对无 AI_AUTHORIZED_COMMIT 标记的 git commit 一律 deny。授权标记仅
 * 两种场景使用：/commit skill 的串联命令、用户当轮消息明确授权后。
 * 规则变更时两端同步改，不能只改一边（「规矩必须配套工具强制」）。
 */

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AUTH_MARK = "AI_AUTHORIZED_COMMIT";
// 匹配 git commit（含 git -C <path> commit 形态与带 -m 等子选项的形式）；
// 不匹配 git log --grep=commit、git checkout 等非 commit 子命令
const GIT_COMMIT = /\bgit\s+(?:-\S+\s+(?:[^\s-][^\s]*\s+)?)*commit\b/;

const DENY_REASON =
	"[git-commit-guard] 拦截：commit 需用户明确授权（不论分支 / worktree / " +
	"流程，全局铁律 + 2026-09-21 用户立规）。明确授权仅两种形式：用户主动" +
	"触发 /commit，或用户当轮消息明确授权 commit。获得授权后在命令末尾加" +
	"注释标记 `# AI_AUTHORIZED_COMMIT` 再执行；未获授权不得擅自加标记。";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		try {
			if (isToolCallEventType("bash", event)) {
				const command = event.input.command ?? "";
				if (GIT_COMMIT.test(command) && !command.includes(AUTH_MARK)) {
					return { block: true, reason: DENY_REASON };
				}
			}
		} catch {
			// 判定异常时不阻塞会话（与 test-cases-guard 一致）
		}
	});
}
