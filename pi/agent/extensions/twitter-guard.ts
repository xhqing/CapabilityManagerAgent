/**
 * X/Twitter 查询账号隔离拦截（pi 端，tool_call 拦截）。
 *
 * 与 ~/.claude/hooks/pre-tool-use-guard.sh 规则 4（CC / Zcode / CodeBuddy /
 * Trae 端共用）的判定逻辑对齐：跑任何 twitter / opencli twitter 命令前必须
 * 先加载账号隔离环境（2026-09-23 用户立规，全局 CLAUDE.md 配套工具强制）。
 *
 * 背景：twitter-cli 默认遍历所有 Chrome profile，取第一个有 x.com cookie 的
 * profile。本机查询专用号在 Default、运营号在 Profile 1；不隔离时，查询号
 * 的 cookie 一旦失效，工具会静默切到运营号 → 运营号承担自动化访问风险。
 * 隔离环境 ~/.x-isolation.env 设 TWITTER_CHROME_PROFILE=Default 并显式注入
 * 查询号的 cookie，把工具钉死在查询号上；查询号失效时直接报错、不静默切号。
 *
 * 规则变更时两端同步改，不能只改一边（「规矩必须配套工具强制」）。
 */

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const UNSAFE_MARK = "AI_AUTHORIZED_X_UNSAFE";
// 允许放行：命令里出现隔离环境或隔离相关的环境变量，即视为已隔离
const ISOLATION_MARKERS = [/x-isolation\.env/, /TWITTER_CHROME_PROFILE/, /TWITTER_AUTH_TOKEN/];
// twitter CLI 调用（含 twitter -c status 这类带全局选项的形态）；
// 不匹配 ~/.twitter-cli/ 路径、which twitter、twitter --help 等
const TW_SUB =
	"(status|feed|search|tweet|article|user|user-posts|likes|followers|following|post|reply|like|retweet|bookmark|bookmarks|favorite|favorites|follow|list|show|quote|delete)";
const TWITTER_CLI = new RegExp(`(?:^|[\\s;&|(])twitter(?:\\s+-\\S+)*\\s+${TW_SUB}\\b`);
// 命令位的 twitter（覆盖子命令白名单未收录的新子命令）；排除 twitter --help 这类纯 flag 调用
const TWITTER_CMD = /(?:^|&&|;|\|)\s*twitter\s+[^-\s]/;
// OpenCLI 的 Twitter 通道（浏览器会话，无隔离机制，一律拦）
const OPENCLI_TWITTER = /(?:^|[\s;&|(])opencli\s+twitter(?:\s|$)/;

const DENY_REASON =
	"[twitter-guard] 拦截：X/Twitter 查询必须先加载账号隔离（2026-09-23 用户立规，" +
	"防工具静默切到运营号）。正确写法：`. ~/.x-isolation.env && twitter status`，" +
	"先确认账号是查询专用号再继续。隔离内容与原因见 ~/.x-isolation.env 注释。" +
	"确需不带隔离时，命令加标记 `# AI_AUTHORIZED_X_UNSAFE`。";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		try {
			if (isToolCallEventType("bash", event)) {
				const command = event.input.command ?? "";
				const hit =
					TWITTER_CLI.test(command) || TWITTER_CMD.test(command) || OPENCLI_TWITTER.test(command);
				if (!hit) return;
				if (command.includes(UNSAFE_MARK)) return;
				if (ISOLATION_MARKERS.some((re) => re.test(command))) return;
				return { block: true, reason: DENY_REASON };
			}
		} catch {
			// 判定异常时不阻塞会话（与 git-commit-guard 一致）
		}
	});
}
