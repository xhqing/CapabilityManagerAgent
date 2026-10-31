/**
 * commit-mode 守卫（pi 端，系统提示注入 + 命令硬拦截）——只管「自动 commit」。
 *
 * 2026-10-31 用户立：全局规则里有一条常设授权「暂存区有待提交内容就直接按 commit skill
 * 提交，不用问」。但用户有时想先看看**暂存区相对 HEAD** 的改动（`git diff --cached`），
 * 或者不想让 AI 自己提交，这时需要按项目暂停自动 commit。开关命令：
 *   ~/.pi/agent/patch/commit-mode/commit-mode manual|auto|status|list|toggle
 * 状态文件：~/.pi/agent/state/commit-mode.json
 *
 * **与 add-mode / add-mode-guard.ts 完全独立**：两个功能各有自己的命令、状态文件、
 * 扩展文件，互不引用对方的代码或状态——改一个不会影响另一个（代价是两边有一些相似
 * 的路径 / 意图判定代码，这是「完全解耦」的取舍）。
 *
 * 两层作用：
 *   ① 系统提示注入（before_agent_start）：本项目自动 commit 关闭时，每轮告诉 AI 不要
 *      自行走 /commit、/bump、/release、不要执行 git commit（即使 add 流程建议衔接提交
 *      也要停下）——预防。
 *   ② 命令硬拦截（tool_call)：用户当轮没要求提交时，`git commit` 一律拦下——下限防线。
 *
 * 判定粒度：状态里登记的是**目录**，该目录及其所有子目录（含子项目仓库）都生效。
 * `git -C <路径>` 与 `cd <路径>` 会被解析成候选路径一并判定。
 *
 * 局限（诚实）：按命令文本判断，AI 把命令写进脚本文件再执行就拦不住；它是下限防线。
 */

import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STATE_FILE = join(homedir(), ".pi", "agent", "state", "commit-mode.json");

/** 状态文件缓存：按 mtime 失效。 */
let stateCache: { mtime: number; entries: string[] } | null = null;
/** 仓库根缓存：路径 → git toplevel。 */
const repoCache = new Map<string, string>();
/** 最近一条用户输入（判定「用户当轮是否要求提交」）。 */
let lastUserText = "";
/** 当前这轮对话是否由用户输入发起（false = intercom / 系统消息触发的轮次）。 */
let intentFresh = false;

/** 规范化路径：展开 ~、去引号、转绝对路径、解析软链、去尾斜杠。 */
function norm(raw: string): string {
	let p = raw.trim();
	if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
		p = p.slice(1, -1);
	}
	if (p === "~") p = homedir();
	else if (p.startsWith("~/")) p = join(homedir(), p.slice(2));
	const abs = resolve(p);
	let real = abs;
	try {
		real = realpathSync.native(abs);
	} catch {
		// 路径不存在：保留绝对路径
	}
	return real.replace(/\/+$/, "") || "/";
}

/** 读状态文件里的手动 commit 条目。 */
function manualEntries(): string[] {
	try {
		const st = statSync(STATE_FILE);
		if (stateCache && stateCache.mtime === st.mtimeMs) return stateCache.entries;
		const data = JSON.parse(readFileSync(STATE_FILE, "utf8")) as { manual?: unknown };
		const entries = Array.isArray(data?.manual)
			? data.manual.filter((x): x is string => typeof x === "string" && x.trim() !== "").map(norm)
			: [];
		stateCache = { mtime: st.mtimeMs, entries };
		return entries;
	} catch {
		stateCache = null;
		return [];
	}
}

/** path 是否等于 root 或位于 root 之下。 */
function under(path: string, root: string): boolean {
	return path === root || path.startsWith(root + "/");
}

/** 取路径所在 git 仓库根；不在仓库内（或失败）返回路径本身。 */
function repoRoot(path: string): string {
	const cached = repoCache.get(path);
	if (cached) return cached;
	let root = path;
	try {
		const out = execFileSync("git", ["-C", path, "rev-parse", "--show-toplevel"], {
			encoding: "utf8",
			timeout: 5000,
			stdio: ["ignore", "pipe", "ignore"],
		});
		if (out.trim()) root = norm(out);
	} catch {
		// 不是 git 仓库
	}
	repoCache.set(path, root);
	return root;
}

/** 某路径（它本身或它所在仓库）是否落在手动 commit 条目之下。 */
function isManualPath(path: string): boolean {
	const entries = manualEntries();
	if (entries.length === 0) return false;
	const p = norm(path);
	if (entries.some((e) => under(p, e))) return true;
	const root = repoRoot(p);
	return entries.some((e) => under(root, e));
}

