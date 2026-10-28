/**
 * `.pi/` 目录用途守卫（pi 端，tool_call 拦截）。
 *
 * 2026-10-28 用户立规（全局 CLAUDE.md「工作规则 · `.pi/` 目录只放 pi 自己要读的东西」的配套工具）：
 * `.pi/` 是 **pi 的配置目录**，不是「项目里的一个隐藏文件夹」。判断标准只有一条——
 * **pi 自己会不会去读它？** 不会，就禁止放进去，哪怕只是想躲开某个检查、或者图省事。
 *
 * 立规起因（真实事故）：某个 git worktree 把 git 的 `pre-push` 挂在 `.pi/hooks/` 下、
 * 用 `core.hooksPath` 指过去，结果：
 *   1) pi 每次启动都把 `.pi/hooks` 当成「已废弃的旧版钩子目录」，弹迁移警告并要求按任意键；
 *   2) 更危险的是 `.pi` 在团队里经常是**软链接**（子项目挂 `../<Agent 项目>/.pi`）。一旦恢复
 *      成软链接，`core.hooksPath` 指向的目录就不存在了，而 git 遇到不存在的 hooks 目录
 *      **不报错、不提示、直接跳过所有钩子**——「推 main 会被拦」的保护无声消失，直到出事。
 *
 * 拦截范围：
 * A) 写 / 编辑类工具（write / edit）的目标路径落在 `.pi/` 下、且首段不是 pi 认识的条目。
 * B) bash / powershell 命令里**同时**出现「写动作」与「`.pi/` 下非白名单条目」：
 *    mv / cp / ln / mkdir / touch / tee / rsync / install / unzip / tar / chmod / chown /
 *    dd / truncate / shred / `sed -i` / `perl -i` / `>` `>>` 重定向。
 * C) 任何把 `core.hooksPath` 指向 `.pi` 的命令——git 钩子一律不许放 `.pi`（没有例外）。
 *
 * 明确不拦：
 * - 全局 pi 目录 `~/.pi/agent/`：那是 pi 自己的家，团队既有约定（extensions/、skills/、docs/、
 *   patch/ 等）都在里面，不由本守卫约束；
 * - 只读命令（ls / cat / grep / git log / git status …）：只判写动作，日常查看完全不受影响；
 * - `.pi/` 下 pi 自己会读的条目（见 ALLOWED）；
 * - 以 `.` 开头的隐藏文件（`.DS_Store` 之类系统垃圾）。
 *
 * 已知局限（诚实声明）：
 * - 命令文本里出现 `.pi/` 才判；`cd .pi && mkdir hooks` 这类「先切目录、再用相对路径写」的写法绕得过去；
 * - 命令里同时出现写动词与 `.pi/` 但并非同一目标时可能误报（例如 `grep -rn mv .pi/hooks`）。
 *
 * 逃生门：命令或路径里含标记 `AI_ALLOW_PI_DIR`（须用户当次授权，不得擅自添加）。
 * 判定全程防御性 catch：本扩展失灵时不阻塞会话（与 git-commit-guard / kdbx-guard 等一致）。
 */

import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const AUTH_MARK = "AI_ALLOW_PI_DIR";

/**
 * pi 自己会读的项目级 `.pi/` 条目（依据 pi 官方文档核实）：
 * settings.md → settings.json；extensions.md → extensions/；skills.md → skills/；
 * prompt-templates.md → prompts/；themes.md → themes/；packages.md → npm/、git/；
 * settings.md（sessionDir 示例）→ sessions/。
 */
export const ALLOWED = new Set([
	"settings.json",
	"extensions",
	"skills",
	"prompts",
	"themes",
	"npm",
	"git",
	"sessions",
]);

const GLOBAL_AGENT_DIR = resolve(homedir(), ".pi", "agent");

/** 写动作特征（只用来判断「这条命令是不是在写东西」）。 */
const WRITE_ACT =
	/(^|[^A-Za-z0-9_/-])(mv|cp|ln|mkdir|touch|tee|rsync|install|unzip|tar|chmod|chown|dd|truncate|shred)([ \t]|$)|sed[ \t]+-i|perl[ \t]+-i|>>?[ \t]*[^\s;&|]*\.pi\//;

