/**
 * 本机屏幕焦点保护守卫（pi 端，tool_call 拦截）。
 *
 * 2026-10-14 用户立规（全局 CLAUDE.md「工作规则」配套工具强制）：用户的工作 Mac
 * 就是他此刻正在用的机器，**任何抢走屏幕焦点的操作都会直接打断用户**——窗口置顶 /
 * 激活、菜单展开与点击、模拟按键 / 鼠标、AX 操控窗口位置尺寸等。用户原话：
 * 「本机焦点禁止抢夺」「以后也是一样」。立规起因：AI 为排查 codef 故障在本机
 * 反复置顶窗口、开菜单、点平铺项，连续打断用户操作。
 *
 * 执行方式：取得用户**当次授权**、命令加标记 `AI_AUTHORIZED_LOCAL_FOCUS` 即可在
 * 本机运行（用户 2026-10-14 深夜澄清：「你可以跑抢焦点的程序，前提是拿到我的
 * 授权」——本机执行不是被绝对禁止）；想不打扰用户时也可去 macmini（`ssh mac-mini`）；
 * 需要 computer-use 类 GUI 能力（看屏 / 真实点击拖拽）时才找 cuAgent（其专属
 * 能力）。只读查询（读窗口列表 / 系统日志等）不抢焦点、不受限。
 *
 * 拦截三类动作（仅限「本机」；命令里含 `ssh` 视为远端 macmini 等机器、放行）：
 * A) `osascript` + 焦点 / UI 操作动词（keystroke / key code / 菜单 pick·click /
 *    frontmost / AXRaise / perform action / 设置窗口位置尺寸 / activate）。
 * B) 以命令段起头直接调用 `codef`（bash/sh 前缀与 `CODEF_DEBUG=1` 之类环境变量
 *    前缀也认；`--version` 除外——它不抢焦点）。
 * C) 以命令段起头用 `open` 代开网页页面（`open http(s)://…` / 本地 `.html` 文件——
 *    浏览器 / 预览窗口会被带到前台抢走焦点；2026-10-14 当晚用户追加立规，起因：
 *    AI 打开 tokenplus 页面抢了用户正在用的焦点，用户原话「下次不要帮我打开网页
 *    页面，给我链接就行」——要给用户看的网页把链接原文发给他、让他自己点）。
 *
 * 逃生门：命令里含标记 `AI_AUTHORIZED_LOCAL_FOCUS`（用户当场明确同意在本机执行
 * 一次抢焦点操作时，经授权后加上）。未获授权不得擅自添加标记。
 *
 * 判定逻辑由 pi 端独立维护（2026-10-17 起为唯一实现；原多端共用 hook 已弃用）。
 *
 * 判定全程防御性 catch：本扩展失灵时不阻塞会话（与 git-commit-guard /
 * version-guard / kdbx-guard 一致）。
 */

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AUTH_MARK = "AI_AUTHORIZED_LOCAL_FOCUS";

/** 远端执行特征：命令里出现 ssh 视为在 macmini 等远端机操作，放行（两端同源）。 */
export const SSH_RE = /(^|[^\w-])ssh(\s|$)/;

/** 焦点 / UI 操作动词（两端同源，勿单端改动）。 */
export const FOCUS_RE =
	/(keystroke|key\s+code|click\s+menu|pick\s+menu|frontmost|AXRaise|perform\s+action|set\s+position\s+of|set\s+size\s+of|activate)/;

/** 命令段以 codef 起头（允许环境变量与 bash/sh 前缀、路径前缀）。 */
export const CODEF_START_RE =
	/^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s+)*(?:(?:bash|sh)\s+)?(?:[^\s]*\/)?codef(?:\s|$)/;

/** `--version` 不抢焦点，放行。 */
export const CODEF_VERSION_RE = /(^|\s)--version(\s|$)/;

/** 命令段以 open 起头（允许环境变量与 bash/sh 前缀、路径前缀）。 */
export const OPEN_START_RE =
	/^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s+)*(?:(?:bash|sh)\s+)?(?:[^\s]*\/)?open(?:\s|$)/;

/** 网页页面目标特征：URL（http/https/file）或本地 .html 文件。 */
export const WEB_TARGET_RE = /https?:\/\/|file:\/\/|\.html?([^A-Za-z0-9]|$)/;

export const OSASCRIPT_DENY =
	"[focus-guard] 拦截：本机屏幕焦点禁止抢夺（2026-10-14 用户立规）——osascript 的" +
	"焦点 / UI 操控（keystroke / key code / 菜单 pick·click / frontmost / AXRaise /" +
	" perform action / 设置窗口位置尺寸 / activate）会直接打断正在用这台机器的用户。" +
	"需要在本机执行时：向用户说明理由与影响、取得当次授权后，在命令里加标记" +
	" `# AI_AUTHORIZED_LOCAL_FOCUS` 即可运行（授权不跨次）；想不打扰用户也可去" +
	" macmini（ssh mac-mini）；需要 computer-use 类能力（看屏 / 点击）才找 cuAgent。";

export const CODEF_DENY =
	"[focus-guard] 拦截：本机禁止直接调用 codef（2026-10-14 用户立规「本机焦点禁止" +
	"抢夺」——codef 按设计会置顶窗口 / 开菜单 / 发按键，打断正在用机的用户）。需要" +
	"在本机执行时：先取得用户当次授权，再加标记 `# AI_AUTHORIZED_LOCAL_FOCUS` 运行" +
	"（授权不跨次）；想不打扰用户也可去 macmini（ssh mac-mini）；需要 computer-use" +
	" 类能力（看屏 / 点击）才找 cuAgent。";

export const OPEN_URL_DENY =
	"[focus-guard] 拦截：本机屏幕焦点禁止抢夺（2026-10-14 用户立规）——不得用 open " +
	"代开网页页面（open http(s)://… / 本地 .html 会把浏览器或预览窗口带到前台、抢走" +
	"用户正在用的焦点）。要给用户看的网页，把链接原文发给他、让他自己点；确需在本机" +
	"代开（用户当场明确同意）时加标记 `# AI_AUTHORIZED_LOCAL_FOCUS`。";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		try {
			if (!(isToolCallEventType("bash", event) || event.toolName === "powershell")) {
				return;
			}
			const command = (event.input as { command?: string })?.command ?? "";
			if (!command) return;
			if (command.includes(AUTH_MARK)) return;
			if (SSH_RE.test(command)) return; // 远端（macmini 等）操作放行

			// A) osascript + 焦点 / UI 操作动词
			if (command.includes("osascript") && FOCUS_RE.test(command)) {
				return { block: true, reason: OSASCRIPT_DENY };
			}

			// B) 命令段起头直接调用 codef（--version 除外）；C) 命令段起头用 open 代开网页页面
			for (const segRaw of command.split(/&&|\|\||[;|\n]/)) {
				const seg = segRaw.replace(/^\s+/, "");
				if (!seg) continue;
				if (CODEF_START_RE.test(seg) && !CODEF_VERSION_RE.test(seg)) {
					return { block: true, reason: CODEF_DENY };
				}
				if (OPEN_START_RE.test(seg) && WEB_TARGET_RE.test(seg)) {
					return { block: true, reason: OPEN_URL_DENY };
				}
			}
		} catch {
			// 判定异常时不阻塞会话
		}
	});
}
