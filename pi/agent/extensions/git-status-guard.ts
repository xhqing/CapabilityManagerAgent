/**
 * commit skill 第 11 步工具强制（pi 端）：/commit 流程收尾的 `git status`
 * 汇报必须基于真实执行，禁止凭推断拼造输出。
 *
 * 背景（2026-09-21 事故）：一次 /commit 汇报收尾时 AI 没有实际执行
 * `git status`，而是凭上下文手工拼了一段假输出贴进代码块——既猜错了
 * 工作区状态，还拼出 `git cast -A` 这种真实 git 不会输出的提示语。用户
 * 立规要求工具强制，本扩展即配套下限防线（元规则「规矩必须配套工具强
 * 制」）；文本纪律（skill 第 11 步「实际执行 + 原样输出」）仍在场，本
 * 扩展只兜住「忘执行 / 贴错 / 编造」三种失守。
 *
 * 强制锚点：带 AI_AUTHORIZED_COMMIT 标记的 `git commit`（即 /commit
 * skill、用户当轮明确授权、或 /add 预检完全干净后自动衔接的 commit——
 * 与 git-commit-guard.ts 的授权判定同源）。敏感扫描 / cache 检测命中
 * 即终止的场景没有 commit 发生、无锚点，仍靠文本纪律（强制下限不追求
 * 覆盖所有路径）。
 *
 * 三层防线：
 * 1. tool_result：授权 commit 执行后在工具结果末尾追加提醒——收尾必须
 *    实际执行 `git status` 并把输出原样贴进 `>> git status` 代码块；
 * 2. message_end：assistant 消息含 `>> git status` 代码块时，本扩展在
 *    会话 cwd 实测 `git status` 与代码块内容比对（规范化换行与行尾空
 *    白后逐字比对），不符即替换为实测真实输出并加警示行——AI 编造、
 *    贴过期输出、贴 `--short` 等变体都会被纠正；
 * 3. agent_settled：run 结束时若从未出现 status 代码块（AI 整段忘了），
 *    实测 `git status` 并 notify 用户真实输出 + 指出 AI 未执行第 11 步。
 *
 * 替换后的消息进入会话历史，AI 下一轮看到的就是真实输出，不留假账。
 * 判定与执行全程防御性 catch：本扩展失灵时不阻塞会话（与 git-commit-
 * guard / test-cases-guard 一致）。
 */

import { execSync } from "node:child_process";
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AUTH_MARK = "AI_AUTHORIZED_COMMIT";
// 与 git-commit-guard.ts 同源的 commit 匹配（含 git -C <path> commit 形态）。
// 2026-10-04 收紧：按 && / || / ; / | / 换行 切分命令段，只认「以 git 开头的命令段」——
// 此前用全文包含式匹配，文档 / 测试用例 / echo 文本里的 "git commit" 会把守卫误触发。
const SEGMENT_SPLIT = /&&|\|\||;|\n|\|/;
const GIT_COMMIT_SEGMENT = /^git(?:\s+-\S+(?:\s+[^\s-][^\s]*)?)*\s+commit(?![A-Za-z0-9_-])/;
// 最终回复里的 status 代码块：``` [语言标注] 换行 >> git status 换行 输出体 ```
const STATUS_BLOCK = /```[^\n]*\n>> git status\n([\s\S]*?)```/;

const REMINDER =
	"\n\n[git-status-guard] 本次 run 已发生授权 commit：收尾汇报必须实际执行 " +
	"`git status` 工具命令，把输出原样贴进最终回复的 `>> git status` 代码块" +
	"（不加工、不截断）。最终消息里的代码块将与本扩展实测输出比对，不符会" +
	"被替换为真实输出。";

const REPLACED_NOTE =
	"> [git-status-guard] 上方代码块已替换为本扩展实测的真实 `git status` " +
	"输出——原贴内容与实际执行结果不符（可能未实际执行、编造或贴了过期" +
	"输出）。";

/** 命令里是否存在「以 git 开头且子命令为 commit」的命令段（与 git-commit-guard.ts 同源）。 */
function hasGitCommit(command: string): boolean {
	return command.split(SEGMENT_SPLIT).some((seg) => GIT_COMMIT_SEGMENT.test(seg.trim()));
}

function isAuthorizedCommit(command: string): boolean {
	return command.includes(AUTH_MARK) && hasGitCommit(command);
}

/** 在会话 cwd 实测 git status；失败（非仓库 / 超时等）返回 null。 */
function runGitStatus(cwd: string): string | null {
	try {
		return execSync("git status", { cwd, encoding: "utf8", timeout: 10000 }).trim();
	} catch {
		return null;
	}
}

/** 规范化：统一换行、去行尾空白、整体 trim 后逐字比对。 */
function normalize(s: string): string {
	return s
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((l) => l.trimEnd())
		.join("\n")
		.trim();
}

export default function (pi: ExtensionAPI) {
	let armed = false; // 本次 agent run 内发生过授权 commit
	let sawStatusBlock = false; // 本次 run 内 assistant 消息出现过 status 代码块

	pi.on("agent_start", async () => {
		armed = false;
		sawStatusBlock = false;
	});

	// 置位锚点：授权 commit 命令进入执行
	pi.on("tool_call", async (event) => {
		try {
			if (isToolCallEventType("bash", event)) {
				if (isAuthorizedCommit(event.input.command ?? "")) armed = true;
			}
		} catch {
			// 防御性放行
		}
	});

	// 第一层：授权 commit 的工具结果末尾追加提醒
	pi.on("tool_result", async (event) => {
		try {
			if (event.toolName !== "bash") return;
			const input = event.input as { command?: string };
			if (!isAuthorizedCommit(input.command ?? "")) return;
			return {
				content: [
					...event.content,
					{ type: "text" as const, text: REMINDER },
				],
			};
		} catch {
			// 防御性放行
		}
	});

	// 第二层：最终消息里的 status 代码块与实测比对，不符即替换
	pi.on("message_end", async (event, ctx) => {
		try {
			if (event.message.role !== "assistant" || !armed) return;
			const content = event.message.content;
			let changed = false;
			const newContent = content.map((part) => {
				if (part.type !== "text") return part;
				if (STATUS_BLOCK.test(part.text)) sawStatusBlock = true;
				if (!armed || !STATUS_BLOCK.test(part.text)) return part;
				const real = runGitStatus(ctx.cwd);
				if (real === null) return part;
				const pasted = STATUS_BLOCK.exec(part.text)?.[1] ?? "";
				if (normalize(pasted) === normalize(real)) return part;
				changed = true;
				return {
					...part,
					text:
						part.text.replace(STATUS_BLOCK, "```\n>> git status\n" + real + "\n```") +
						"\n\n" +
						REPLACED_NOTE,
				};
			});
			if (changed) return { message: { ...event.message, content: newContent } };
		} catch {
			// 防御性放行：本扩展失灵不影响会话
		}
	});

	// 第三层：run 收尾仍无 status 代码块 → 实测并直接曝光给用户
	pi.on("agent_settled", async (_event, ctx) => {
		try {
			if (!armed) return;
			armed = false;
			const missed = !sawStatusBlock;
			sawStatusBlock = false;
			if (!missed) return;
			const real = runGitStatus(ctx.cwd);
			if (real === null) return;
			ctx.ui.notify(
				"[git-status-guard] /commit 流程已结束，但 AI 未按 skill 第 11 步贴出 " +
					"`git status` 输出。以下为本扩展实测的真实输出：\n\n```\n" +
					real +
					"\n```",
				"warning",
			);
		} catch {
			// 防御性放行
		}
	});
}
