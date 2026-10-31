/**
 * 多余询问守卫（pi 端，系统提示注入 + 回复检测 + 只喂给 AI 的回执）。
 *
 * 2026-10-29 用户立规：**已经授权过的事不要再问用户，直接做。** 立规起因：镜像同步
 * 早在全局 CLAUDE.md 里写明「由 Prometheus 负责、发现分叉自动同步对齐、无需询问」，
 * 但 AI 仍然在收尾时问了一句「要我现在做吗」。用户随后补了第二条口径：「不要让我看
 * 警告，这种事情定了规矩我就不想插手了，警告应该让当前会话看见」——所以本扩展**不向
 * 用户弹任何提示**，命中时只把回执写进 AI 自己的上下文（`display: false`）。
 *
 * 为什么会反复犯：授权分散在 CLAUDE.md 的不同章节（跨机协作 / 会话间协作 / commit
 * 规则 / 新建项目），一轮对话读到的不一定是那几条。所以把它们抽成**一份短清单，
 * 每轮对话开始前追加进系统提示**——预防为主。
 *
 * 三层语义：
 *   ① 预防：before_agent_start 把「已授权事项清单」追加进 systemPrompt（内容固定，
 *      缓存友好；约 200 字）。
 *   ② 检测：message_end 检查 assistant 回复里是否出现「询问句式 + 已授权事项关键词」。
 *   ③ 回执：命中后把一条 `display: false` 的自定义消息注入下一轮上下文——**只有 AI
 *      能看到，用户界面完全不显示**，内容包含「你问了什么、这件事该怎么做」。
 *      用户不参与、不被打扰；AI 下一轮自然改正。
 *
 * 局限（诚实）：这是**输出风格类**规则，无法像命令拦截那样硬阻断。清单要窄——只收
 * 明确写过「无需询问 / 直接做」的事项；方案分叉大、规则没覆盖的问题仍然应该问用户。
 * 判定全程防御性 catch：本扩展失灵时不阻塞会话。
 *
 * 2026-10-31 增：与手动提交模式（commit-mode）联动——项目处于手动。
 *
 * 补充说明（2026-10-31，同日第二次修订）：用户想先看工作区相对暂存区的 diff 时，会把
 * 某个项目的「自动 add」和 / 或「自动 commit」关掉（commit-mode，状态文件
 * ~/.pi/agent/state/commit-mode.json）。此时清单里的「工作区 / 暂存区有待提交内容 → 直接
 * 按 /add 或 /commit 流程处理」必须按开关反向——否则本扩展会一边注入「直接提交」、
 * commit-mode-guard 一边硬拦截，AI 走进死路。所以 brief 按两个开关的组合动态生成。
 */

import { readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STATE_FILE = join(homedir(), ".pi", "agent", "state", "commit-mode.json");

/** 状态缓存：按 mtime 失效。 */
let stateCache: { mtime: number; entries: { add: string[]; commit: string[] } } | null = null;

function norm(raw: string): string {
	let p = raw.trim();
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

/** 读状态文件里的两组条目（兼容旧版单一 manual 字段）。 */
function modeState(): { add: string[]; commit: string[] } {
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
		const entries = { add: pick(data?.manualAdd, data?.manual), commit: pick(data?.manualCommit, data?.manual) };
		stateCache = { mtime: st.mtimeMs, entries };
		return entries;
	} catch {
		stateCache = null;
		return { add: [], commit: [] };
	}
}

/** 当前会话上下文下两个开关的状态。 */
function modesAt(cwd: string | undefined): { add: boolean; commit: boolean } {
	if (!cwd) return { add: false, commit: false };
	const state = modeState();
	const p = norm(cwd);
	const hit = (entries: string[]) => entries.some((e) => p === e || p.startsWith(e + "/"));
	return { add: hit(state.add), commit: hit(state.commit) };
}

/** 已授权事项清单（每轮追加进系统提示；与全局 CLAUDE.md「输出风格」节那条保持一致）。 */
function buildBrief(modes: { add: boolean; commit: boolean }): string {
	let commitLine = `- 工作区 / 暂存区有待提交内容 → 直接按 /add 或 /commit 流程处理。`;
	if (modes.add && modes.commit) {
		commitLine = `- **本项目的自动 add 与自动 commit 都已关闭（commit-mode）**：不要自行发起 /add、/commit（commit-mode-guard 会硬拦截）；只有用户当轮明确要求时才执行。`;
	} else if (modes.add) {
		commitLine = `- **本项目的自动 add 已关闭（commit-mode）**：不要自行发起 /add 或 git add；commit 仍自动，但不要为了跑通流程而自行 add。只有用户当轮明确要求时才执行。`;
	} else if (modes.commit) {
		commitLine = `- **本项目的自动 commit 已关闭（commit-mode）**：add 仍可自动（预检干净后只 add、不自动衔接 commit）；不要自行 /commit、/bump、/release。只有用户当轮明确要求提交时才执行。`;
	}
	return `【已授权事项：直接做，不要征求确认（2026-10-29 用户立规）】
下面这些事用户已经明确授权，**不要用「要不要我…」「需要我…吗」这类问句结尾**，直接执行：
- 全局能力层（~/.pi/agent 下的 skills / CLAUDE.md / docs / patch / extensions）改动后，同步 CapabilityManagerAgent 开源镜像 → 直接 agent_call Prometheus（dir 用 /Users/xhq/Developer/CapabilityManagerAgent），不要问用户。
${commitLine}
- 其它 agent 项目的仓库有待提交内容 → 直接 agent_call 对方按其自己的 /add → /commit 处理。
- /add 预检完全干净 → 自动衔接 /commit；/commit 第 10 步命中发版条件 → 自动 bump / 发版。
- 新建项目 git init、向 agents-registry 追加新 agent 行 → 免确认。
仍然该问的情况：方案分叉大 / 返工成本高 / 规则没覆盖 / 涉及不可逆破坏性操作。`;
}

/** 询问句式：命中说明在向用户征求确认。 */
const ASK_RE =
	/(要不要我|要我(现在|先)?(把|做|去|来|帮|直接|再)|需要我(帮|来|去|现在|先)?|是否要我|是否现在(就)?(做|处理)|现在就做吗|可以现在做|由你决定|你定|等你(确认|点头|指示|回复)|需要确认吗|要我现在)/;

/** 已授权事项：关键词 → 命中后应该怎么做的提示（写进给 AI 的回执里）。 */
const AUTHORIZED_HINTS: Array<{ re: RegExp; hint: string }> = [
	{
		re: /镜像同步|同步(到|回)?镜像|CapabilityManagerAgent|Prometheus/,
		hint: "直接 agent_call Prometheus（dir: /Users/xhq/Developer/CapabilityManagerAgent）同步镜像并记 CHANGELOG",
	},
	{
		re: /\/add\b|\/commit\b|\/bump\b|\/release\b|预检|发版链/,
		hint:
			"自动模式：直接按 /add → /commit 流程执行（预检干净会自动衔接，commit 第 10 步按规则自动 bump / 发版）。" +
			"手动提交模式（commit-mode）：只有用户当轮明确要求时才执行，否则保持安静、把改动留在工作区",
	},
	{
		re: /agent_call|会话间协作|委派对方|自动委派/,
		hint: "直接 agent_call 对方 agent 按其自己的流程处理",
	},
	{
		re: /git init|agents-registry|注册表/,
		hint: "直接执行，免确认",
	},
];

/** 从消息里取纯文本（只取 text 片段，忽略 thinking / toolCall）。 */
function extractText(message: unknown): string {
	try {
		const content = (message as { content?: unknown })?.content;
		if (typeof content === "string") return content;
		if (!Array.isArray(content)) return "";
		return content
			.map((part) => {
				const p = part as { type?: string; text?: string };
				return p?.type === "text" && typeof p.text === "string" ? p.text : "";
			})
			.filter(Boolean)
			.join("\n");
	} catch {
		return "";
	}
}

/** 待注入给 AI 的回执（下一轮 before_agent_start 时消费，用户看不到）。 */
let pendingReminder: string | null = null;

export default function (pi: ExtensionAPI) {
	// ③ + ① 回执注入 + 清单追加：每轮对话开始前
	pi.on("before_agent_start", async (event, ctx) => {
		try {
			const result: Record<string, unknown> = {};

			if (pendingReminder) {
				result.message = {
					customType: "ask-guard",
					content: pendingReminder,
					display: false, // 只进 AI 上下文，界面上不显示
				};
				pendingReminder = null;
			}

			const prompt = (event as { systemPrompt?: string })?.systemPrompt ?? "";
			if (!prompt.includes("【已授权事项：直接做，不要征求确认")) {
				result.systemPrompt = `${prompt}\n\n${buildBrief(modesAt(ctx?.cwd))}`;
			}

			return Object.keys(result).length > 0 ? result : undefined;
		} catch {
			// 注入失败不影响会话
		}
	});

	// ② 检测：回复里出现「询问句式 + 已授权关键词」→ 记账，下一轮只告诉 AI
	pi.on("message_end", async (event) => {
		try {
			const message = (event as { message?: { role?: string } })?.message;
			if (message?.role !== "assistant") return;

			const text = extractText(message);
			if (!text || !ASK_RE.test(text)) return;

			const hit = AUTHORIZED_HINTS.find((h) => h.re.test(text));
			if (!hit) return;

			const ask = text.match(ASK_RE)?.[0] ?? "询问";
			pendingReminder =
				`【ask-guard 回执】你上一轮对**已授权事项**向用户提问了：「${ask}」。\n` +
				`这件事的正确做法：${hit.hint}。\n` +
				`用户已明确表示这类事不用再问（2026-10-29 立规）。本轮直接做，不要重复提问。`;
		} catch {
			// 判定异常时不阻塞会话
		}
	});
}
