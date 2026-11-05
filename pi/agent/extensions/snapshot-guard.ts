/**
 * 受保护共享目录的「改前快照」守卫（pi 端，tool_call 拦截）。
 *
 * 背景（2026-11-05 用户立的方案）：架构改成「代码走 GitHub、只有 `~/.pi/agent` 与
 * `~/.dev/private` 用 Syncthing 同步」之后，这两个目录成了全队最不可重建的东西：
 *   - `~/.pi/agent`：全局规则 / skills / extensions / patch / docs（能力层本身）；
 *   - `~/.dev/private`：各项目私有内容的本体（项目里只有软链接指过来）。
 * 同时用户要求「macmini 也要能改删这两个目录」，所以放开删除权限的同时必须加一道
 * 前置条件：**改之前先有一次新鲜快照**（飞书云盘 + 本地各留最近 5 份）。
 *
 * 判定（快照令牌在 `~/.dev/private/.state/snapshot-token.json`，随 Syncthing 同步，
 * 因此任一侧做的快照另一侧也认）：
 *   A) write / edit 类工具写到受保护目录内 → 要求 30 分钟内的快照（fresh 模式）。
 *   B) bash 命令里同时出现「受保护目录」与「会改内容的动作」：
 *        - 删除 / 移动类（rm / mv / unlink / shred / truncate / find -delete / rsync --delete）
 *          → 要求快照与当前内容**完全一致**（strict 模式，防止「编辑半小时后一把删掉」）；
 *        - 其它写入（tee / 重定向 / sed -i / cp / chmod / tar -x / patch …）→ fresh 模式。
 *   C) 无论有没有快照，**删这两个目录根本身**一律拒绝（删掉同步目录根会让 Syncthing
 *      两端状态难以收拾）。
 *
 * 豁免：`~/.dev/private/.state/`（令牌文件本身）、`~/.dev/snapshots/`（快照产物）、
 * 以及命令里显式运行 dev-snapshots.py 自身。
 *
 * 快照命令：
 *   python3 ~/.pi/agent/patch/dev-snapshots/dev-snapshots.py snapshot pi-agent
 *   python3 ~/.pi/agent/patch/dev-snapshots/dev-snapshots.py snapshot private
 *
 * 判定全程防御性 catch：本扩展失灵时不阻塞会话（与其它守卫一致）。
 */

import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const HOME = homedir();
export const GUARDED_ROOTS = [`${HOME}/.pi/agent`, `${HOME}/.dev/private`];
const EXEMPT = [
	`${HOME}/.dev/private/.state`,
	`${HOME}/.dev/snapshots`,
	// pi 的运行时数据：会话记录 / 状态文件 / 日志，随时可重建，且是 AI 最常读写的路径——
	// 不豁免的话「读会话记录 + 任意删除动作」就会误判成「要改受保护目录」（2026-11-05 实测两次误拦）。
	`${HOME}/.pi/agent/sessions`,
	`${HOME}/.pi/agent/state`,
	`${HOME}/.pi/agent/logs`,
];
const SNAP_TOOL = `${HOME}/.pi/agent/patch/dev-snapshots/dev-snapshots.py`;

/** 目录根本身（等于这些路径的删除一律拒绝）。 */
export const ROOT_PATHS = GUARDED_ROOTS;

/** 删除 / 移动类动作：strict 模式。 */
export const DELETE_VERBS =
	/(^|[^A-Za-z0-9_])(rm|unlink|shred|trash|truncate|mv)([ \t]|$)|\s-delete([ \t]|$)|--delete([ \t]|$)/;

/**
 * 其它会改内容的动作：fresh 模式。
 *
 * 注意 `cat` / `echo` / `printf` 已移出：它们只在**带重定向**时写盘，而重定向由下面的
 * `>>?` 分支覆盖。留着它们会把 `cat ~/.pi/agent/sessions/xxx.jsonl` 这类纯读命令判成写
 * （2026-11-05 实测因此误拦过一次）。
 */
export const WRITE_VERBS =
	/(^|[^A-Za-z0-9_])(cp|tee|sed|chmod|chown|ln|touch|install|patch|rsync|tar|unzip|ditto|dd|python|python3|node|perl|ruby)([ \t]|$)|>>?[ \t]*[^ \t>|]|sed[ \t]+-i|\bfind\b.*-delete/;

/** 把豁免路径从命令文本里挖掉，避免「读一次会话记录」被当成「要改受保护目录」。 */
function stripExempt(command: string): string {
	// 带 `..` 的命令不享豁免：`~/.pi/agent/state/../skills` 这种路径穿越能绕过文本匹配。
	// 宁可在这种写法上多拦一次，也不给绕行留口子。
	if (command.includes("..")) return command;
	let out = command;
	for (const path of EXEMPT) {
		for (const form of [path, path.replace(HOME, "~"), path.replace(HOME, "$HOME")]) {
			if (form && form.length > 1) out = out.split(form).join("<EXEMPT>");
		}
	}
	return out;
}

