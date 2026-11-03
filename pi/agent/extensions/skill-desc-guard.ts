/**
 * Skill description 长度守卫（pi 端，tool_call 拦截 + tool_result 兜底）。
 *
 * 2026-11-03 用户立规（全局 CLAUDE.md「Skill 编写纪律」的配套工具）：
 * skill 的 `description` 是**硬上限 1024 字符**（Agent Skills spec，pi 按 JS
 * `string.length` 计数：一个汉字 1、一个 emoji 2），超了 pi 每次启动都会打
 * `[Skill conflicts] description exceeds 1024 characters` 警告，且 skill 的
 * 触发描述会被截断。规则本来就写在 `skills/skill-creator/SKILL.md` 里
 * （"hard gate —— 量它，别凭感觉"），但**同一个错犯了太多次**（2026-11-03
 * 实测 add 1069 / commit 1111 双双超限），用户原话：「下次改 skill 的时候
 * 记住不要超过 1024 characters，记不住就工具强制」。
 *
 * 强制方式（两层）：
 * 1. **tool_call（前置硬拦）**：`write` / `edit` 目标为 `SKILL.md` 时，先把
 *    「写入后的完整内容」算出来（write 取 content；edit 按 edits[] 在原文上
 *    模拟替换），提取 frontmatter 里的 description 量长度，超限即 block，
 *    并告知本次写入后的长度、原文长度、还差多少、怎么改（把流程细节挪进
 *    正文，保留触发词——那才是 Progressive Disclosure 的正解）。
 * 2. **tool_result（后置提醒）**：写 / 编辑 / shell 命令执行后，实测磁盘上
 *    该 SKILL.md 的 description 长度；若超限（例如模拟失败放过了、或 shell
 *    重定向 / sed -i 绕过前置判断），在工具结果末尾追加提醒，让模型当轮就
 *    知道要修——不阻断，但绝不静默。
 *
 * 判定细节（避免把「正在修老账」也拦死）：
 * - 结果 ≤ 1024 → 放行；
 * - 结果 > 1024，但**本次没动 description**（结果值 === 原值）→ 放行（历史
 *   欠账不该拦住正文编辑），由后置提醒提示去修；
 * - 结果 > 1024，原文件也超限但**本次让它变短了** → 放行（允许分步压缩到线内）；
 * - 其余（本次写入把 description 推过线、或原已超限而本次没减小）→ 拦截。
 *
 * 明确不拦：非 `SKILL.md` 的 markdown（references / README / 文档）；没有
 * frontmatter description 的文件（不是 skill，判不了也不该猜）。
 *
 * 逃生门：**没有**。1024 是 spec 硬上限，超了就是错的，pi 会一直告警——正确
 * 动作是把长度压下来，不是绕过检查。
 *
 * 判定全程防御性 catch：本扩展失灵时不阻塞会话（与 pi-dir-guard /
 * git-commit-guard 等一致）。长度的唯一权威仍是 pi 加载器本身（与
 * `skills/skill-creator/scripts/check_description.py` 同口径，均为 UTF-16
 * code units）。
 */

import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Agent Skills spec 的 description 硬上限（字符 / UTF-16 code units）。 */
export const MAX_DESC = 1024;

/** 只约束 skill 的元数据文件；文件名大小写与 pi 加载器一致（大写 SKILL.md）。 */
export const SKILL_BASENAME = "SKILL.md";

/** 本次会话已经提醒过的 path + 长度，避免同一问题反复刷屏。 */
const warned = new Set<string>();

/** JS `string.length` 语义（UTF-16 code units），与 pi 加载器完全相同。 */
export function descLength(desc: string): number {
	return desc.length;
}

/**
 * 从 SKILL.md 文本中提取 frontmatter 的 description 值。
 * 与 `skills/skill-creator/scripts/check_description.py` 的解析保持一致：
 * 支持单行（带引号 / 裸值）与块标量（`|`、`>` 及其 chomping 变体）。
 */
