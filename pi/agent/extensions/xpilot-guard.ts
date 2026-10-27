/**
 * xpilot（本机代理服务）关闭守卫（pi 端，tool_call 拦截 + 用户汇报）。
 *
 * 2026-10-27 用户立规（全局 CLAUDE.md「禁止 Agent 自行关闭 xpilot」配套工具强制）：
 * **禁止所有 Agent 自己关闭 xpilot；确需关闭必须经用户授权。** 立规起因：AI 为「逐节点
 * 验证老虎白名单」用 `xpilot stop` + `xpilot start <node>` 把 6 个节点挨个切了一遍
 * （共停起 7 次），等于把本机出口（包括 AI 自己、以及 system_proxy.enabled=true 下
 * 用户浏览器等全部流量）掐断了若干分钟——用户原话「你关了 xpilot 你自己也断了知道吗！」。
 *
 * xpilot 不是某个项目的私有进程，而是**本机全局出口**：停掉它 = 本机所有走代理的流量
 * 一起断（含系统代理设置被摘掉）。所以「停」这个动作的影响面远超操作者自己的任务，
 * 必须由用户拍板。
 *
 * 三层语义：
 *   ① 拦「停」类动作：xpilot stop / restart / uninstall-launchd、pkill|killall xpilot、
 *      launchctl unload|bootout xpilot、以及命令里出现 xpilot 的 kill。read-only 的
 *      status / test / switch / start / node list / config show 一律放行。
 *   ② 拦下来之后 **向用户直接汇报**（ctx.ui.notify）：说明「AI 想自主关闭 xpilot、
 *      已被拦下」+ 命令原文摘要，让用户看得见（不是只在模型上下文里悄悄失败）。
 *   ③ 逃生门：用户当次明确授权后，命令加标记 `# AI_AUTHORIZED_XPILOT_STOP` 放行
 *      （授权不跨次；未获授权不得擅自加标记）。
 *
 * 覆盖面：bash 与 background_run（pi 的后台任务工具同样能跑 shell，只拦 bash 会被绕过）。
 *
 * 局限（诚实）：`kill -9 <pid>` 这种**不出现 xpilot 字样**的精确 PID 杀法拦不住（无从
 * 静态判断该 PID 是谁）；`launchctl kill` 需同时出现 xpilot 特征。本扩展只提高绕过成本、
 * 不是银弹——与 focus-guard / kdbx-guard 同一取舍。
 *
 * 判定全程防御性 catch：本扩展失灵时不阻塞会话。
 */

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** 用户当次授权的标记（授权不跨次；未获授权不得擅自添加）。 */
export const AUTH_MARK = "AI_AUTHORIZED_XPILOT_STOP";

/** 命令里提到 xpilot（CLI 名 / 模块名 / 进程名三种写法都算）。 */
export const XPILOT_RE = /\bxpilot\b/;

/** 「停 / 重启 / 卸守护」子命令。 */
export const STOP_SUB_RE = /\b(stop|restart|uninstall-launchd)\b/;

/**
 * 命令段的执行体起头：只认「真的在执行某个程序」的段（echo / grep / cat 里出现
 * `xpilot stop` 字样属于读文本，不该拦）。
 * 允许 `VAR=x` 环境变量前缀、bash/sh/sudo/nohup 前缀、路径前缀。
 */
export const STARTER_RE =
	/^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s+)*(?:(?:bash|sh|sudo|nohup)\s+)*(?:[^\s]*\/)?(xpilot|python3?|pkill|killall|kill|launchctl|osascript)\b/;

/** xpilot CLI 以 `python -m xpilot.cli stop` / `python xxx/xpilot.py stop` 形式调用。 */
export const PY_XPILOT_RE = /(?:-m\s+)?xpilot[\w.]*(?:\.py)?\b/;

/** launchctl 里属于「停掉一个服务」的动词。 */
export const LAUNCHCTL_STOP_RE = /\b(unload|bootout|disable|kill|stop)\b/;

export const XPILOT_STOP_DENY =
	"[xpilot-guard] 已拦截：**禁止 Agent 自行关闭 xpilot**（2026-10-27 用户立规）。" +
	"xpilot 是本机全局出口——stop / restart 会同时掐断 AI 自己、以及 system_proxy 下" +
	"用户浏览器等全部代理流量（用户原话「你关了 xpilot 你自己也断了知道吗！」）。" +
	"现在这个动作已被暂停、并已向你汇报（见上方通知）。\n" +
	"正确做法：① 想验证节点 / 白名单 → 用 read-only 手段（`xpilot status`、" +
	"`xpilot test --node <id>`、`xpilot node list`），这些不碰主代理；② 确实必须停 / 重开" +
	" → 先向用户说明理由与影响并取得当次授权（建议 AskUserQuestion），授权后在命令里" +
	"加标记 `# AI_AUTHORIZED_XPILOT_STOP` 再执行（授权不跨次、不得擅自添加标记）。";

/** 判断一条命令是否需要拦（导出供测试复用）。 */
export function isXpilotStopCommand(command: string): boolean {
	if (!command) return false;
	if (command.includes(AUTH_MARK)) return false;
	for (const segRaw of command.split(/&&|\|\||[;|\n]/)) {
		const seg = segRaw.replace(/^\s+/, "").trim();
		if (!seg) continue;
		// 先剥掉子 shell / 命令替换外壳，但保留内容判定
		const starter = STARTER_RE.exec(seg);
		if (!starter) continue;
		const bin = starter[1];
		const hasXpilot = XPILOT_RE.test(seg);
		if (!hasXpilot) continue;

		if (bin === "pkill" || bin === "killall" || bin === "kill") return true; // 杀 xpilot 进程
		if (bin === "launchctl") {
			if (LAUNCHCTL_STOP_RE.test(seg)) return true; // 停 / 卸载 xpilot 的 launchd 项
			continue;
		}
		if (bin === "python3" || bin === "python") {
			if (PY_XPILOT_RE.test(seg) && STOP_SUB_RE.test(seg)) return true;
			continue;
		}
		if (bin === "osascript") continue; // 与本守卫无关（焦点类归 focus-guard）
		// bin === "xpilot"
		if (STOP_SUB_RE.test(seg)) return true;
	}
	return false;
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		try {
			// bash 与 background_run 都能跑 shell —— 只拦 bash 会被后台任务绕过
			const isBash = isToolCallEventType("bash", event);
			const isBg = event.toolName === "background_run";
			if (!isBash && !isBg) return;
			const command = (event.input as { command?: string })?.command ?? "";
			if (!isXpilotStopCommand(command)) return;

			// ② 向用户直接汇报（模型上下文里的失败用户看不见，这里明着提示）
			try {
				const brief = command.replace(/\s+/g, " ").slice(0, 160);
				ctx.ui.notify(
					`[xpilot-guard] 🛑 已拦下「自行关闭 xpilot」的动作并暂停执行。\n` +
						`原因：xpilot 是本机全局出口，停掉会同时断掉 AI 自己和系统代理流量。\n` +
						`被拦命令：${brief}\n` +
						`如果你确实要停 / 重开 xpilot，请明确授权（授权只对当次有效）。`,
					"warning",
				);
			} catch {
				// notify 失败不影响拦截本身
			}

			// ① 拦截
			return { block: true, reason: XPILOT_STOP_DENY };
		} catch {
			// 判定异常时不阻塞会话（与其它守卫一致）
		}
	});
}