/** 命令里是否出现受保护目录（也认 `~` 写法）。 */
export function mentionsGuarded(command: string): string[] {
	const hits: string[] = [];
	const text = stripExempt(command);
	for (const root of GUARDED_ROOTS) {
		const tilde = root.replace(HOME, "~");
		const dollar = root.replace(HOME, "$HOME");
		if (text.includes(root) || text.includes(tilde) || text.includes(dollar)) {
			hits.push(root);
		}
	}
	return hits;
}

/** 目标是否落在豁免路径内。 */
function exempt(path: string): boolean {
	return EXEMPT.some((p) => path === p || path.startsWith(p + "/"));
}

/** 是否是「删目录根」的动作（目标归一化后与根本身完全相同才算）。 */
export function isRootDelete(command: string): boolean {
	const segs = command.split(/&&|\|\||;|\n|\|/);
	for (const raw of segs) {
		const seg = raw.trim();
		const m = seg.match(/^(?:sudo\s+)?(rm|mv|unlink|shred|truncate)\s+((?:-\S+\s+)*)(.*)$/);
		if (!m) continue;
		for (const t of m[3].split(/\s+/)) {
			if (!t || t.startsWith("-")) continue;
			const abs = t
				.replace(/^\$\{?HOME\}?(?=\/|$)/, HOME)
				.replace(/^~(?=\/|$)/, HOME)
				.replace(/\/+$/, "");
			if (ROOT_PATHS.includes(abs)) return true;
		}
	}
	return false;
}

function runCheck(targets: string[], freshMin: number): { ok: boolean; out: string } {
	const args = [SNAP_TOOL, "check", ...targets];
	if (freshMin > 0) args.push("--fresh-min", String(freshMin));
	try {
		const out = execFileSync("python3", args, { encoding: "utf-8", timeout: 30_000 });
		return { ok: true, out };
	} catch (e) {
		const anyE = e as { stdout?: string; stderr?: string };
		return { ok: false, out: (anyE.stdout ?? "") + (anyE.stderr ?? "") };
	}
}

const DENY = (detail: string, target: string) =>
	`[snapshot-guard] 拦截：改 \`${target}\` 之前必须先做一次快照。\n` +
	`为什么：这两个目录（~/.pi/agent、~/.dev/private）不再有「整套项目目录同步」兜底，` +
	`它们是全队最不可重建的东西，误删一次就是永久损失。\n` +
	`现在的内容状态：\n${detail}` +
	`\n做法：先跑（几秒到十几秒，飞书 + 本地各留最近 5 份）\n` +
	`  python3 ~/.pi/agent/patch/dev-snapshots/dev-snapshots.py snapshot ${target}\n` +
	`成功后重试当前操作。恢复：` +
	`dev-snapshots.py restore ${target}（恢复前会自动先给现状留一份）。`;

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		try {
			// A) 写 / 编辑类工具
			if (event.toolName === "write" || event.toolName === "edit") {
				const path = (event.input as { path?: string })?.path ?? "";
				if (!path) return;
				const abs = path.replace(/^~(?=\/|$)/, HOME);
				const root = GUARDED_ROOTS.find((r) => abs === r || abs.startsWith(r + "/"));
				if (!root || exempt(abs)) return;
				const target = root.endsWith(".pi/agent") ? "pi-agent" : "private";
				const r = runCheck([target], 30);
				if (!r.ok) return { block: true, reason: DENY(r.out.trim(), target) };
				return;
			}

			// B) / C) Shell
			if (isToolCallEventType("bash", event) || event.toolName === "powershell") {
				const command = (event.input as { command?: string })?.command ?? "";
				if (!command) return;
				if (command.includes(SNAP_TOOL) || command.includes("dev-snapshots.py")) return;

				// C) 删根：无论有没有快照都拒绝
				if (isRootDelete(command)) {
					return {
						block: true,
						reason:
							"[snapshot-guard] 拦截：禁止删除 `~/.pi/agent` 或 `~/.dev/private` 目录**本身**。\n" +
							"这两个目录在 Syncthing 里是共享根——删掉根会让对端的目录状态变得难以收拾，恢复成本远高于收益。\n" +
							"允许的操作：改删目录**里面**的内容（先做快照）；真要清空某一个子目录，请逐个删子目录、不要删根。",
					};
				}

				const roots = mentionsGuarded(command);
				if (roots.length === 0) return;
				const strict = DELETE_VERBS.test(command);
				if (!strict && !WRITE_VERBS.test(command)) return; // 只读命令放行

				// 只提到豁免路径（会话记录 / state / 日志）时不算「要改受保护目录」：
				// mentionsGuarded 是按整条命令文本匹配的，读一次会话文件就会命中。
				const targets = roots.map((r) => (r.endsWith(".pi/agent") ? "pi-agent" : "private"));
				const uniqueTargets = [...new Set(targets)];
				const guardTarget = uniqueTargets.length > 1 ? "both" : (uniqueTargets[0] ?? "both");
				const r = runCheck([guardTarget], strict ? 0 : 30);
				if (!r.ok) {
					return { block: true, reason: DENY(r.out.trim(), guardTarget) };
				}
			}
		} catch {
			// 判定异常时不阻塞会话
		}
	});
}