export function extractDescription(text: string): string | null {
	const fmMatch = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
	if (!fmMatch) return null;
	const lines = fmMatch[1].split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const stripped = lines[i].trim();
		if (!stripped.startsWith("description:")) continue;
		const value = stripped.slice("description:".length).trim();

		// 块标量：收集后续缩进行（空行保留，用于 `|` 的换行折叠）
		if (value === "|" || value === "|-" || value === "|+" || value === ">" || value === ">-" || value === ">+") {
			const block: string[] = [];
			for (let j = i + 1; j < lines.length; j++) {
				const cont = lines[j];
				if (cont.trim() === "") {
					block.push("");
					continue;
				}
				if (cont.startsWith(" ") || cont.startsWith("\t")) {
					block.push(cont.trim());
					continue;
				}
				break;
			}
			const joined = value.startsWith("|") ? block.join("\n") : block.filter(Boolean).join(" ");
			const out = joined.trim();
			return out || null;
		}

		// 单行值：剥掉一对匹配的引号（YAML 的引号风格，不做转义还原）
		let v = value;
		if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) {
			v = v.slice(1, -1);
		}
		return v.trim() || null;
	}
	return null;
}

/**
 * 按 edit 工具的语义在原文上模拟 `edits[]`（每个 oldText 都对着**原文**匹配、
 * 必须唯一、互不重叠）。任何一步模拟不了就返回 null（交给后置提醒兜底）。
 */
export function simulateEdits(original: string, edits: unknown): string | null {
	const list = Array.isArray(edits) ? edits : edits && typeof edits === "object" ? [edits] : null;
	if (!list || list.length === 0) return null;

	type Span = { start: number; end: number; newText: string };
	const spans: Span[] = [];
	for (const raw of list) {
		if (!raw || typeof raw !== "object") return null;
		const e = raw as Record<string, unknown>;
		const oldText = typeof e.oldText === "string" ? e.oldText : e.old_string;
		const newText = typeof e.newText === "string" ? e.newText : e.new_string;
		if (typeof oldText !== "string" || typeof newText !== "string" || oldText === "") return null;

		const first = original.indexOf(oldText);
		if (first < 0) return null; // 原文里没有：edit 工具本身会报错，不归本守卫管
		if (original.indexOf(oldText, first + 1) >= 0) return null; // 不唯一：交给 edit 工具报错
		spans.push({ start: first, end: first + oldText.length, newText });
	}

	spans.sort((a, b) => a.start - b.start);
	for (let i = 1; i < spans.length; i++) {
		if (spans[i].start < spans[i - 1].end) return null; // 重叠：同样交给 edit 工具报错
	}

	let out = "";
	let cursor = 0;
	for (const span of spans) {
		out += original.slice(cursor, span.start) + span.newText;
		cursor = span.end;
	}
	return out + original.slice(cursor);
}

type DescStat = { length: number; desc: string } | null;

/** 量一段文本里的 description；没有 frontmatter / 没有 description 返回 null。 */
export function measure(text: string): DescStat {
	const desc = extractDescription(text);
	if (desc === null) return null;
	return { length: descLength(desc), desc };
}

