/**
 * 任务标签（pi 端扩展，footer 状态行）。
 *
 * 用途：在每个 pi 会话的界面底部动态显示「当前任务标签」——
 *   - 会话空闲                 `◦ T11 修复 xx`（暗色，标签挂着待处理）
 *   - agent 干活中              `⏳ 正在处理：T11 修复 xx`（强调色，agent_start 自动切）
 *   - 一轮彻底干完（settled）    `✅ 完成：T11 修复 xx`（成功色，agent_settled 自动切）
 *
 * 命令：
 *   `/task <文本>`   设置 / 更新任务标签（如 `/task T11 修复登录问题`）
 *   `/task done`     手动标记完成（与自动切换是同一个状态）
 *   `/task clear`    清除标签
 *   `/task`          查看当前状态
 *
 * 标签随会话持久化（custom entry `task-label`）：只存 label + done 两个字段，
 * 「正在处理」是瞬态、不落盘（进程被杀 / 重启后不会残留假的进行中状态）。
 * 换会话（/new、/resume、/fork、/reload）时自动重载对应会话自己的标签。
 *
 * 显示位置：用 `ctx.ui.setStatus()` 放在 footer 状态行——不占正文与编辑器的
 * 空间、只多一行状态字；若想更醒目，把 render() 里的 `setStatus` 换成
 * `ctx.ui.setWidget()`（编辑器上方挂件）即可，其余逻辑不变。
 *
 * 行为细节（标题里的「完成自动变」）：
 *   - 「正在处理」由引擎事件自动驱动（agent_start / agent_settled），不需要手动改；
 *   - 一次 agent 运行结束（含自动重试、排队的后续消息都处理完）就显示「完成」；
 *     若任务其实没完、下一轮又继续干，会自动切回「正在处理」；
 *   - 想等到彻底做完再显示完成，就别用自动切换、改用手动 `/task done` 控制
 *     （把 agent_settled 处理器里的自动标记删掉即可，见文件末尾注释）。
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/** footer 状态行的 key（多扩展共用 footer，key 避免冲突）。 */
const STATUS_KEY = "task-label";
/** 会话记录里的 custom entry 类型名。 */
const ENTRY_TYPE = "task-label";
/** 标签最长长度（防挤占 footer）。 */
const MAX_LABEL_LEN = 80;

/** 落盘的持久状态（「正在处理」是瞬态、不落盘）。 */
interface SavedState {
	label?: string;
	done?: boolean;
}

export default function (pi: ExtensionAPI): void {
	let label: string | undefined; // 当前任务标签文本，undefined = 未设置
	let done = false; // 手动或自动标记过「完成」
	let working = false; // 本轮 agent 正在干活（瞬态，不落盘）

	/** 标签清洗：换行 / 制表符折成空格、合并空白，并截断到上限。 */
	function clean(text: string): string {
		return text
			.replace(/[\r\n\t]+/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, MAX_LABEL_LEN);
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

	/** 持久化当前标签。 */
	function persist(): void {
		try {
			pi.appendEntry<SavedState>(ENTRY_TYPE, { label, done });
		} catch {
			// 防御性放行：落盘失败不影响会话
		}
	}

	/** 从当前会话的记录里恢复标签（取最后一条，换会话时重新调用）。 */
	function restore(ctx: ExtensionContext): void {
		label = undefined;
		done = false;
		working = false;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
				const data = entry.data as SavedState | undefined;
				const saved = typeof data?.label === "string" ? clean(data.label) : "";
				if (saved) {
					label = saved;
					done = data?.done === true;
				} else {
					label = undefined;
					done = false;
				}
			}
		}
	}

	/** 设置 / 更新标签。 */
	function setLabel(text: string, ctx: ExtensionContext): void {
		const cleaned = clean(text);
		if (!cleaned) {
			clearLabel(ctx);
			return;
		}
		label = cleaned;
		done = false;
		working = !ctx.isIdle(); // 命令在 agent 干活途中下达时，直接显示「正在处理」
		persist();
		render(ctx);
		ctx.ui.notify(`任务标签已设置：${label}`, "info");
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

	/** 清除标签。 */
	function clearLabel(ctx: ExtensionContext): void {
		label = undefined;
		done = false;
		working = false;
		persist();
		render(ctx);
		ctx.ui.notify("任务标签已清除", "info");
	}

	pi.registerCommand("task", {
		description: "设置 / 查看任务标签（/task <文本> | /task done | /task clear）",
		handler: async (args, ctx) => {
			const input = args.trim();
			if (!input) {
				if (!label) {
					ctx.ui.notify("未设置任务标签（用法：/task <文本> | /task done | /task clear）", "info");
					return;
				}
				const state = working ? "正在处理" : done ? "已完成" : "待处理";
				ctx.ui.notify(`当前任务：${label}（${state}）`, "info");
				return;
			}
			const cmd = input.toLowerCase();
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
		restore(ctx);
		render(ctx);
	});

	// agent 开始干活 → 「正在处理」
	pi.on("agent_start", async (_event, ctx) => {
		if (!label) return;
		working = true;
		render(ctx);
	});

	// 一轮彻底跑完（不存在自动重试 / 排队的后续消息了）→ 「完成」
	// 想改成纯手动控制「完成」时，删掉这个处理器（保留手动 /task done）。
	pi.on("agent_settled", async (_event, ctx) => {
		if (!label || !working || !ctx.isIdle()) return;
		working = false;
		done = true;
		persist();
		render(ctx);
	});
}
