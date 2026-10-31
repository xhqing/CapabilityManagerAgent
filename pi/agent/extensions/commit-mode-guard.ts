/**
 * 手动提交模式守卫（pi 端，系统提示注入 + 命令硬拦截）。
 *
 * 2026-10-31 用户立：全局规则里有一条常设授权「工作区 / 暂存区有待提交内容就直接按
 * add skill / commit skill 提交，不用问」。但用户有时想先看看工作区相对暂存区的改动
 * （例如用 diff 视图逐行过一遍），这时需要**按项目暂停自动提交**；并且用户要求
 * **add 与 commit 分成两个独立开关**：
 *   - 暂停自动 add   → AI 不把改动放进暂存区，工作区保持原样（`git diff` 看工作区 vs 暂存区）；
 *   - 暂停自动 commit → AI 不提交，但可以照常 add（`git diff --cached` 看暂存区 vs HEAD）。
 *
 * 状态由 `~/.pi/agent/patch/commit-mode/commit-mode` 脚本维护（`commit-mode manual add`
 * / `manual commit` / `manual all`、`auto ...`），状态文件 ~/.pi/agent/state/commit-mode.json。
 *
 * 三层作用：
 *   ① 系统提示注入（before_agent_start）：本项目某个开关被关掉时，每轮告诉 AI 具体该
 *      停哪一步、另一段流程还能不能走——这是**预防**，让 AI 一开始就不去走被暂停的流程。
 *   ② 命令硬拦截（tool_call）：被暂停的那一步，用户当轮**没有**明确要求时一律拦下——
 *      这是**下限防线**，防止 AI 习惯性地擅自提交。
 *      「明确要求」按开关分别判定：commit 要「提交 / commit / 发版」类意图；add 除上述
 *      外，用户说 `/add`、『预检』『暂存』也算（要提交当然可以先 add）。
 *   ③ 与另外两个扩展联动：redundant-ask-guard（授权清单按两个开关改写）、
 *      settle-repo-check（收尾巡检跳过被暂停的仓库）。
 *
 * 判定粒度：状态里登记的是**目录**，该目录及其所有子目录（含子项目仓库）都生效。
 * `git -C <路径>` 与 `cd <路径>` 会被解析成候选路径一并判定，因此 Agent 项目会话里
 * 跨目录操作某个子项目仓库时也能正确生效。
 *
 * 局限（诚实）：AI 若用别的写法绕开（如写脚本文件再执行），本扩展按命令文本判断不到；
 * 它是下限防线，真正的判断（用户意图、开关切换）靠系统提示与规则文本。
 */

import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STATE_FILE = join(homedir(), ".pi", "agent", "state", "commit-mode.json");

type ModeState = { add: string[]; commit: string[] };

/** 状态文件缓存：按 mtime 失效，避免每次工具调用都解析 JSON。 */
let stateCache: { mtime: number; entries: ModeState } | null = null;
/** 仓库根缓存：路径 → git toplevel（会话期间基本不变）。 */
const repoCache = new Map<string, string>();
/** 最近一条用户输入（用于判定「用户当轮是否要求提交」）。 */
let lastUserText = "";
/** 当前这轮对话是否由用户输入发起（false = intercom / 系统消息触发的轮次）。 */
let intentFresh = false;

/** 规范化路径：展开 ~、去引号、转绝对路径、解析软链（如 /tmp → /private/tmp）、去尾斜杠。 */
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
		// 路径不存在：保留绝对路径，按字符串前缀判定
	}
	return real.replace(/\/+$/, "") || "/";
}

