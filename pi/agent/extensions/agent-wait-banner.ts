/**
 * 等待其它智能体回复期间的「大红警示横幅」（pi 端扩展）。
 *
 * 2026-10-09 用户立规（全局 ~/.claude/CLAUDE.md「会话间协作」节）：等待其它智能体回复
 * 时，阶段性汇报容易被误认为「任务已全部完成」——用户实测差点关掉会话。规则：等待期间
 * 的任何阶段性汇报，首行必须有大红横幅：
 *     🟥🟥🟥 正在等待其它智能体回复中 —— 暂时不要关闭当前会话！ 🟥🟥🟥
 *
 * 本扩展 = 该规则的兜底（message_end 改写收尾消息）。
 *
 * ## 2026-10-09 修订：判定精确化（v2）
 *
 * 旧版粗粒度判定「本轮只要委派过就补」在已收尾场景产生假阳性——实测：ask 已收到回复 /
 * 超时放弃后，汇报正文写着「无进行中的等待」，却被自动补上横幅，两句话矛盾（用户指出）。
 * 本版把「等待窗口」精确定义为：
 *   - **send 类委派**（`agent_call` mode=send / `intercom` action=send|handover）发出后，
 *     持续到「任何新消息（对方回信 / 用户输入）到达」——窗口内每条汇报都带横幅；
 *   - **ask 类调用**（`agent_call` 默认 / `intercom` action=ask）不进入横幅窗口：
 *     ask 阻塞期间本就无法产出汇报，而调用一有结果（回复到达 / 超时 / 失败）即按
 *     「联系不上不硬等」原则结束等待，不再提醒保持会话；
 *   - `agent_wake` 单独不算等待（「确保对方在线」是即时动作）。
 *
 * widget：等待窗口内（含 ask 阻塞中）在编辑器下方挂红色提示，窗口关闭即撤。
 *
 * 注意：pi 扩展在会话启动时加载——已在运行的会话仍持旧版，本次修正在下一个新会话生效。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BANNER_TEXT = "🟥🟥🟥 正在等待其它智能体回复中 —— 暂时不要关闭当前会话！ 🟥🟥🟥";
const BANNER_STYLED = `\x1b[1;31m${BANNER_TEXT}\x1b[0m`;
const MARKER = "正在等待其它智能体回复中"; // 已带横幅（人工写的或本扩展加的）就不重复补
const WIDGET_KEY = "agent-wait";

const DELEGATE_TOOLS = new Set(["agent_call", "agent_wake", "intercom"]);

/** 该调用是否属「send 类委派」：发出后等对方回信（不阻塞）。 */
function isSendLike(toolName: string, input: Record<string, unknown>): boolean {
	if (toolName === "agent_call") return input.mode === "send";
	if (toolName === "intercom") return input.action === "send" || input.action === "handover";
	return false;
}

/** 该调用是否属「ask 类调用」：阻塞式等待回复（结束后即结窗）。 */
function isAskLike(toolName: string, input: Record<string, unknown>): boolean {
	if (toolName === "agent_call") return input.mode !== "send"; // 默认（未传 mode）= ask
	if (toolName === "intercom") return input.action === "ask";
	return false;
}

export default function (pi: ExtensionAPI) {
	// ---- 等待窗口状态 ----
	// sendAwaiting：send 类委派已发出、尚未收到任何新消息
	// pendingAsks：ask 类调用阻塞中（按 toolCallId 登记，结束即销）
	let sendAwaiting = false;
	const pendingAsks = new Set<string>();

	const syncWidget = (setWidget: (key: string, lines: string[] | undefined) => void) => {
		try {
			const waiting = sendAwaiting || pendingAsks.size > 0;
			setWidget(WIDGET_KEY, waiting ? [BANNER_STYLED] : undefined);
		} catch {
			// 防御性放行
		}
	};

	// 委派工具调用：登记等待状态
	pi.on("tool_call", async (event, ctx) => {
		try {
			const { toolName, toolCallId, input } = event as {
				toolName?: string;
				toolCallId?: string;
				input?: Record<string, unknown>;
			};
			if (!toolName || !DELEGATE_TOOLS.has(toolName)) return;
			const args = input ?? {};

			if (isSendLike(toolName, args)) {
				sendAwaiting = true;
			} else if (isAskLike(toolName, args) && toolCallId) {
				pendingAsks.add(toolCallId);
			}
			// agent_wake 单独不算等待

			syncWidget((key, lines) => ctx.ui.setWidget(key, lines, { placement: "aboveEditor" }));
		} catch {
			// 防御性放行
		}
	});

	// ask 类调用结束（回复到达 / 超时 / 失败）→ 等待结束
	pi.on("tool_execution_end", async (event, ctx) => {
		try {
			const { toolCallId } = event as { toolCallId?: string };
			if (toolCallId && pendingAsks.delete(toolCallId)) {
				syncWidget((key, lines) => ctx.ui.setWidget(key, lines, { placement: "aboveEditor" }));
			}
		} catch {
			// 防御性放行
		}
	});

	// 新消息（用户输入或 agent 回信）到达 → send 等待窗口关闭（pendingAsks 一并清空作自愈兜底）
	pi.on("message_start", async (event, ctx) => {
		try {
			const { message } = event as { message?: { role?: string } };
			if (message?.role === "user") {
				sendAwaiting = false;
				pendingAsks.clear();
				syncWidget((key, lines) => ctx.ui.setWidget(key, lines, { placement: "aboveEditor" }));
			}
		} catch {
			// 防御性放行
		}
	});

	// 收尾消息兜底：等待窗口内、但没带横幅 → 前置大红横幅
	pi.on("message_end", async (event) => {
		try {
			if (!sendAwaiting && pendingAsks.size === 0) return;
			const message = (event as { message?: { role?: string; content?: unknown } }).message;
			if (message?.role !== "assistant") return;

			const content = message.content;
			if (!Array.isArray(content)) return;

			const idx = content.findIndex(
				(c) => c.type === "text" && typeof c.text === "string" && c.text.trim(),
			);
			if (idx < 0) return; // 没有正文（纯工具调用）→ 无需标注

			const block = content[idx] as { type: "text"; text: string };
			if (block.text.includes(MARKER)) return; // 已带横幅（人工写的）→ 不动

			const newContent = [...content];
			newContent[idx] = { ...block, text: `${BANNER_STYLED}\n\n${block.text}` };
			return { message: { ...message, content: newContent } };
		} catch {
			// 防御性放行
		}
	});
}
