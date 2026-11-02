/**
 * remote main 锁死守卫（pi 端，tool_call 拦截，2026-11-02 用户立规）。
 *
 * 规矩：所有智能体团队项目（Agent 项目 + 其名下子项目）一律锁死 remote main——
 * 不得从本地直接 push main，不得在 main 上直接 commit；一切改动走
 * worktree 分支 → PR → CI → auto-merge → remote main → 本地 main 快进同步。
 * 文本规则在全局 `~/.pi/agent/CLAUDE.md`「开发流程：worktree + PR」节。
 *
 * 拦截范围（只对带 GitHub remote 的仓库生效，避免误伤临时 / 本地实验仓库）：
 * 1. `git push` 的 refspec 指向 main / master（含裸 `git push` 且当前在 main、
 *    `git push origin`、`HEAD:main`、`refs/heads/main`、`--delete main`、
 *    `--all` / `--mirror` 等可能覆盖 main 的形态）；
 * 2. 当前分支为 main / master 时的 `git commit`（含 `git -C <path>` 形态）。
 *
 * 逃生门（仅限用户当轮明确授权，AI 不得自行添加）：
 * - push：命令末尾 `# AI_AUTHORIZED_PUSH_MAIN`
 * - commit：命令末尾 `# AI_AUTHORIZED_COMMIT_MAIN`
 *
 * 判定失败时 fail-open（与其它守卫一致）：守卫失灵不阻塞会话。
 */

import { execFileSync } from "node:child_process";
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PUSH_MARK = "AI_AUTHORIZED_PUSH_MAIN";
const COMMIT_MARK = "AI_AUTHORIZED_COMMIT_MAIN";

const SEGMENT_SPLIT = /&&|\|\||;|\n|\|/;
const GIT_SEGMENT = /^git(?=\s|$)/;
const MAIN_BRANCHES = new Set(["main", "master"]);

const PUSH_DENY =
	"[git-main-guard] 拦截：团队项目锁死 remote main，禁止直接 push main（2026-11-02 用户立规）。" +
	"正确流程：在独立 worktree 的功能分支上提交 → push 分支 → 开 PR → CI → auto-merge → remote main → 本地 main 快进同步。" +
	"确需直推时须用户当轮明确授权，并在命令末尾加 `# AI_AUTHORIZED_PUSH_MAIN`。";

const COMMIT_DENY =
	"[git-main-guard] 拦截：团队项目不允许在 main 上直接提交（2026-11-02 用户立规）。" +
	"正确流程：先建 worktree + 功能分支（`git worktree add ../<仓库>-<事项> -b <分支>`），在分支上提交并走 PR。" +
	"确需在 main 上提交时须用户当轮明确授权，并在命令末尾加 `# AI_AUTHORIZED_COMMIT_MAIN`。";

type RepoContext = { dir: string; branch: string; isGitHub: boolean };

function execGit(dir: string, args: string[]): string | null {
	try {
		return execFileSync("git", ["-C", dir, ...args], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: 5000,
		}).trim();
	} catch {
		return null;
	}
}

/** 从 `git -C <path> ...` 里取出 -C 路径；没有则用调用方 cwd。 */
function repoDirFromSegment(segment: string, fallback: string): string {
	const match = /(?:^|\s)-C\s+("([^"]+)"|'([^']+)'|(\S+))/.exec(segment);
	const dir = match?.[2] ?? match?.[3] ?? match?.[4];
	if (!dir) return fallback;
	return dir.replace(/^~(?=\/|$)/, process.env.HOME ?? "~");
}

function repoContext(segment: string, cwd: string): RepoContext | null {
	const dir = repoDirFromSegment(segment, cwd);
	const branch = execGit(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
	if (!branch) return null;
	const remote = execGit(dir, ["remote", "-v"]) ?? "";
	const isGitHub = /github\.com[:/]/.test(remote);
	return { dir, branch, isGitHub };
}

/** 去掉引号、解析 `git push` 之后的 token（跳过 git 自身的全局选项）。 */
function pushTokens(segment: string): string[] {
	const match = /(?:^|\s)push(?=\s|$)([\s\S]*)$/.exec(segment);
	if (!match) return [];
	return match[1]
		.replace(/["'`]/g, "")
		.split(/\s+/)
		.map((token) => token.trim())
		.filter(Boolean);
}

function targetsMain(tokens: string[], currentBranch: string): boolean {
	// `--all` / `--mirror` 会推送所有分支（含 main）；`--delete main` 会删 main。
	if (tokens.includes("--all") || tokens.includes("--mirror")) return true;

	const positional = tokens.filter((token) => !token.startsWith("-"));
	// positional[0] 是 remote，其余是 refspec。
	const refspecs = positional.slice(1);

	if (refspecs.length === 0) {
		// 裸 push（或只给 remote）：推当前分支 → 当前在 main 就命中。
		return MAIN_BRANCHES.has(currentBranch);
	}

	return refspecs.some((refspec) => {
		// `HEAD:main` / `main:main` / `refs/heads/main` / `+main` 等形态，取冒号右侧（无冒号则整体）。
		const target = refspec.includes(":") ? refspec.split(":").pop() ?? refspec : refspec;
		const normalized = target.replace(/^\+/, "").replace(/^refs\/heads\//, "");
		return MAIN_BRANCHES.has(normalized);
	});
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		try {
			if (!isToolCallEventType("bash", event)) return;
			const command = event.input.command ?? "";
			if (command.includes(PUSH_MARK) || command.includes(COMMIT_MARK)) return;

			const cwd = process.cwd();
			for (const raw of command.split(SEGMENT_SPLIT)) {
				const segment = raw.trim();
				if (!GIT_SEGMENT.test(segment)) continue;

				const subcommand = /^git(?:\s+-C\s+(?:"[^"]+"|'[^']+'|\S+)|\s+--\S+)*\s+([a-z-]+)/.exec(segment)?.[1];
				if (subcommand !== "push" && subcommand !== "commit") continue;

				// `git commit` 在 main 上直接拒绝；`git push` 只有在推到 main 时才拒绝。
				// 两种情况都要先确认「是带 GitHub remote 的仓库」，避免误伤本地实验仓库。
				const context = repoContext(segment, cwd);
				if (!context || !context.isGitHub) continue;

				if (subcommand === "commit") {
					if (!command.includes(COMMIT_MARK) && MAIN_BRANCHES.has(context.branch)) {
						return { block: true, reason: COMMIT_DENY };
					}
					continue;
				}

				if (targetsMain(pushTokens(segment), context.branch)) {
					return { block: true, reason: PUSH_DENY };
				}
			}
		} catch {
			// fail-open：守卫自身异常不阻塞会话
		}
	});
}
