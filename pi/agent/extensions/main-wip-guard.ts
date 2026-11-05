/**
 * 主工作区 main 上的改动 → 自动搬运 + 提交（pi 端，2026-11-05 用户立规，工具强制）。
 *
 * 用户口径：「以后 main 工作区有新的改动自动建 worktree 提交，不用汇报，在 worktree 上
 * 自动 /add 和 /commit，最后走 PR 提交，相当于原来在 main 上面自动触发 /add 和 /commit，
 * 所有 Agent 都要遵循」。
 *
 * 背景：2026-11-03 起 local main 只剩两个职责——生成 worktree、被 remote main 快进同步，
 * 它不承载任何写操作；`git-main-guard.ts` 因此硬拦 main 上的 `git add` / `git commit`。
 * 但那只解决了「不许在 main 上提交」，没解决「那 main 上冒出来的改动怎么办」——旧规则是
 * 「先建 worktree 再走」，全靠会话自觉，实测经常没人做（改动烂在工作区）。
 *
 * 本扩展补上自动触发：`agent_settled` 时检查会话 cwd 所在仓库——
 *   ① 在 main / master 上；② 工作区有改动；③ 暂存区为空（有内容就轮不到 AI 动）；
 *   ④ add-mode / commit-mode 都没被切成 manual（用户可能正在看 diff）；
 *   ⑤ 本会话尚未连续触发过多次（上限 3 次 + 5 分钟冷却，防止打转）。
 * 全中时给会话注入一条 `display: false` 的 followUp 消息并**主动触发新一轮**，让 AI 立刻
 * 执行：`worktree-adopt.py` 把改动搬到新 worktree → 在 worktree 上走 /add → /commit → PR。
 * 静默执行，不弹窗、不汇报（用户明确要求「不用汇报」）。
 *
 * 为什么是「注入消息」而不是扩展自己搬：搬运涉及建分支、复制、清理工作区，属于会改仓库的
 * 动作，必须由会话按 skill 流程带着上下文做（还要过 /add 的敏感扫描、/commit 的 cache 检测）
 * ——扩展只负责「提醒这件事该做了」这一步，不做 git 写操作。
 *
 * 局限（诚实）：只看会话 cwd 所在仓库，不看它的全部子项目；同一个仓库若被别的会话同时写，
 * 可能重复触发一次（脚本本身有 dry-run / 回滚，重复执行是幂等的：搬完 main 就干净了）。
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const HOME = homedir();
const ADD_STATE = join(HOME, ".pi", "agent", "state", "add-mode.json");
const COMMIT_STATE = join(HOME, ".pi", "agent", "state", "commit-mode.json");
const ADOPT = join(HOME, ".pi", "agent", "patch", "worktree-adopt", "worktree-adopt.py");
const MAIN_BRANCHES = new Set(["main", "master"]);
const MAX_KICKS = 3;
const COOLDOWN_MS = 5 * 60 * 1000;

function git(cwd: string, args: string[]): { ok: boolean; out: string } {
	try {
		const out = execFileSync("git", ["-C", cwd, ...args], {
			encoding: "utf-8",
			timeout: 8000,
			stdio: ["ignore", "pipe", "ignore"],
		});
		return { ok: true, out: out ?? "" };
	} catch {
		return { ok: false, out: "" };
	}
}

function normalize(raw: string): string {
	let p = raw.trim();
	if (p === "~") p = HOME;
	else if (p.startsWith("~/")) p = join(HOME, p.slice(2));
	try {
		return resolve(p);
	} catch {
		return p;
	}
}

function manualEntries(file: string): string[] {
	try {
		const data = JSON.parse(readFileSync(file, "utf8")) as { manual?: unknown };
		if (!Array.isArray(data?.manual)) return [];
		return data.manual.filter((x): x is string => typeof x === "string" && x.trim() !== "").map(normalize);
	} catch {
		return [];
	}
}

/** add-mode / commit-mode 是否把这个仓库切成了手动（是则不自动搬运）。 */
function pausedByMode(repo: string): string | null {
	for (const [label, file] of [
		["add-mode", ADD_STATE],
		["commit-mode", COMMIT_STATE],
	] as const) {
		if (manualEntries(file).some((p) => repo === p || repo.startsWith(`${p.replace(/\/+$/, "")}/`))) {
			return label;
		}
	}
	return null;
}

interface RepoState {
	root: string;
	branch: string;
	changed: string[];
	staged: boolean;
}

function inspect(cwd: string): RepoState | null {
	const top = git(cwd, ["rev-parse", "--show-toplevel"]);
	if (!top.ok || !top.out.trim()) return null;
	const root = top.out.trim();

	const branch = git(root, ["branch", "--show-current"]).out.trim();
	if (!MAIN_BRANCHES.has(branch)) return null;

	const status = git(root, ["status", "--porcelain"]);
	if (!status.ok || !status.out.trim()) return null;
	const changed = status.out
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => line.slice(3));
	const staged = git(root, ["diff", "--cached", "--quiet"]).ok === false;

	return { root, branch, changed, staged };
}

export default function (pi: ExtensionAPI) {
	let kicks = 0;
	let lastKickAt = 0;
	let lastRoot = "";

	pi.on("agent_settled", async (_event, ctx) => {
		try {
			const cwd = (ctx as { cwd?: string })?.cwd ?? process.cwd();
			const state = inspect(cwd);
			if (!state) return;

			// 暂存区有内容 → 轮不到 AI 动（暂存区红线），等用户处理
			if (state.staged) return;

			const paused = pausedByMode(state.root);
			if (paused) return;

			const now = Date.now();
			if (now - lastKickAt < COOLDOWN_MS) return;
			if (kicks >= MAX_KICKS && lastRoot === state.root) return;

			if (lastRoot !== state.root) kicks = 0;
			kicks += 1;
			lastKickAt = now;
			lastRoot = state.root;

			const preview = state.changed.slice(0, 8).join("、");
			pi.sendMessage(
				{
					customType: "main-wip",
					display: false,
					content:
						`【main-wip】主工作区 \`${state.root}\` 停在 ${state.branch} 上，还有 ${state.changed.length} 处未提交改动（${preview}${state.changed.length > 8 ? " …" : ""}）。\n` +
						`按 2026-11-05 规则（用户立规，所有 Agent 遵循）：local main 不承载写操作，这些改动要**自动**搬到功能分支的 worktree 再提交，不询问、不汇报。现在做：\n` +
						`1. \`python3 ${ADOPT} --repo ${state.root}\`（脚本会建 worktree、逐路径复制、校验一致后才清理主工作区；失败会回滚，主工作区不动）。输出里取 \`WORKTREE=\` 与 \`BRANCH=\`。\n` +
						`2. 在 worktree 上用 \`git -C <WORKTREE>\` 走 /add 预检 → /commit（含 PR 与 CI 合并），全部 git 命令带 \`-C\`，不要 cd。\n` +
						`3. 脚本拒绝执行时（暂存区有内容 / 有冲突 / add-mode 或 commit-mode 为手动）就停下，按它给的提示处理，不要绕过。`,
				},
				{ deliverAs: "followUp", triggerTurn: true },
			);
		} catch {
			// 判定异常不阻塞会话
		}
	});
}
