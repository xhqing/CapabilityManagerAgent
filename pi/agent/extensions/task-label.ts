/**
 * 任务标签（pi 端扩展，footer 状态行 + 自动总结）。
 *
 * 用途：在每个 pi 会话的界面底部动态显示「当前任务标签」——
 *   - 会话空闲         `◦ <标签>`（暗色，标签挂着）
 *   - agent 干活中      `⏳ 正在处理：<标签>`（强调色，agent_start 自动切）
 *   - 干完（settled）   `✅ <标签>`（成功色，agent_settled 自动切）
 *
 * 标签来源两种：
 *   1. **自动（默认开启）**：agent 每干完一轮，把最近的会话片段发给当前会话的模型，
 *      总结成一句不超过 30 字的标签（如「调研任务标签方案并写出扩展」），自动替换旧
 *      标签；干活途中先拿用户这轮的输入当临时标签，干完后再用总结替换。
 *      节流：同一会话两次总结至少隔 15 秒、且必须比上次总结多了新的用户消息才会再调，
 *      每次调用 30 秒超时；失败就保留现有标签、不影响会话。
 *   2. **手动**：`/task <文本>` 设置的标签会「钉住」自动总结（source = manual），直到
 *      再 `/task auto on`（恢复自动）或 `/task clear`（清掉标签）。
 *
 * 命令：
 *   `/task <文本>`        设置 / 更新手动标签（钉住，暂停自动总结）
 *   `/task auto [on|off]` 查看 / 切换自动总结（默认 on；开启时若空闲会立刻总结一次）
 *   `/task done`          手动标记完成
 *   `/task clear`         清除标签（自动总结不关，下轮干完会重新生成）
 *   `/task`               查看当前状态
 *
 * 标签随会话持久化（custom entry `task-label`：label / done / auto / source 四个字段；
 * 「正在处理」是瞬态、不落盘）。换会话（/new、/resume、/fork、/reload）自动重载。
 *
 * 显示位置：用 `ctx.ui.setStatus()` 放在 footer 状态行——不占正文与编辑器的空间；
 * 若想更醒目，把 render() 里的 `setStatus` 换成 `ctx.ui.setWidget()`（编辑器上方挂件）
 * 即可，其余逻辑不变。
 */

import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Message } from "@earendil-works/pi-ai";

/** footer 状态行的 key（多扩展共用 footer，key 避免冲突）。 */
const STATUS_KEY = "task-label";
/** 会话记录里的 custom entry 类型名。 */
const ENTRY_TYPE = "task-label";
/** 标签最长长度（防挤占 footer）。 */
const MAX_LABEL_LEN = 80;
/** 临时标签（用户输入截断）的展示长度。 */
const PROVISIONAL_LEN = 40;
/** 自动总结的节流间隔：两次模型调用至少隔这么久。 */
const SUMMARY_MIN_INTERVAL = 15_000;
/** 自动总结单次模型调用超时。 */
const SUMMARY_TIMEOUT = 30_000;
/** 发给模型的会话片段上限。 */
const TRANSCRIPT_MAX_CHARS = 6000;
const TRANSCRIPT_MAX_MESSAGES = 12;
/** 用户输入短于这个长度时不当作「新任务」、保留旧标签（避免「继续」「再试一次」洗掉标签）。 */
const PROVISIONAL_MIN_LEN = 8;

const SUMMARY_SYSTEM_PROMPT = [
	"你是 pi 会话标签生成器。你会收到一段会话片段（用户消息、助手回复、工具结果）。",
	"请用不超过 30 个字概括这个会话当前在处理什么任务、或刚完成了什么，像给会话贴一个一眼能看懂的标签。",
	"要求：只输出标签文本本身；不要引号、句号、换行、任何前后缀（如「总结：」「标签：」）；用中文；提炼任务主题，不要照抄用户原话的长句。",
].join("\n");

/** 落盘的持久状态（「正在处理」是瞬态、不落盘）。 */
interface SavedState {
	label?: string;
	done?: boolean;
	auto?: boolean;
	source?: "manual" | "auto";
}

