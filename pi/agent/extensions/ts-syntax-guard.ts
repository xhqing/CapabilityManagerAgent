/**
 * 扩展代码语法守卫（pi 端：写入前硬拦 + 写入后提醒）。
 *
 * 2026-11-05 立规（用户原话：「这个问题太严重了，如何避免下次再出现这个问题？」）。
 *
 * 起因：2026-11-04 23:43 改 `extensions/macmini-use/index.ts` 时，在模板字符串里
 * 写了一对**未转义的反引号**（`只有 \`~/.pi/agent\` 与 …`），模板字符串被提前闭合，
 * 整个扩展文件解析失败。pi 的加载策略是「任一扩展加载失败 = 打印诊断并 `exit(1)`」，
 * 于是**下一次 `pi` 直接起不来**（`ParserError: Missing semicolon.` +
 * `Hint: Start without extensions using "pi -ne"`）——一个字符的疏漏把整个 agent
 * 变成不可用状态，直到人工修好为止。
 *
 * 为什么必须工具强制：这类错误**无法靠自觉避免**——它不是语义问题，是「少写一个
 * 反斜杠」，写的时候眼睛看着内容、不会盯着转义；而且报错发生在**下一次启动**，
 * 当场没有任何反馈，改的人根本不知道自己已经炸了。规则写在 CLAUDE.md 里也拦不住
 * （写的时候不会去翻规则），只有让"坏内容根本落不了盘"才管用。
 *
 * 两层强制：
 *
 * 1. **tool_call（前置硬拦，主力）**：`write` / `edit` 的目标落在扩展目录里时，先把
 *    「写入后的完整内容」算出来（write 取 content；edit 按 `edits[]` 在原文上模拟
 *    替换），用 **pi 加载器自己的解析器**（Node 内建 `stripTypeScriptTypes`，底层是
 *    amaro / swc——与 pi 启动时报 `Missing semicolon.` 的是同一个解析器）做语法校验。
 *    有语法错就 block，并给出错误位置、代码片段、以及「下一次 pi 会起不来」的后果
 *    说明。**不放行**：写坏的扩展一定会让 pi 崩，没有"先存着待会儿修"的余地。
 *
 * 2. **tool_result（后置提醒，兜底）**：`bash` 执行后对比扩展目录里各文件的 mtime，
 *    发现被改动的逐个复检——覆盖 `cat >`、`tee`、`sed -i`、`cp`、`mv`、python 写文件
 *    这些绕过前置判断的写入方式。坏了就**在工具结果里追加醒目告警**（事后无法回滚，
 *    但让模型当轮就知道、立刻去修，而不是等到下次启动才发现）。
 *
 * 只管「pi 启动时会加载的扩展代码」：`~/.pi/agent/extensions/**`、`<cwd>/.pi/extensions/**`
 * 下的 `.ts` / `.mts` / `.cts` / `.js` / `.mjs` / `.cjs`。`.tsx` / `.jsx` 跳过（Node 的
 * 类型擦除不支持 JSX，硬判会误报）。技能脚本、普通源码、第三方 npm 包都不管——它们
 * 写坏了不会让 pi 起不来。
 *
 * 逃生门（极少用）：`~/.pi/agent/state/ts-syntax-guard-off` 存在时整个守卫停用。
 * 只用于「解析器本身误报」这种极端情况；正常改代码永远不需要它——解析器错了就修
 * 代码，因为 pi 用的就是同一个解析器。
 *
 * 判定全程防御性 catch：守卫自身失灵时不阻塞会话（与其它 guard 一致）。
 */

import { readdirSync, statSync, readFileSync, realpathSync } from "node:fs";
import * as nodeModule from "node:module";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** 需要检查的扩展代码后缀（pi 启动时会加载的类型）。 */
const CHECKED_EXTS = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);

/** 明确跳过：Node 类型擦除不支持 JSX，硬判会误报。 */
const SKIPPED_EXTS = new Set([".tsx", ".jsx"]);

/** 关掉守卫的开关文件（存在即停用）。 */
const OFF_FILE = join(homedir(), ".pi", "agent", "state", "ts-syntax-guard-off");

