/**
 * 手动提交模式守卫（pi 端，系统提示注入 + 命令硬拦截）。
 *
 * 2026-10-31 用户立：全局规则里有一条常设授权「工作区 / 暂存区有待提交内容就直接按
 * add skill / commit skill 提交，不用问」。但用户有时想先看看工作区相对暂存区的改动
 * （例如用 diff 视图逐行过一遍），这时需要**按项目暂停自动提交**。本扩展是那个开关的
 * 工具强制层，状态由 `~/.pi/agent/patch/commit-mode/commit-mode` 脚本维护
 * （`commit-mode manual` / `commit-mode auto`，状态文件 ~/.pi/agent/state/commit-mode.json）。
 *
 * 三层作用：
 *   ① 系统提示注入（before_agent_start）：本项目处于手动模式时，每轮告诉 AI「不要自行
 *      发起 add / commit，改动留在工作区」——这是**预防**，让 AI 一开始就不去走流程。
 *   ② 命令硬拦截（tool_call）：手动模式下，用户当轮**没有**明确要求提交时，`git add` /
 *      `git commit` 一律拦下——这是**下限防线**，防止 AI 习惯性地擅自提交。
 *      「用户当轮明确要求」= 最近一条用户输入里出现 /add、/commit、'提交'、'入库' 等
 *      意图词（input 事件记录）；用户自己敲 /commit 时正是这条让它放行。
 *   ③ 与另外两个扩展联动：redundant-ask-guard（把「有待提交内容就直接提交」从授权清单
 *      里换成相反说法）、settle-repo-check（收尾巡检跳过手动模式仓库）。
 *
 * 判定粒度：状态里登记的是**目录**，该目录及其所有子目录（含子项目仓库）都算手动模式。
 * `git -C <路径>` 与 `cd <路径>` 会被解析成候选路径一并判定，因此 Agent 项目会话里
 * 跨目录操作某个子项目仓库时也能正确生效。
 *
 * 局限（诚实）：AI 若用别的写法绕开（如写脚本文件再执行），本扩展按命令文本判断不到；
 * 它是下限防线，真正的判断（用户意图、模式切换）靠系统提示与规则文本。
 */

import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STATE_FILE = join(homedir(), ".pi", "agent", "state", "commit-mode.json");

/** 状态文件缓存：按 mtime 失效，避免每次工具调用都解析 JSON。 */
let stateCache: { mtime: number; entries: string[] } | null = null;
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

/** 读状态文件里的手动模式条目（目录列表）。 */
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
		// 不是 git 仓库：用路径本身参与前缀判定
	}
	repoCache.set(path, root);
	return root;
}

/** 某路径（它本身或它所在仓库）是否落在手动模式条目之下。 */
function isManualPath(path: string): boolean {
	const entries = manualEntries();
	if (entries.length === 0) return false;
	const p = norm(path);
	if (entries.some((e) => under(p, e))) return true;
	const root = repoRoot(p);
	return entries.some((e) => under(root, e));
}

/** 当前会话上下文（cwd 或它所在仓库）是否手动模式。 */
function isManualContext(cwd: string): boolean {
	return isManualPath(cwd);
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

/** 用户当轮是否明确要求提交（中文 / 英文 / slash 命令三种写法）。
 *
 * 注意：
 * - 不把 `git add` / `git commit` 这类**命令原文**当意图词：用户让我「执行 git add -A」
 *   只是在描述命令，不等于要提交（2026-10-31 实测踩到过），所以只认口语化意图。
 * - `commit` / `bump` 单词仍然算：中文语境里夹这两个英文词基本就是在说提交 / 发版。
 */
function userAskedToCommit(text: string): boolean {
	if (!text) return false;
	return /\/add\b|\/commit\b|\/bump\b|\/release\b|提交|入库|预检|暂存|add\s*(一下|skill|预检)|\bcommit\b|发版|\bbump\b/i.test(
		text,
	);
}

/** 手动模式下注入的系统提示（与状态相关的部分动态生成）。 */
function manualPrompt(cwd: string): string {
	return `【本项目处于手动提交模式（commit-mode，2026-10-31 用户立）】
用户把 ${cwd} 设成了手动提交模式。**不要自行发起 add / commit 流程**——不主动走 /add、/commit、/bump、/release，不主动执行 git add / git commit，工作区有改动就保持原样。
- 只有用户在当轮消息里明确要求提交（如「提交一下」「跑 /add」「/commit」）时才执行，照常走 add / commit skill 的完整流程与全部安全阀。
- 用户切手动模式的常见目的是查看工作区相对暂存区的改动（\`git diff\`）。有改动时不要急着提交、不要清理工作区；用户想看 diff 时可以帮他跑 \`git diff\` 或用 open_diff 打开改动文件。
- 收尾时不要把「仓库不干净」当成待办去处理（手动模式项目跳过收尾巡检）。
- 不要自行把这个项目切回自动模式（\`commit-mode auto\`），只有用户要求时才切换。`;
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

	// ① 预防：手动模式下每轮把行为约束追加进系统提示
	pi.on("before_agent_start", async (event, ctx) => {
		try {
			// 本轮不是用户输入触发的（intercom 消息 / 系统消息）→ 丢弃上一条用户输入的意图，
			// 避免「用户上一轮说过 /commit」被跨会话消息借用成提交授权。
			if (!intentFresh) lastUserText = "";
			intentFresh = false;

			const cwd = ctx?.cwd;
			if (!cwd || !isManualContext(cwd)) return;
			const prompt = (event as { systemPrompt?: string })?.systemPrompt ?? "";
			if (prompt.includes("本项目处于手动提交模式")) return;
			return { systemPrompt: `${prompt}\n\n${manualPrompt(cwd)}` };
		} catch {
			// 注入失败不阻塞会话
		}
	});

	// ② 下限防线：手动模式下，用户没要求就拦下 git add / git commit
	pi.on("tool_call", async (event, ctx) => {
		try {
			if (!isToolCallEventType("bash", event)) return;
			const command = event.input.command ?? "";
			const sub = gitWriteSubcommand(command);
			if (!sub) return;

			const cwd = ctx?.cwd ?? process.cwd();
			const manualTarget = candidatePaths(command, cwd).find(isManualPath);
			if (!manualTarget) return;
			if (userAskedToCommit(lastUserText)) return;

			const repo = repoRoot(manualTarget);
			return {
				block: true,
				reason:
					`[commit-mode-guard] 拦截：${repo} 处于手动提交模式（commit-mode），` +
					`AI 不能自行发起 git ${sub}。用户本轮消息里没有提交要求。\n` +
					`正确做法：把改动留在工作区，向用户说明「改动已就绪，需要提交时告诉我或敲 /commit」。` +
					`若用户确实当轮要求了提交而仍被拦，请在汇报里说明并请用户确认（不要反复重试）。`,
			};
		} catch {
			// 判定异常时不阻塞会话（与其它 guard 一致）
		}
	});
}