/** 读状态文件里的两组条目（兼容旧版单一 manual 字段）。 */
function modeState(): ModeState {
	try {
		const st = statSync(STATE_FILE);
		if (stateCache && stateCache.mtime === st.mtimeMs) return stateCache.entries;
		const data = JSON.parse(readFileSync(STATE_FILE, "utf8")) as {
			manual?: unknown;
			manualAdd?: unknown;
			manualCommit?: unknown;
		};
		const pick = (value: unknown, fallback: unknown): string[] =>
			(Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [])
				.filter((x): x is string => typeof x === "string" && x.trim() !== "")
				.map(norm);
		const entries: ModeState = {
			add: pick(data?.manualAdd, data?.manual),
			commit: pick(data?.manualCommit, data?.manual),
		};
		stateCache = { mtime: st.mtimeMs, entries };
		return entries;
	} catch {
		stateCache = null;
		return { add: [], commit: [] };
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
		// 不是 git 仓库：用路径本身参与前缀判定
	}
	repoCache.set(path, root);
	return root;
}

/** 某路径（它本身或它所在仓库）是否落在指定开关的条目之下。 */
function isManualPath(kind: "add" | "commit", path: string): boolean {
	const entries = modeState()[kind];
	if (entries.length === 0) return false;
	const p = norm(path);
	if (entries.some((e) => under(p, e))) return true;
	const root = repoRoot(p);
	return entries.some((e) => under(root, e));
}