/** Node 内建的 TS 类型擦除（>= 22.13 才有；没有就退化成本地 esbuild / 跳过）。 */
const stripTypeScriptTypes = (nodeModule as Record<string, unknown>).stripTypeScriptTypes as
	| ((code: string, options?: { mode?: "strip" | "transform"; sourceMap?: boolean }) => string)
	| undefined;

export interface SyntaxProblem {
	/** 解析器给的错误描述（如 "Expected a semicolon"）。 */
	message: string;
	/** 出错行号（解析器没给就是 null）。 */
	line: number | null;
	/** 解析器返回的代码片段（带 ^ 指示位置），可能为空。 */
	frame: string;
}

/**
 * 对一段代码做语法校验，没问题返回 null。
 *
 * 用 `stripTypeScriptTypes(mode: "transform")` 而不是 `strip`：后者拒绝 `enum` /
 * `namespace` 这类需要真正转换的语法（会误报），前者与 pi 实际加载路径一致。
 * 调用期间临时吞掉 Node 的 `ExperimentalWarning`，避免每次写入都在会话里刷警告。
 */
export function checkSyntax(code: string): SyntaxProblem | null {
	if (!stripTypeScriptTypes) return null; // 老 Node：静默降级
	const originalEmitWarning = process.emitWarning;
	process.emitWarning = function patched(warning: unknown, ...rest: unknown[]) {
		const text =
			typeof warning === "string" ? warning : ((warning as { message?: string } | null)?.message ?? "");
		if (text.includes("stripTypeScriptTypes")) return; // 唯一的噪音源，吞掉
		return (originalEmitWarning as (...args: unknown[]) => void).call(process, warning, ...rest);
	} as typeof process.emitWarning;
	try {
		stripTypeScriptTypes(code, { mode: "transform" });
		return null;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const stack = error instanceof Error ? String(error.stack ?? "") : "";
		// 解析器的 stack 开头是代码片段（形如 ":52\n<code>\n   ^"），取到 SyntaxError 那行为止
		const frameLines: string[] = [];
		for (const line of stack.split("\n")) {
			if (/^\w*Error\b/.test(line.trim())) break;
			frameLines.push(line);
			if (frameLines.length > 12) break;
		}
		const lineMatch = frameLines[0]?.match(/^:(\d+)$/);
		return {
			message,
			line: lineMatch ? Number(lineMatch[1]) : null,
			frame: frameLines.join("\n").trim(),
		};
	} finally {
		process.emitWarning = originalEmitWarning;
	}
}

/** 当前会话需要盯的扩展目录（全局 + 当前项目）。 */
export function extensionRoots(cwd: string | undefined): string[] {
	const roots = [join(homedir(), ".pi", "agent", "extensions")];
	if (cwd) roots.push(join(cwd, ".pi", "extensions"));
	return roots;
}

/**
 * 尽量拿到真实路径（解析软链）。文件不存在时退回解析父目录，再保留文件名。
 *
 * 为什么必须做：macOS 上 `/tmp` 是指向 `/private/tmp` 的软链，`resolve()` 不会解开它，
 * 于是「文件路径」与「从 cwd 算出的目录」字面上对不上，字符串 startsWith 会漏判
 * （实测 `/tmp/tstest/.pi/extensions/foo.ts` 就因此被放过了）。用户目录也可能是软链。
 */
function realish(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		// 文件还不存在（新建）：解析父目录
	}
	try {
		return join(realpathSync(dirname(path)), basename(path));
	} catch {
		return resolve(path);
	}
}

/** 该路径是不是「pi 启动时会加载的扩展代码」（在扩展目录里 + 后缀对）。 */
export function isExtensionFile(path: string, cwd: string | undefined): boolean {
	if (!path) return false;
	const ext = extname(path).toLowerCase();
	if (SKIPPED_EXTS.has(ext)) return false;
	if (!CHECKED_EXTS.has(ext)) return false;
	const abs = realish(path);
	return extensionRoots(cwd).some((root) => abs.startsWith(realish(root) + sep));
}

/** 守卫是否被总开关关掉。 */
function guardDisabled(): boolean {
	try {
		statSync(OFF_FILE);
		return true;
	} catch {
		return false;
	}
}

/**
 * 按 edit 工具的语义在原文上模拟 `edits[]`（每个 oldText 对**原文**匹配、必须唯一、
 * 互不重叠）。任何一步模拟不了返回 null（交给 edit 工具自己报错）。
 */
