/**
 * 本机私有规则文件加载器：`AGENTS.local.md`（pi 端，before_agent_start 追加进系统提示）。
 *
 * 为什么有它：pi 只认 5 个上下文文件名（`AGENTS.override.md` / `AGENTS.md` / `AGENTS.MD` /
 * `CLAUDE.md` / `CLAUDE.MD`（后两个已弃用、仅向后兼容），见 `dist/core/resource-loader.js` 的 `loadContextFileFromDir()`），
 * **没有 `.local.md` 这类「私有 / 不进 git」的变体**。于是「本机私有规则」只能混进会被提交的
 * AGENTS.md，或者靠每次手动点名去读——前者会泄露，后者靠自觉。本扩展补上这一层。
 *
 * 语义（2026-11-05 用户定）：
 *   - **追加，不替代**：`AGENTS.local.md` 与同目录的 `AGENTS.md` 并行生效，
 *     功能等价于 `.pi/APPEND_SYSTEM.md`（都是往系统提示后面加），但「local」把「私有不公开」
 *     写进了文件名本身，比 APPEND_SYSTEM 更明确；
 *   - **搜索范围与 AGENTS.md 同构**：全局 `~/.pi/agent/` 优先，然后从 cwd 逐级向上到根，每级
 *     目录最多取一个（`AGENTS.local.md` / `AGENTS.LOCAL.MD`），最后按「远的在前、近的在后」拼接；
 *   - **`-nc` / `--no-context-files` 时一并跳过**：用户显式要干净提示时，私有规则也不该溜进去。
 *
 * 私有 = 不得进 git，所以加载前**强制安全检查**（这是本扩展的核心价值，不是可选项）：
 *   ① 不在 git 工作树内（无仓库可泄露）→ 放行；
 *   ② 已被 git 跟踪（`git ls-files --error-unmatch` 命中）→ **拒绝加载**。注意这一条最要命：
 *      `.gitignore` 对**已跟踪**文件无效，文件明明匹配忽略规则、却仍会随仓库分发；
 *   ③ 未被忽略（`git check-ignore` 返回「未忽略」）→ **拒绝加载**；
 *   ④ 只有「在 git 仓库里 + 未被跟踪 + 已被忽略」才真正加载。
 * 拒绝加载时不静默：把被拒文件、原因和处置办法作为一段提示注入系统提示，让当前会话告诉用户
 * 去补 `.gitignore`（AI 不得自行 `git rm --cached`——暂存区红线）。
 *
 * 性能：文件内容按 mtime+size 缓存；git 检查结果按 mtime+size 缓存 10 秒（`.gitignore` 改了
 * 但文件没变时靠这个 TTL 兜住），避免每轮对话都 fork git 进程。
 *
 * 局限（诚实）：只认 `AGENTS.local.md` 这一个名字，不认 `CLAUDE.local.md`（用户 2026-11-05
 * 明确只要求 AGENTS.local.md）；判定全部防御性 catch，本扩展失灵时不阻塞会话。
 */

import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const HOME = homedir();
const GLOBAL_DIR = join(HOME, ".pi", "agent");
/** 与 pi 一样接受大写扩展名写法（大小写敏感的文件系统上才有区别）。 */
const FILE_NAMES = ["AGENTS.local.md", "AGENTS.LOCAL.MD"];
const SECTION = "local_context";
/** 单文件上限：系统提示不该被子类文件撑爆。 */
const MAX_BYTES = 64 * 1024;
/** git 检查结果的有效期（毫秒）：.gitignore 改了但文件没改时靠它刷新。 */
const GIT_TTL_MS = 10_000;

const HEADER =
	"以下 `AGENTS.local.md` 是本机私有规则（不进 git、不随仓库公开），已按追加语义并入系统提示。" +
	"它与同目录的 `AGENTS.md` 并行生效、不替代它，冲突时以更具体、更新的规则为准。";

const REJECT_NOTE =
	"上面 `<rejected>` 列出的文件因未通过安全校验**没有加载**，内容未进入上下文。" +
	"请告知用户处理：把该文件名（或 `*.local.md`）写进所在仓库的 `.gitignore`；" +
	"若文件已被 git 跟踪，`git rm --cached` 移出索引须由用户决定并执行——AI 不得自行改动暂存区。";

const contentCache = new Map<string, { sig: string; text: string }>();
const gitCache = new Map<string, { sig: string; at: number; ok: boolean; reason?: string }>();

function escapeXml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function runGit(cwd: string, args: string[]): { status: number; stdout: string } {
	try {
		const stdout = execFileSync("git", ["-C", cwd, ...args], {
			encoding: "utf-8",
			timeout: 5000,
			stdio: ["ignore", "pipe", "ignore"],
		});
		return { status: 0, stdout: stdout ?? "" };
	} catch (error) {
		const e = error as { status?: number; stdout?: string | Buffer };
		const status = typeof e?.status === "number" ? e.status : 1;
		return { status, stdout: typeof e?.stdout === "string" ? e.stdout : "" };
	}
}

