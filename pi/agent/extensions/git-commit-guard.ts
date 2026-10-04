/**
 * git commit 未授权拦截（pi 端，tool_call 拦截）。
 *
 * 与 ~/.claude/hooks/pre-tool-use-guard.sh 规则 3（CC / Zcode / CodeBuddy /
 * Trae 端共用）的判定逻辑对齐：commit 不论分支 / worktree / 流程一律须
 * 用户明确授权（2026-09-21 用户立规，全局 CLAUDE.md 铁律配套工具强制），
 * hook 对无 AI_AUTHORIZED_COMMIT 标记的 git commit 一律 deny。授权标记仅
 * 三种场景使用：/commit skill 的串联命令、用户当轮消息明确授权后、
 * /add 预检完全干净后的自动衔接（2026-10-01 增）。
 * 规则变更时两端同步改，不能只改一边（「规矩必须配套工具强制」）。
 */

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AUTH_MARK = "AI_AUTHORIZED_COMMIT";
// 2026-10-04 收紧：先按 && / || / ; / | / 换行 切分命令段，只认「以 git 开头的命令段」——
// 此前用全文包含式匹配，文档 / 测试用例 / echo 文本里出现的 "git commit" 会被误判成
// 真命令（实际误伤过：喂给 CC hook 的测试 payload 里含这句话，把守卫误触发了）。
// 只匹配 git commit 本体（含 git -C <path> commit 形态与带 -m 等子选项的形式）；
// 不匹配 git log --grep=commit、git checkout 等非 commit 子命令。
// 与 CC 端 hook 规则 3（~/.claude/hooks/pre-tool-use-guard.sh 的 is_git_command）同源。
const SEGMENT_SPLIT = /&&|\|\||;|\n|\|/;
const GIT_COMMIT_SEGMENT = /^git(?:\s+-\S+(?:\s+[^\s-][^\s]*)?)*\s+commit(?![A-Za-z0-9_-])/;

/** 命令里是否存在「以 git 开头且子命令为 commit」的命令段。 */
function hasGitCommit(command: string): boolean {
	return command.split(SEGMENT_SPLIT).some((seg) => GIT_COMMIT_SEGMENT.test(seg.trim()));
}

const DENY_REASON =
	"[git-commit-guard] 拦截：commit 需用户明确授权（不论分支 / worktree / " +
	"流程，全局铁律 + 2026-09-21 用户立规）。明确授权仅三种形式：用户主动" +
	"触发 /commit、用户当轮消息明确授权 commit、/add 预检完全干净后的" +
	"自动衔接。获得授权后在命令末尾加注释标记 `# AI_AUTHORIZED_COMMIT` " +
	"再执行；未获授权不得擅自加标记。";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		try {
			if (isToolCallEventType("bash", event)) {
				const command = event.input.command ?? "";
				if (hasGitCommit(command) && !command.includes(AUTH_MARK)) {
					return { block: true, reason: DENY_REASON };
				}
			}
		} catch {
			// 判定异常时不阻塞会话（与 test-cases-guard 一致）
		}
	});
}