/** `core.hooksPath` 指向 `.pi` —— 无论命令形态如何都拦。 */
const HOOKSPATH_TO_PI = /hooksPath[ \t=]+["']?[^\s"';&|]*\.pi\//;

const REASON =
	"[pi-dir-guard] 拦截：`.pi/` 是 **pi 的配置目录**，只放 pi 自己会读的东西" +
	"（settings.json / extensions/ / skills/ / prompts/ / themes/ / npm/ / git/ / sessions/），" +
	"与 pi 无关的内容一律不许往里放——git 钩子请放仓库或 worktree 的 gitdir" +
	"（`.git/hooks/` 或 `core.hooksPath` 指向的独立目录），临时产物放项目 `tmp/`，" +
	"项目自己的脚本 / 配置放正式目录。" +
	"原因：`.pi` 在团队里常是软链接（子项目挂 `../<Agent 项目>/.pi`），一旦被替换成软链接，" +
	"混在里面的东西会静默消失——尤其 `core.hooksPath` 指向不存在的目录时 git **不报错、直接跳过所有钩子**；" +
	"另外 pi 启动会扫 `.pi` 下的固定名字做迁移检查，混放会每次弹警告。\n" +
	"确需执行请在命令末尾加 `# AI_ALLOW_PI_DIR`（须用户当次授权）。";

/** 从路径文本里抽出 `.pi/` 之后的第一个路径段；没有则 null。 */
export function piSegment(text: string): string | null {
	const m = /(?:^|[/\\])\.pi[/\\]([^/\\\s"'`]+)/.exec(text);
	return m ? m[1] : null;
}

/** 命令文本里所有 `.pi/<段>` 的段（会因为 `~/.pi/agent` 被排除而漏判，故先剔除全局目录）。 */
export function piSegments(text: string): string[] {
	const out: string[] = [];
	const re = /\.pi[/\\]([^/\\\s"'`;&|)]+)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) out.push(m[1]);
	return out;
}

/** 判断一个落盘目标路径是否违规；违规时返回命中的 `.pi/<段>`。 */
export function checkTargetPath(raw: string, cwd: string = process.cwd()): string | null {
	if (!raw || raw.includes(AUTH_MARK)) return null;
	const expanded = raw.startsWith("~") ? raw.replace(/^~(?=[/\\]|$)/, homedir()) : raw;
	let abs: string;
	try {
		abs = resolve(cwd, expanded);
	} catch {
		return null;
	}
	// 全局 pi 目录是 pi 自己的家，不在本规则约束范围
	if (abs === GLOBAL_AGENT_DIR || abs.startsWith(GLOBAL_AGENT_DIR + sep)) return null;
	const seg = piSegment(abs);
	if (!seg) return null;
	if (seg.startsWith(".")) return null; // .DS_Store 之类
	if (ALLOWED.has(seg)) return null;
	return seg;
}

/** 判断一条 shell 命令是否违规；违规时返回命中的 `.pi/<段>`。 */
export function checkCommand(command: string): string | null {
	if (!command || command.includes(AUTH_MARK)) return null;
	// 剔除全局 pi 目录（~/.pi/agent、$HOME/.pi/agent、/Users/xxx/.pi/agent）后再生效
	const stripped = command
		.replace(/\$\{?HOME\}?\/\.pi\/agent/g, "<GLOBAL_AGENT>")
		.replace(/~\/\.pi\/agent/g, "<GLOBAL_AGENT>")
		.split(homedir() + "/.pi/agent")
		.join("<GLOBAL_AGENT>");

	if (HOOKSPATH_TO_PI.test(stripped)) return ".pi（core.hooksPath）";

	const bad = piSegments(stripped).filter((s) => !s.startsWith(".") && !ALLOWED.has(s));
	if (bad.length === 0) return null;
	if (!WRITE_ACT.test(stripped)) return null;
	return bad[0];
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		try {
			// A) 写 / 编辑类工具：目标路径违规即拒绝
			if (event.toolName === "write" || event.toolName === "edit") {
				const path = (event.input as { path?: string })?.path ?? "";
				const hit = checkTargetPath(path);
				if (hit) {
					return {
						block: true,
						reason: `${REASON}\n\n（本次目标：\`${path}\`，命中 \`.pi/${hit}\`）`,
					};
				}
				return;
			}

			// B) / C) Shell：写动作 + 违规路径同时命中才拦
			if (event.toolName === "bash" || event.toolName === "powershell") {
				const command = (event.input as { command?: string })?.command ?? "";
				const hit = checkCommand(command);
				if (hit) {
					return { block: true, reason: `${REASON}\n\n（本次命中：\`${hit}\`）` };
				}
			}
		} catch {
			// 判定异常时不阻塞会话
		}
	});
}