/** 该文件能否安全加载（私有文件不得进 git）。 */
function evaluateGit(file: string): { ok: boolean; reason?: string } {
	const dir = dirname(file);
	const base = file.slice(file.lastIndexOf("/") + 1).slice(file.lastIndexOf("\\") + 1);

	const inside = runGit(dir, ["rev-parse", "--is-inside-work-tree"]);
	if (inside.status !== 0 || inside.stdout.trim() !== "true") {
		return { ok: true }; // 不在 git 工作树里：没有提交泄露的通道
	}

	const tracked = runGit(dir, ["ls-files", "--error-unmatch", "--", base]);
	if (tracked.status === 0) {
		return { ok: false, reason: "已被 git 跟踪（.gitignore 对已跟踪文件无效，仍会随仓库分发）" };
	}

	const ignored = runGit(dir, ["check-ignore", "-q", "--", base]);
	if (ignored.status === 0) return { ok: true };
	if (ignored.status === 1) return { ok: false, reason: "未被 .gitignore 忽略" };
	return { ok: false, reason: `无法确认是否被忽略（git check-ignore 退出码 ${ignored.status}）` };
}

function gitAllowed(file: string, sig: string): { ok: boolean; reason?: string } {
	const cached = gitCache.get(file);
	const now = Date.now();
	if (cached && cached.sig === sig && now - cached.at < GIT_TTL_MS) {
		return { ok: cached.ok, reason: cached.reason };
	}
	const result = evaluateGit(file);
	gitCache.set(file, { sig, at: now, ok: result.ok, reason: result.reason });
	return result;
}

function readLocal(file: string, sig: string): string | null {
	const cached = contentCache.get(file);
	if (cached && cached.sig === sig) return cached.text;
	try {
		const raw = readFileSync(file, "utf-8");
		const text =
			Buffer.byteLength(raw, "utf-8") > MAX_BYTES
				? `${raw.slice(0, MAX_BYTES)}\n\n（本文件超过 ${Math.round(MAX_BYTES / 1024)} KB，已在截断处停止加载）`
				: raw;
		const trimmed = text.replace(/^\uFEFF/, "").trim();
		contentCache.set(file, { sig, text: trimmed });
		return trimmed;
	} catch {
		return null;
	}
}

/** 收集待加载文件：全局目录优先，然后从根到 cwd 逐级（每级最多一个），按 realpath 去重。 */
function findLocalFiles(cwd: string): string[] {
	const dirs: string[] = [GLOBAL_DIR];
	const chain: string[] = [];
	let dir = resolve(cwd);
	for (;;) {
		chain.unshift(dir);
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	dirs.push(...chain);

	const seen = new Set<string>();
	const found: string[] = [];
	for (const d of dirs) {
		for (const name of FILE_NAMES) {
			const candidate = join(d, name);
			try {
				if (!statSync(candidate).isFile()) continue;
			} catch {
				continue;
			}
			let real = candidate;
			try {
				real = realpathSync.native(candidate);
			} catch {
				// 软链接失效时保留原路径，交给后面读取时报错
			}
			if (seen.has(real)) continue;
			seen.add(real);
			found.push(candidate);
			break;
		}
	}
	return found;
}

/** 拼出注入用的 section 内容；没有任何文件时返回 null（不产生提示补丁）。 */
function buildSection(cwd: string): string | null {
	let files: string[];
	try {
		files = findLocalFiles(cwd);
	} catch {
		return null;
	}
	if (files.length === 0) return null;

	const loaded: string[] = [];
	const rejected: string[] = [];
	for (const file of files) {
		let sig: string;
		try {
			const st = statSync(file);
			sig = `${st.mtimeMs}:${st.size}`;
		} catch {
			continue;
		}

		const gate = gitAllowed(file, sig);
		if (!gate.ok) {
			rejected.push(`<rejected path="${escapeXml(file)}" reason="${escapeXml(gate.reason ?? "未通过安全检查")}" />`);
			continue;
		}

		const text = readLocal(file, sig);
		if (text === null || text === "") continue;
		loaded.push(`<file path="${escapeXml(file)}">\n${text}\n</file>`);
	}

	if (loaded.length === 0 && rejected.length === 0) return null;
	const parts: string[] = [];
	if (loaded.length > 0) parts.push(HEADER, ...loaded);
	if (rejected.length > 0) parts.push(REJECT_NOTE, ...rejected);
	return parts.join("\n\n");
}

/** `-nc` / `--no-context-files` 时与 AGENTS.md 一样不加载。 */
function contextFilesDisabled(): boolean {
	const argv = process.argv ?? [];
	return argv.includes("-nc") || argv.includes("--no-context-files") || argv.includes("--no-context");
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event, ctx) => {
		try {
			if (contextFilesDisabled()) return;

			const options = (event as { systemPromptOptions?: { sections?: Record<string, string>; cwd?: string } })
				?.systemPromptOptions;
			const cwd = (ctx as { cwd?: string })?.cwd ?? options?.cwd ?? process.cwd();

			const section = buildSection(cwd);
			if (!section) return;

			// 首选结构化 sections：pi 只 diff 变化的 section，缓存不被打穿。
			if (options && typeof options === "object") {
				if (!options.sections || typeof options.sections !== "object") options.sections = {};
				options.sections[SECTION] = section;
				return;
			}

			// 兜底：没有结构化选项时退化成直接追加整段提示。
			const prompt = (event as { systemPrompt?: string })?.systemPrompt ?? "";
			if (!prompt) return;
			return { systemPrompt: `${prompt}\n\n<${SECTION}>\n${section}\n</${SECTION}>` };
		} catch {
			// 加载失败不影响会话
		}
	});
}
