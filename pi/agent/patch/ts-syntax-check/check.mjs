#!/usr/bin/env node
/**
 * 扩展代码语法检查（独立命令行工具，2026-11-05 建）。
 *
 * 为什么需要独立脚本：pi 加载扩展时只要有一个文件解析失败就 `exit(1)`（打印
 * `Failed to load extension …: ParserError: …` 和 `Hint: Start without extensions
 * using "pi -ne"`），所以改完扩展代码必须能**在启动 pi 之前**验一遍。会话里的
 * `ts-syntax-guard.ts` 扩展负责拦写入，这个脚本负责「事后批量核对」——典型场景：
 * 把 `~/.pi/agent` 同步到开源镜像仓库之前 / 之后，成批复制完再核一次。
 *
 * 用的解析器与 pi 启动时完全一致：Node 内建 `module.stripTypeScriptTypes`
 * （底层 amaro / swc，pi 报的 `Missing semicolon.` 就是它）。因此这里报错的文件，
 * pi 一定起不来；这里通过的文件，pi 一定能解析。
 *
 * 用法：
 *   node ~/.pi/agent/patch/ts-syntax-check/check.mjs                 # 检查默认目录
 *   node ~/.pi/agent/patch/ts-syntax-check/check.mjs <目录> [目录…]  # 检查指定目录
 *
 * 默认目录：`~/.pi/agent/extensions`、当前目录的 `.pi/extensions`、传参目录。
 * 退出码：0 = 全部通过；1 = 有文件解析失败（逐个列出位置与代码片段）。
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** pi 会加载的后缀；.tsx / .jsx 跳过（Node 类型擦除不支持 JSX，硬判会误报）。 */
const CHECKED_EXTS = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);

/** 临时吞掉 Node 针对 stripTypeScriptTypes 的 ExperimentalWarning。 */
function withWarningSuppressed(fn) {
	const original = process.emitWarning;
	process.emitWarning = function patched(warning, ...rest) {
		const text = typeof warning === "string" ? warning : (warning?.message ?? "");
		if (text.includes("stripTypeScriptTypes")) return;
		return original.call(process, warning, ...rest);
	};
	try {
		return fn();
	} finally {
		process.emitWarning = original;
	}
}

/** 解析一段代码，返回错误描述或 null。 */
function checkCode(code) {
	try {
		withWarningSuppressed(() => stripTypeScriptTypes(code, { mode: "transform" }));
		return null;
	} catch (error) {
		const message = error?.message ?? String(error);
		const stack = String(error?.stack ?? "");
		const frame = [];
		for (const line of stack.split("\n")) {
			if (/^\w*Error\b/.test(line.trim())) break;
			frame.push(line);
			if (frame.length > 12) break;
		}
		const lineMatch = frame[0]?.match(/^:(\d+)$/);
		return { message, line: lineMatch ? Number(lineMatch[1]) : null, frame: frame.join("\n").trim() };
	}
}

/** 递归收集候选文件。 */
function collect(dir, out = []) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out; // 目录不存在
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			collect(full, out);
			continue;
		}
		if (!entry.isFile()) continue;
		const dot = entry.name.lastIndexOf(".");
		const ext = dot < 0 ? "" : entry.name.slice(dot).toLowerCase();
		if (CHECKED_EXTS.has(ext)) out.push(full);
	}
	return out;
}

const targets = process.argv.slice(2);
const roots = targets.length > 0 ? targets.map((p) => resolve(p)) : [join(homedir(), ".pi", "agent", "extensions"), join(process.cwd(), ".pi", "extensions")];

const files = [...new Set(roots.flatMap((root) => collect(root)))];
let failed = 0;
for (const file of files) {
	let code;
	try {
		code = readFileSync(file, "utf8");
	} catch {
		continue;
	}
	const problem = checkCode(code);
	if (!problem) continue;
	failed += 1;
	console.error(`❌ ${file}`);
	console.error(`   ${problem.message}${problem.line === null ? "" : `（第 ${problem.line} 行附近）`}`);
	if (problem.frame) {
		for (const line of problem.frame.split("\n")) console.error(`   ${line}`);
	}
	console.error("");
}

if (failed > 0) {
	console.error(`共 ${failed} / ${files.length} 个文件语法错误——这些扩展会让 \`pi\` 直接起不来，先修好再启动。`);
	process.exit(1);
}
console.log(`✅ ${files.length} 个扩展文件语法全部通过（解析器：Node stripTypeScriptTypes，与 pi 加载器一致）。`);