/** 从 bash 命令里提取可能的目标目录：cwd、`cd X`、`git -C X`。 */
function candidatePaths(command: string, cwd: string): string[] {
	const out = new Set<string>([norm(cwd)]);
	const toAbs = (raw: string) => {
		let p = raw.trim();
		if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
			p = p.slice(1, -1);
		}
		if (p === "~" || p.startsWith("~/")) return norm(p);
		return p.startsWith("/") ? norm(p) : norm(join(cwd, p));
	};
	for (const rawSeg of command.split(/&&|\|\||;|\n|\|/)) {
		const seg = rawSeg.trim();
		if (!seg) continue;
		const cd = /^cd\s+(.+)$/.exec(seg);
		if (cd) out.add(toAbs(cd[1].split(/\s+/)[0]));
		if (/^git\b/.test(seg)) {
			const m = /\s-C\s*("[^"]*"|'[^']*'|\S+)/.exec(seg);
			if (m) out.add(toAbs(m[1]));
		}
	}
	return [...out];
}

// 只在「以 git 开头的命令段」里认 commit 子命令，避免文档 / echo 文本误判。
const SEGMENT_SPLIT = /&&|\|\||;|\n|\|/;
const GIT_COMMIT_SEGMENT = /^git(?:\s+-\S+(?:\s+[^\s-][^\s]*)?)*\s+commit(?![A-Za-z0-9_-])/;

/** 命令里是否有 git commit 段。 */
function hasGitCommit(command: string): boolean {
	return command.split(SEGMENT_SPLIT).some((seg) => GIT_COMMIT_SEGMENT.test(seg.trim()));
}

/** 用户当轮是否明确要求提交（commit / 发版类意图；单独的 add 意图不算）。 */
function userWantsCommit(text: string): boolean {
	if (!text) return false;
	return /\/commit\b|提交|入库|\bcommit\b|发版|\/bump\b|\bbump\b|\/release\b/i.test(text);
}

export default function (pi: ExtensionAPI) {
	// 记录用户输入
	pi.on("input", async (event) => {
		try {
			lastUserText = (event as { text?: string })?.text ?? "";
			intentFresh = true;
		} catch {
			lastUserText = "";
			intentFresh = false;
		}
	});

	// ① 预防：自动 commit 关闭时每轮把约束写进系统提示
	pi.on("before_agent_start", async (event, ctx) => {
		try {
			// 本轮不是用户输入触发的（intercom / 系统消息）→ 丢弃上一条用户输入的意图
			if (!intentFresh) lastUserText = "";
			intentFresh = false;

			const cwd = ctx?.cwd;
			if (!cwd || !isManualPath(cwd)) return;
			const prompt = (event as { systemPrompt?: string })?.systemPrompt ?? "";
			if (prompt.includes("本项目的自动 commit 已关闭")) return;
			return {
				systemPrompt:
					`${prompt}\n\n` +
					`【本项目的自动 commit 已关闭（commit-mode，2026-10-31 用户立）】\n` +
					`项目：${cwd}\n` +
					`不要自行发起 commit 流程——不主动走 /commit、/bump、/release，不主动执行 git commit。\n` +
					`- 即使某个 add 流程预检完全干净、准备自动衔接 commit，本项目也要停下：只 add，不提交。\n` +
					`- 只有用户在当轮消息里明确要求提交时才执行，照常走 commit skill 的完整流程与安全阀。\n` +
					`- 不要自行把开关切回自动（commit-mode auto），只有用户要求时才切换。`,
			};
		} catch {
			// 注入失败不阻塞会话
		}
	});

	// ② 下限防线：用户没要求就拦下 git commit
	pi.on("tool_call", async (event, ctx) => {
		try {
			if (!isToolCallEventType("bash", event)) return;
			const command = event.input.command ?? "";
			if (!hasGitCommit(command)) return;

			const cwd = ctx?.cwd ?? process.cwd();
			const target = candidatePaths(command, cwd).find(isManualPath);
			if (!target) return;
			if (userWantsCommit(lastUserText)) return;

			return {
				block: true,
				reason:
					`[commit-mode-guard] 拦截：${repoRoot(target)} 的自动 commit 已关闭（commit-mode），` +
					`AI 不能自行发起 git commit。用户本轮消息里没有提交要求。\n` +
					`正确做法：把改动留在暂存区 / 工作区，向用户说明「commit 已暂停，需要时告诉我或用 commit-mode auto 恢复」。` +
					`若用户确实当轮要求了而仍被拦，请在汇报里说明并请用户确认（不要反复重试）。`,
			};
		} catch {
			// 判定异常时不阻塞会话（与其它 guard 一致）
		}
	});
}