export default function (pi: ExtensionAPI): void {
	let label: string | undefined; // 当前任务标签文本，undefined = 未设置
	let done = false; // 标记过「完成」
	let working = false; // 本轮 agent 正在干活（瞬态，不落盘）
	let auto = true; // 自动总结开关（默认开）
	let source: "manual" | "auto" = "auto"; // 当前标签来源（手动标签会钉住自动总结）
	let summarizing = false; // 是否已有一次总结在途
	let lastSummaryAt = 0; // 上次自动总结的时间（节流用）
	let lastSummarizedUserCount = -1; // 上次总结时的用户消息数（判断「有没有新输入」）
	let sessionToken = 0; // 换会话 / 重载时自增，用于丢弃过期的总结结果

	/** 文本清洗：换行 / 制表符折成空格、合并空白，并截断。 */
	function clean(text: string, max = MAX_LABEL_LEN): string {
		return text
			.replace(/[\r\n\t]+/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, max);
	}

	/** 总结结果清洗：在 clean 基础上再去掉模型可能多写的「总结：」前缀、引号与句末标点。 */
	function cleanSummary(text: string): string {
		let t = clean(text, 240); // 先大范围清洗，避免截断发生在前缀剥离之前
		t = t.replace(/^(标签|总结|概括|摘要|任务|会话)\s*[:：]\s*/u, "");
		t = t.replace(/^["'“”「『]+/u, "").replace(/["'“”」』]+$/u, "");
		t = t.replace(/[。．.!！?？]+$/u, "");
		return clean(t);
	}

	/** 按当前状态刷新 footer 显示。 */
	function render(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;
		try {
			const theme = ctx.ui.theme;
			if (!label) {
				ctx.ui.setStatus(STATUS_KEY, undefined);
				return;
			}
			const text = working
				? theme.fg("accent", `⏳ 正在处理：${label}`)
				: done
					? theme.fg("success", `✅ 完成：${label}`)
					: theme.fg("dim", `◦ ${label}`);
			ctx.ui.setStatus(STATUS_KEY, text);
		} catch {
			// 防御性放行：UI 异常不影响会话
		}
	}

	/** 持久化当前标签与开关。 */
	function persist(): void {
		try {
			pi.appendEntry<SavedState>(ENTRY_TYPE, { label, done, auto, source });
		} catch {
			// 防御性放行：落盘失败不影响会话
		}
	}

	/** 从当前会话的记录里恢复标签（取最后一条，换会话时重新调用）。 */
	function restore(ctx: ExtensionContext): void {
		label = undefined;
		done = false;
		auto = true;
		source = "auto";
		working = false;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
				const data = entry.data as SavedState | undefined;
				const saved = typeof data?.label === "string" ? clean(data.label) : "";
				label = saved ? saved : undefined;
				done = saved ? data?.done === true : false;
				auto = data?.auto !== false;
				// 旧版数据（没有 source 字段）里的标签都是手动设置的 → 按手动处理
				source = data?.source === "auto" || !saved ? "auto" : "manual";
			}
		}
	}

	/** 当前分支上的用户消息数（用于判断有没有新输入）。 */
	function countUserMessages(ctx: ExtensionContext): number {
		let n = 0;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "message" && entry.message.role === "user") n++;
		}
		return n;
	}

	/** 从一段消息内容里抽文本。 */
	function extractText(content: unknown): string {
		if (typeof content === "string") return content;
		if (!Array.isArray(content)) return "";
		const parts: string[] = [];
		for (const block of content) {
			if (block && typeof block === "object" && (block as { type?: unknown }).type === "text") {
				const text = (block as { text?: unknown }).text;
				if (typeof text === "string") parts.push(text);
			}
		}
		return parts.join("\n");
	}

	/** 把最近若干条消息拼成给模型看的会话片段（有上限、取最近的内容）。 */
	function buildTranscript(ctx: ExtensionContext): string {
		const entries = ctx.sessionManager.getBranch();
		const parts: string[] = [];
		for (let i = entries.length - 1; i >= 0 && parts.length < TRANSCRIPT_MAX_MESSAGES; i--) {
			const entry = entries[i];
			if (entry.type !== "message") continue;
			const message = entry.message as {
				role?: string;
				content?: unknown;
				summary?: unknown;
				command?: unknown;
				output?: unknown;
			};
			let tag = "";
			let text = "";
			switch (message.role) {
				case "user":
					tag = "用户";
					text = extractText(message.content);
					break;
				case "assistant":
					tag = "助手";
					text = extractText(message.content);
					break;
				case "toolResult":
					tag = "工具";
					text = extractText(message.content);
					break;
				case "bashExecution":
					tag = "bash";
					text = `${String(message.command ?? "")}\n${String(message.output ?? "")}`;
					break;
				case "compactionSummary":
				case "branchSummary":
					tag = "会话摘要";
					text = typeof message.summary === "string" ? message.summary : "";
					break;
				default:
					continue;
			}
			if (!text.trim()) continue;
			parts.unshift(`【${tag}】${clean(text, 1500)}`);
		}
		let joined = parts.join("\n\n");
		if (joined.length > TRANSCRIPT_MAX_CHARS) joined = joined.slice(-TRANSCRIPT_MAX_CHARS);
		return joined;
	}

	/** 自动总结：把最近会话片段交给模型浓缩成标签（后台执行、失败静默）。 */
	async function autoSummarize(ctx: ExtensionContext): Promise<void> {
		if (!auto || source === "manual") return;
		if (summarizing || !ctx.isIdle()) return;
		if (ctx.mode !== "tui" || !ctx.model) return; // 只有交互界面才值得为标签调模型
		const now = Date.now();
		if (now - lastSummaryAt < SUMMARY_MIN_INTERVAL) return;
		const userCount = countUserMessages(ctx);
		if (userCount === lastSummarizedUserCount) return; // 与上次总结之间没有新输入
		const transcript = buildTranscript(ctx);
		if (!transcript.trim()) return;

		summarizing = true;
		lastSummaryAt = now;
		lastSummarizedUserCount = userCount;
		const token = sessionToken;

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT);
		try {
			const userMessage: Message = {
				role: "user",
				content: [{ type: "text", text: `会话片段：\n\n${transcript}\n\n请输出这个会话的标签：` }],
				timestamp: Date.now(),
			};
			const response = await ctx.modelRegistry.complete(
				ctx.model,
				{ systemPrompt: SUMMARY_SYSTEM_PROMPT, messages: [userMessage] },
				{ signal: controller.signal, cacheRetention: "none", sessionId: randomUUID() },
			);
			if (token !== sessionToken) return; // 期间换了会话，丢弃结果
			if (response.stopReason === "aborted") return;
			if (!ctx.isIdle()) return; // 已有新一轮在跑，等它结算后再总结
			const text = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n");
			const summary = cleanSummary(text);
			if (!summary) return;
			label = summary;
			source = "auto";
			done = true;
			working = false;
			persist();
			render(ctx);
		} catch {
			// 总结失败（网络 / 超时等）：保留现有标签，不影响会话
		} finally {
			clearTimeout(timer);
			summarizing = false;
		}
	}

	/** 设置 / 更新手动标签（钉住自动总结）。 */
	function setLabel(text: string, ctx: ExtensionContext): void {
		const cleaned = clean(text);
		if (!cleaned) {
			clearLabel(ctx);
			return;
		}
		label = cleaned;
		source = "manual";
		done = false;
		working = !ctx.isIdle(); // 命令在 agent 干活途中下达时，直接显示「正在处理」
		persist();
		render(ctx);
		ctx.ui.notify(`任务标签已设置（手动，自动总结暂停）：${label}`, "info");
	}

	/** 手动标记完成。 */
	function markDone(ctx: ExtensionContext): void {
		if (!label) {
			ctx.ui.notify("当前没有任务标签，先 /task <文本> 设置一个", "warning");
			return;
		}
		done = true;
		working = false;
		persist();
		render(ctx);
		ctx.ui.notify(`任务已标记完成：${label}`, "info");
	}

	/** 清除标签（自动总结开关不动；下轮干完会重新生成）。 */
	function clearLabel(ctx: ExtensionContext): void {
		label = undefined;
		done = false;
		working = false;
		source = "auto";
		lastSummarizedUserCount = -1; // 让下一轮结算时重新总结
		persist();
		render(ctx);
		ctx.ui.notify("任务标签已清除", "info");
	}

	pi.registerCommand("task", {
		description: "设置 / 查看任务标签（/task <文本> | /task auto [on|off] | /task done | /task clear）",
		handler: async (args, ctx) => {
			const input = args.trim();
			if (!input) {
				const state = working ? "正在处理" : done ? "已完成" : "待处理";
				const mode = `自动总结${auto ? "开" : "关"}`;
				ctx.ui.notify(
					label
						? `当前任务：${label}（${state}，${mode}，来源：${source === "manual" ? "手动" : "自动"}）`
						: `未设置任务标签（${mode}）`,
					"info",
				);
				return;
			}
			const [word = "", extra = ""] = input.split(/\s+/);
			const cmd = word.toLowerCase();
			if (cmd === "auto") {
				const value = extra.toLowerCase();
				auto = value === "on" ? true : value === "off" ? false : !auto;
				if (auto) source = "auto";
				persist();
				render(ctx);
				ctx.ui.notify(
					auto ? "自动总结已开启；空闲时立刻总结一次，之后每轮干完自动刷新" : "自动总结已关闭",
					"info",
				);
				if (auto) void autoSummarize(ctx);
				return;
			}
			if (cmd === "done") {
				markDone(ctx);
				return;
			}
			if (cmd === "clear" || cmd === "off" || cmd === "remove") {
				clearLabel(ctx);
				return;
			}
			setLabel(input, ctx);
		},
	});

	// 换会话（startup / reload / new / resume / fork）→ 重载该会话自己的标签
	pi.on("session_start", async (_event, ctx) => {
		sessionToken += 1;
		summarizing = false;
		lastSummaryAt = 0;
		lastSummarizedUserCount = -1;
		restore(ctx);
		render(ctx);
	});

	// 用户刚提交输入 → 自动模式下把这次输入当作临时标签（新任务才换、短句「继续」保留旧标签）
	pi.on("before_agent_start", async (event, ctx) => {
		if (auto && source !== "manual") {
			const prompt = clean(event.prompt ?? "", PROVISIONAL_LEN);
			if (prompt && (!label || prompt.length >= PROVISIONAL_MIN_LEN)) {
				label = prompt;
				source = "auto";
				done = false;
			}
		}
		if (label) {
			working = true;
			render(ctx);
		}
	});

	// agent 开始干活 → 「正在处理」
	pi.on("agent_start", async (_event, ctx) => {
		if (!label) return;
		working = true;
		render(ctx);
	});

	// 一轮彻底跑完 → 「完成」，随后后台用模型刷新标签
	pi.on("agent_settled", async (_event, ctx) => {
		if (ctx.isIdle()) {
			working = false;
			if (label) {
				done = true;
				persist();
			}
			render(ctx);
		}
		void autoSummarize(ctx);
	});
}