export function simulateEdits(original: string, edits: unknown): string | null {
	const list = Array.isArray(edits) ? edits : edits && typeof edits === "object" ? [edits] : null;
	if (!list || list.length === 0) return null;

	type Span = { start: number; end: number; newText: string };
	const spans: Span[] = [];
	for (const raw of list) {
		if (!raw || typeof raw !== "object") return null;
		const entry = raw as Record<string, unknown>;
		const oldText = typeof entry.oldText === "string" ? entry.oldText : entry.old_string;
		const newText = typeof entry.newText === "string" ? entry.newText : entry.new_string;
		if (typeof oldText !== "string" || typeof newText !== "string" || oldText === "") return null;
		const first = original.indexOf(oldText);
		if (first < 0) return null;
		if (original.indexOf(oldText, first + 1) >= 0) return null;
		spans.push({ start: first, end: first + oldText.length, newText });
	}
	spans.sort((a, b) => a.start - b.start);
	for (let i = 1; i < spans.length; i++) {
		if (spans[i].start < spans[i - 1].end) return null;
	}
	let out = "";
	let cursor = 0;
	for (const span of spans) {
		out += original.slice(cursor, span.start) + span.newText;
		cursor = span.end;
	}
	return out + original.slice(cursor);
}

/** 递归收集扩展目录下的候选文件（跳过 node_modules / 隐藏目录）。 */
export function collectExtensionFiles(roots: string[], maxDepth = 4, depth = 0): string[] {
	const out: string[] = [];
	for (const root of roots) {
		let entries: import("node:fs").Dirent[];
		try {
			entries = readdirSync(root, { withFileTypes: true });
		} catch {
			continue; // 目录不存在
		}
		for (const entry of entries) {
			if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
			const full = join(root, entry.name);
			if (entry.isDirectory()) {
				if (depth < maxDepth) out.push(...collectExtensionFiles([full], maxDepth, depth + 1));
				continue;
			}
			if (!entry.isFile()) continue;
			const ext = extname(entry.name).toLowerCase();
			if (CHECKED_EXTS.has(ext)) out.push(full);
		}
	}
	return out;
}

/** 把一处语法问题渲染成给人看的说明。 */
export function describe(path: string, problem: SyntaxProblem): string {
	return [
		`\`${path}\` 语法错误：${problem.message}${problem.line === null ? "" : `（第 ${problem.line} 行附近）`}`,
		problem.frame ? "```\n" + problem.frame + "\n```" : "",
	]
		.filter(Boolean)
		.join("\n");
}

const BLOCK_REASON = [
	"[ts-syntax-guard] 拦截：这次写入会让扩展代码出现语法错误，**下一次 `pi` 将无法启动**。",
	"",
	"背景（2026-11-05 立规）：pi 加载扩展时，只要有任何一个扩展文件解析失败，就会打印",
	'`Error: Failed to load extension "…": ParserError: …` 然后直接 exit(1)——整个 agent',
	"变成不可用状态，只能人工修好再启动（2026-11-04 就是这么被一个未转义的反引号搞崩的）。",
	"所以坏内容不允许落盘，请在这一次写入里就改成合法代码。",
	"",
	"常见成因：",
	"1. **模板字符串里写了未转义的反引号**——` 包起来的字符串内部要用 `\\`` （最常犯）；",
	"2. 字符串没闭合、括号 / 花括号不配对、`return` 后面漏了分号之外的拼接运算符；",
	"3. 复制粘贴带进了不可见字符或半截语法。",
	"",
	"改完直接重发这次写入即可。确实认为解析器误报时，才去建",
	`\`${OFF_FILE}\` 临时停用本守卫（正常改代码永远用不到）。`,
].join("\n");

