/**
 * 等待其它智能体回复期间的「大红警示横幅」（pi 端扩展）。
 *
 * 2026-10-09 用户立规（全局 ~/.claude/CLAUDE.md「会话间协作」节）：等待其它智能体回复
 * 时，阶段性汇报容易被误认为「任务已全部完成」——用户实测差点关掉会话。规则：等待期间
 * 的任何阶段性汇报，首行必须有大红横幅：
 *     🟥🟥🟥 正在等待其它智能体回复中 —— 暂时不要关闭当前会话！ 🟥🟥🟥
 *
 * 本扩展 = 该规则的兜底（与 git-status-guard 同款：message_end 改写收尾消息）：
 *   - 本轮只要委派过其它智能体（agent_call / intercom / agent_wake），收尾消息若没带
 *     横幅就自动前置一条大红加粗的（ANSI `\x1b[1;31m`；🟥 本身即红色作兜底）；
 *   - 等待期间在编辑器上方挂一条红色 widget（setWidget），新消息（用户输入或 agent
 *     回信 —— 均为 user 角色）一到达就撤掉；
 *   - 防御性 catch：失灵不影响会话。
 *
 * 注意：pi 扩展在会话启动时加载——已在运行的会话仍持旧版，本次修正在下一个新会话生效。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BANNER_TEXT = "🟥🟥🟥 正在等待其它智能体回复中 —— 暂时不要关闭当前会话！ 🟥🟥🟥";
const BANNER_STYLED = `\x1b[1;31m${BANNER_TEXT}\x1b[0m`;
const MARKER = "正在等待其它智能体回复中"; // 已带横幅（人工写的或本扩展加的）就不重复补

const DELEGATE_TOOLS = new Set(["agent_call", "agent_wake", "intercom"]);
const WIDGET_KEY = "agent-wait";

export default function (pi: ExtensionAPI) {
	// 本轮是否委派过其它智能体（决定收尾消息要不要带横幅）
	let delegated = false;

	pi.on("tool_call", async (event, ctx) => {
		try {
			const name = (event as unknown as { toolName?: string; name?: string }).toolName ??
				(event as unknown as { name?: string }).name;
			if (!name || !DELEGATE_TOOLS.has(name)) return;

			delegated = true;
			// 等待期间挂红色 widget（新消息到达即撤，见 message_start）
			ctx.ui.setWidget(
				WIDGET_KEY,
				[`\x1b[1;31m${BANNER_TEXT}\x1b[0m`],
				{ placement: "aboveEditor" },
			);
		} catch {
			// 防御性放行
		}
	});

	// 新消息（用户输入或 agent 回信）到达 → 撤掉等待 widget
	pi.on("message_start", async (event, ctx) => {
		try {
			if (event.message?.role === "user") {
				ctx.ui.setWidget(WIDGET_KEY, undefined);
			}
		} catch {
			// 防御性放行
		}
	});

	// 收尾消息兜底：委派过、但没带横幅 → 前置大红横幅
	pi.on("message_end", async (event) => {
		try {
			if (event.message?.role !== "assistant" || !delegated) return;
			delegated = false;

			const content = event.message.content;
			if (!Array.isArray(content)) return;

			const idx = content.findIndex(
				(c) => c.type === "text" && typeof c.text === "string" && c.text.trim(),
			);
			if (idx < 0) return; // 没有正文（纯工具调用）→ 无需标注

			const block = content[idx] as { type: "text"; text: string };
			if (block.text.includes(MARKER)) return; // 已带横幅（人工写的）→ 不动

			const newContent = [...content];
			newContent[idx] = { ...block, text: `${BANNER_STYLED}\n\n${block.text}` };
			return { message: { ...event.message, content: newContent } };
		} catch {
			// 防御性放行
		}
	});
}