/** 量磁盘上的 SKILL.md；读不到 / 解析不出返回 null。 */
export function measureFile(path: string): DescStat {
	try {
		return measure(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

/** 该路径是不是 skill 元数据文件（只按文件名判，任何目录下的 SKILL.md 都算）。 */
export function isSkillFile(path: string): boolean {
	return basename(path.replace(/[\\/]+$/, "")) === SKILL_BASENAME;
}

/**
 * 判定一次写入是否该拦。
 *
 * @param origDesc 写入前文件里的 description（文件不存在 / 解析不出为 null）
 * @param nextDesc 写入后的 description（写不出来为 null → 不判，交给兜底）
 * @returns 需要拦截时的说明；否则 null
 */
export function judge(
	origDesc: string | null,
	nextDesc: string | null,
): { next: number; orig: number | null; over: number } | null {
	if (nextDesc === null) return null;
	const next = descLength(nextDesc);
	if (next <= MAX_DESC) return null;
	const orig = origDesc === null ? null : descLength(origDesc);
	// 历史欠账：本次完全没动 description → 不拦正文编辑，交给后置提醒
	if (orig !== null && nextDesc === origDesc) return null;
	// 正在往回修：本次让长度变短 → 放行，允许分步压到线内
	if (orig !== null && next < orig) return null;
	return { next, orig, over: next - MAX_DESC };
}

const REASON = [
	"[skill-desc-guard] 拦截：SKILL.md 的 description 超过 1024 字符硬上限。",
	"这是 Agent Skills spec 的硬约束（pi 按 JS string.length 计数：汉字 1、emoji 2），",
	"超了 pi 每次启动都会打 `[Skill conflicts] description exceeds 1024 characters`，",
	"skill 的触发描述也会被截断（用户 2026-11-03 立规：同一个错犯了太多次，必须工具强制）。",
	"",
	"正确改法：把**流程机制细节**（分步动作、参数、边界分支）挪进 SKILL.md 正文——",
	"那才是 Progressive Disclosure；description 只留「这个 skill 干什么 + 什么场景必须触发」",
	"（触发词、MUST USE 场景、NOT for 边界）。改完用下面的命令自查：",
	"`python3 ~/.pi/agent/skills/skill-creator/scripts/check_description.py <SKILL.md>`",
].join("\n");

/** 从 shell 命令里挑出候选 SKILL.md 路径（去掉引号与重定向符等修饰）。 */
export function skillPathsFromCommand(command: string): string[] {
	const out: string[] = [];
	for (const token of command.split(/[\s"'`;|&()<>]+/)) {
		if (!token.includes(SKILL_BASENAME)) continue;
		const cleaned = token.replace(/^[=+-]+/, "").replace(/[,:]+$/, "");
		if (isSkillFile(cleaned)) out.push(cleaned);
	}
	return [...new Set(out)];
}

export default function (pi: ExtensionAPI) {
	// 第一层：前置硬拦 —— write / edit 算出写入后的长度，超限即拒
	pi.on("tool_call", async (event) => {
		try {
			const input = event.input as Record<string, unknown>;
			const path = typeof input.path === "string" ? input.path : "";
			if (!path || !isSkillFile(path)) return;

			let nextText: string | null = null;
			let origText: string | null = null;

			if (event.toolName === "write") {
				if (typeof input.content === "string") nextText = input.content;
			} else if (event.toolName === "edit") {
				try {
					origText = readFileSync(path, "utf8");
				} catch {
					origText = null;
				}
				nextText = origText === null ? null : simulateEdits(origText, input.edits);
			}
			if (nextText === null) return; // 算不出来 → 交给后置提醒

			const nextDesc = extractDescription(nextText);
			const origDesc = origText === null ? null : extractDescription(origText);
			const hit = judge(origDesc, nextDesc);
			if (!hit) return;

			return {
				block: true,
				reason: [
					REASON,
					"",
					`本次写入后：${hit.next}/${MAX_DESC}（超 ${hit.over}）`,
					`写入前：${hit.orig === null ? "无 description / 新文件" : `${hit.orig}/${MAX_DESC}`}`,
					`目标文件：${path}`,
				].join("\n"),
			};
		} catch {
			// 判定异常不阻塞会话
		}
	});

	// 第二层：后置提醒 —— 磁盘实测（覆盖 shell 写入与前置算不出的情形）
	pi.on("tool_result", async (event) => {
		try {
			if (event.isError) return;
			const input = event.input as Record<string, unknown>;
			const candidates: string[] = [];

			if (event.toolName === "write" || event.toolName === "edit") {
				const path = typeof input.path === "string" ? input.path : "";
				if (isSkillFile(path)) candidates.push(path);
			} else if (event.toolName === "bash" || event.toolName === "powershell") {
				const command = typeof input.command === "string" ? input.command : "";
				if (command.includes(SKILL_BASENAME)) candidates.push(...skillPathsFromCommand(command));
			}
			if (candidates.length === 0) return;

			const notes: string[] = [];
			for (const path of candidates) {
				let key = "";
				try {
					key = `${path}:${statSync(path).mtimeMs}`;
				} catch {
					continue;
				}
				const stat = measureFile(path);
				if (!stat || stat.length <= MAX_DESC) continue;
				const warnKey = `${key}:${stat.length}`;
				if (warned.has(warnKey)) continue;
				warned.add(warnKey);
				notes.push(
					`\n\n⚠️ [skill-desc-guard] \`${path}\` 的 description 现在是 ${stat.length}/${MAX_DESC}` +
						`（超 ${stat.length - MAX_DESC}），必须压到 1024 以内——把流程细节挪进正文，保留触发词。` +
						`自查：\`python3 ~/.pi/agent/skills/skill-creator/scripts/check_description.py ${path}\``,
				);
			}
			if (notes.length === 0) return;

			const extra = notes.map((text) => ({ type: "text" as const, text }));
			if (Array.isArray(event.content)) {
				return { content: [...event.content, ...extra] };
			}
			return { content: [...extra] };
		} catch {
			// 防御性放行
		}
	});
}