/** 当前会话 cwd 的两个开关状态。 */
function modesAt(cwd: string): { add: boolean; commit: boolean } {
	return { add: isManualPath("add", cwd), commit: isManualPath("commit", cwd) };
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

// 借 git-commit-guard.ts 的分段判定思路：只在「以 git 开头的命令段」里认子命令，
// 避免文档 / echo 文本里出现的 "git commit" 字样误判。
const SEGMENT_SPLIT = /&&|\|\||;|\n|\|/;
const GIT_WRITE_SEGMENT = /^git(?:\s+-\S+(?:\s+[^\s-][^\s]*)?)*\s+(add|commit)(?![A-Za-z0-9_-])/;

/** 命令里若有 git add / git commit 段，返回该子命令名；否则 null。 */
function gitWriteSubcommand(command: string): "add" | "commit" | null {
	for (const seg of command.split(SEGMENT_SPLIT)) {
		const m = GIT_WRITE_SEGMENT.exec(seg.trim());
		if (m) return m[1] as "add" | "commit";
	}
	return null;
}

/** 用户当轮是否明确要求「提交」（commit / 发版类意图，不含单独的 add 意图）。 */
function userWantsCommit(text: string): boolean {
	if (!text) return false;
	return /\/commit\b|提交|入库|\bcommit\b|发版|\/bump\b|\bbump\b|\/release\b/i.test(text);
}

/** 用户当轮是否明确要求「add」（要提交当然也可以先 add）。 */
function userWantsAdd(text: string): boolean {
	if (!text) return false;
	if (userWantsCommit(text)) return true;
	return /\/add\b|add\s*(一下|skill|预检)|预检|暂存/i.test(text);
}

/** 按两个开关的组合生成系统提示。 */
function manualPrompt(cwd: string, modes: { add: boolean; commit: boolean }): string {
	const head = `【本项目的手动提交开关（commit-mode，2026-10-31 用户立）】\n项目：${cwd}\n`;
	if (modes.add && modes.commit) {
		return `${head}**自动 add 与自动 commit 都已关闭**：不要自行发起 add 或 commit 流程——不主动走 /add、/commit、/bump、/release，不主动执行 git add / git commit，工作区改动保持原样（用户要先看工作区相对暂存区的 diff）。
- 只有用户在当轮消息里明确要求提交时才执行，照常走 add / commit skill 的完整流程与全部安全阀。
- 有改动时不要急着提交、不要清理工作区；用户想看 diff 时可以帮他跑 \`git diff\` 或用 open_diff 打开改动文件。
- 收尾时不要把「仓库不干净」当成待办去处理（被暂停的仓库跳过收尾巡检）。
- 不要自行把开关切回自动（commit-mode auto），只有用户要求时才切换。`;
	}
	if (modes.add) {
		return `${head}**自动 add 已关闭**（自动 commit 仍是开的）：不要自行发起 add 流程——不主动走 /add、不主动执行 git add，工作区改动保持原样（用户要先看工作区相对暂存区的 diff）。
- commit 虽然还是自动的，但没有新暂存内容时不会产生提交；不要为了让流程跑通而自行 add。
- 只有用户在当轮消息里明确要求 add / 提交时才执行，照常走 add / commit skill 的完整流程与安全阀。
- 收尾时不要把「仓库不干净」当成待办去处理。
- 不要自行把开关切回自动（commit-mode auto），只有用户要求时才切换。`;
	}
	return `${head}**自动 commit 已关闭**（自动 add 仍是开的）：不要自行发起 commit 流程——不主动走 /commit、/bump、/release，不主动执行 git commit。
- add 仍可自动：工作区有干净改动时可以按 add skill 预检后加入暂存区（用户要看暂存区 vs HEAD 的 diff，即 \`git diff --cached\`），但**预检完全干净后不要自动衔接 commit**——本模式下 add skill 的自动衔接暂停，只 add 不提交。
- 只有用户在当轮消息里明确要求提交时才执行 commit，照常走 commit skill 的完整流程与安全阀。
- 收尾巡检跳过本项目，不要催提交。
- 不要自行把开关切回自动（commit-mode auto），只有用户要求时才切换。`;
}

export default function (pi: ExtensionAPI) {
	// 记录用户输入：判定「用户当轮是否明确要求提交」的依据
	pi.on("input", async (event) => {
		try {
			lastUserText = (event as { text?: string })?.text ?? "";
			intentFresh = true;
		} catch {
			lastUserText = "";
			intentFresh = false;
		}
	});

	// ① 预防：被暂停的开关每轮写进系统提示
	pi.on("before_agent_start", async (event, ctx) => {
		try {
			// 本轮不是用户输入触发的（intercom 消息 / 系统消息）→ 丢弃上一条用户输入的意图，
			// 避免「用户上一轮说过 /commit」被跨会话消息借用成提交授权。
			if (!intentFresh) lastUserText = "";
			intentFresh = false;

			const cwd = ctx?.cwd;
			if (!cwd) return;
			const modes = modesAt(cwd);
			if (!modes.add && !modes.commit) return;
			const prompt = (event as { systemPrompt?: string })?.systemPrompt ?? "";
			if (prompt.includes("本项目的手动提交开关")) return;
			return { systemPrompt: `${prompt}\n\n${manualPrompt(cwd, modes)}` };
		} catch {
			// 注入失败不阻塞会话
		}
	});

	// ② 下限防线：被暂停的那一步，用户没要求就拦下
	pi.on("tool_call", async (event, ctx) => {
		try {
			if (!isToolCallEventType("bash", event)) return;
			const command = event.input.command ?? "";
			const sub = gitWriteSubcommand(command);
			if (!sub) return;

			const cwd = ctx?.cwd ?? process.cwd();
			const manualTarget = candidatePaths(command, cwd).find((p) => isManualPath(sub, p));
			if (!manualTarget) return;

			const asked = sub === "add" ? userWantsAdd(lastUserText) : userWantsCommit(lastUserText);
			if (asked) return;

			const repo = repoRoot(manualTarget);
			const step = sub === "add" ? "add" : "commit";
			return {
				block: true,
				reason:
					`[commit-mode-guard] 拦截：${repo} 的自动 ${step} 已关闭（commit-mode），` +
					`AI 不能自行发起 git ${step}。用户本轮消息里没有对应的要求。\n` +
					`正确做法：把改动留在工作区，向用户说明「${step} 已暂停，需要时告诉我或用 commit-mode auto ${step} 恢复」。` +
					`若用户确实当轮要求了而仍被拦，请在汇报里说明并请用户确认（不要反复重试）。`,
			};
		} catch {
			// 判定异常时不阻塞会话（与其它 guard 一致）
		}
	});
}