/** 后置提醒的文案。 */
function warnText(items: { path: string; problem: SyntaxProblem }[]): string {
	const lines = [
		"",
		"⚠️ [ts-syntax-guard] 检测到扩展代码语法错误——**下一次 `pi` 会起不来**（加载扩展失败即 exit(1)），请立刻修好：",
	];
	for (const item of items) lines.push("", describe(item.path, item.problem));
	lines.push(
		"",
		"常见成因：模板字符串里未转义的反引号（写成 `\\``）、字符串未闭合、括号不配对。",
		"独立复核命令：`node ~/.pi/agent/patch/ts-syntax-check/check.mjs`（可带目录参数）。",
	);
	return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
	/** bash 写入后的 mtime 基线（懒初始化：第一次调用只记现状，不报警）。 */
	let baseline: Map<string, number> | null = null;
	/** 已提醒过的 path + mtime，避免同一处反复刷屏。 */
	const warned = new Set<string>();

	/**
	 * 把当前所有扩展文件的 mtime 记成基线（只在基线为空时做）。
	 *
	 * 为什么必须在本工具执行**之前**初始化：基线的意义是「动手前的状态」，如果等
	 * `tool_result` 才初始化，那么会话里的**第一次** bash 写入就正好把基线记成了
	 * 「写完后的状态」，改完再比等于没变、警告永远不出来（实测踩过：第一次 `cat >`
	 * 写坏扩展文件没任何提示）。所以 `tool_call` 里先调本函数。
	 */
	const ensureBaseline = (cwd: string | undefined): void => {
		if (baseline !== null) return;
		const map = new Map<string, number>();
		for (const file of collectExtensionFiles(extensionRoots(cwd))) {
			try {
				map.set(file, statSync(file).mtimeMs);
			} catch {
				// 读不到就跳过
			}
		}
		baseline = map;
	};

	/** 记录 / 对比扩展文件 mtime，返回本次新改动且语法错误的文件。 */
	const scanChanged = (cwd: string | undefined): { path: string; problem: SyntaxProblem }[] => {
		const files = collectExtensionFiles(extensionRoots(cwd));
		const changed: { path: string; problem: SyntaxProblem }[] = [];
		const nextBaseline = new Map<string, number>();
		for (const file of files) {
			let mtime = 0;
			try {
				mtime = statSync(file).mtimeMs;
			} catch {
				continue;
			}
			nextBaseline.set(file, mtime);
			const previous = baseline?.get(file);
			if (previous === undefined || previous === mtime) continue; // 没改过
			let code = "";
			try {
				code = readFileSync(file, "utf8");
			} catch {
				continue;
			}
			const problem = checkSyntax(code);
			if (!problem) continue;
			const key = `${file}:${mtime}`;
			if (warned.has(key)) continue;
			warned.add(key);
			changed.push({ path: file, problem });
		}
		baseline = nextBaseline;
		return changed;
	};

	// 第一层：写入前硬拦
	pi.on("tool_call", async (event, ctx) => {
		try {
			if (guardDisabled()) return;
			const cwd = ctx?.cwd ?? process.cwd();
			ensureBaseline(cwd); // 记下「动手前」的 mtime，后置对比才有参照
			const input = event.input as Record<string, unknown>;
			const path = typeof input.path === "string" ? input.path : "";
			if (!path || !isExtensionFile(path, cwd)) return;

			let next: string | null = null;
			if (event.toolName === "write") {
				if (typeof input.content === "string") next = input.content;
			} else if (event.toolName === "edit") {
				let original: string | null = null;
				try {
					original = readFileSync(path, "utf8");
				} catch {
					original = null;
				}
				next = original === null ? null : simulateEdits(original, input.edits);
			}
			if (next === null) return; // 算不出来：交给 edit 工具自己报错，或后置提醒

			const problem = checkSyntax(next);
			if (!problem) return;

			return {
				block: true,
				reason: [BLOCK_REASON, "", describe(path, problem), "", `目标文件：${path}`].join("\n"),
			};
		} catch {
			// 守卫自身异常不阻塞会话
		}
	});

	// 第二层：shell 等旁路写入后的后置提醒
	pi.on("tool_result", async (event, ctx) => {
		try {
			if (guardDisabled()) return;
			if (event.isError) return;
			if (event.toolName !== "bash") return;
			const cwd = ctx?.cwd ?? process.cwd();
			const found = scanChanged(cwd);
			if (found.length === 0) return;
			const text = warnText(found);
			if (Array.isArray(event.content)) {
				return { content: [...event.content, { type: "text" as const, text }] };
			}
			return { content: [{ type: "text" as const, text }] };
		} catch {
			// 防御性放行
		}
	});
}
