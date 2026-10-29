/**
 * 会话保护守卫（pi 端，tool_call 拦截）。
 *
 * 2026-10-04 用户立规：**用户终端窗口里的 pi 会话（前台）由他本人操作，禁止 agent
 * 用命令关闭**——他能看见这些会话、也会自己处理；同理不许把 tmux 服务器整个端掉
 * （`tmux kill-server` 会连用户的 tmux 会话一起杀）。agent 关闭后台会话只有一条
 * 合法路径：`tmux kill-session -t <pi-名字>`。
 *
 * 背景：用户在「后台会话用完即清」立规后立刻补了一条边界——清后台可以，动他终端里的
 * 前台会话不行。风险很实：`pkill -f "pi -n"`、`kill <pid>`、`tmux kill-server` 这三类
 * 写法都会误伤用户正在用的会话。
 *
 * 判定逻辑由 pi 端独立维护（2026-10-17 起为唯一实现）。
 *
 * 拦截三类（命令带标记 `AI_AUTHORIZED_SESSION_KILL` 放行）：
 * 1. `tmux kill-server`——一律拦；
 * 2. `tmux kill-session`——只有 `-t` 指向 `pi-` 前缀的名字才放行；
 * 3. `kill` / `pkill` / `killall` 打 pi 进程——按两种方式识别：
 *    a) **kill 命令的目标参数**里出现 pi 相关特征（`pi` 单词、`pi -n`、`.pi/agent`）；
 *    b) 目标是具体 pid 且实测该 pid 的命令名就是 `pi`（运行 `ps` 判断，抓裸 `kill <pid>`）。
 *
 * 2026-10-29 修正（用户澄清口径：只禁止杀前台 pi 会话，其它进程可以杀）：原实现是
 * 「整条命令里同时出现 kill 类词与 pi 字样」即拦，导致 `pkill -f mosh-server` 与同一条
 * 命令里的 `tmux kill-session -t pi-xxx` 连坐误报。现改为只检查 kill 的**目标参数**——
 * `pkill -f mosh-server` 放行，`pkill -f "pi -n"` / `killall pi` 仍拦。
 * 目标为空（如 `... | xargs kill`）时退回整条命令判断，保持保守、避免漏拦。
 */

import { execFileSync } from "node:child_process";
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AUTH_MARK = "AI_AUTHORIZED_SESSION_KILL";

/** 允许被 agent 关闭的会话名前缀（其余 tmux 会话属用户自己的）。 */
const ALLOWED_SESSION_PREFIX = "pi-";

// tmux 两条危险操作
// 2026-10-14 修正：kill-session 判定收紧（tmux + 若干“-”选项 +
// kill-session 紧凑相邻）——原 `(\S+\s+)*?` 允许 tmux 与 kill-session 之间跨越任意词，
// 会把「命令文本里恰好同时出现 tmux 与 kill-session 字样」的只读命令误判成真命令拦截
//（实测误伤：一条含 `tmux list-sessions` 与 `grep "kill-session"` 的排查命令被拦）。
const TMUX_KILL_SERVER = /(^|[^A-Za-z0-9_])tmux\s+kill-server([^A-Za-z0-9_-]|$)/;
const TMUX_KILL_SESSION = /(^|[^A-Za-z0-9_])tmux\s+(-\S+\s+)*kill-session([^A-Za-z0-9_-]|$)/;
// kill / pkill / killall
const KILLISH = /(^|[^A-Za-z0-9_])(kill|pkill|killall)([ \t]|$)/;
// 文本里是否提到 pi 进程
const PI_MENTION = /(^|[^A-Za-z0-9_.-])pi([^A-Za-z0-9_]|$)|\.pi\/agent|pi\s+-n\b/;

/**
 * 命令里每个 kill / pkill / killall 的「目标参数」部分（不含命令词本身）。
 * 只在这部分里找 pi 特征，避免同一条命令别处的 pi 字样连坐。
 * `kill-session`、`pkillall` 之类的词不会被误当成 kill 命令（命令词后必须是空白或行尾）。
 */
function killTargets(command: string): string[] {
	const targets: string[] = [];
	for (const m of command.matchAll(
		/(?:^|[\s;&|(`])(kill|pkill|killall)(?=[ \t]|$)([^\n;&|`)]*)/g,
	)) {
		targets.push(m[2] ?? "");
	}
	return targets;
}

const DENY_SERVER =
	"[session-guard] 拦截：禁止 `tmux kill-server`——它会把**用户自己的 tmux 会话一起端掉**" +
	"（2026-10-04 用户立规：终端里的会话由用户本人操作）。只关某一个后台会话请用 " +
	"`tmux kill-session -t <pi-名字>`；确需 kill-server 时加标记 `# AI_AUTHORIZED_SESSION_KILL`" +
	"（用户授权后使用）。";

const DENY_SESSION = (name: string) =>
	"[session-guard] 拦截：`tmux kill-session -t " +
	name +
	"` 指向的不是 `pi-` 前缀的后台会话——用户终端里的会话（及其它 tmux 会话）只能由用户" +
	"自己操作（2026-10-04 用户立规）。agent 只能关闭 `pi-` 前缀的后台会话；确需操作时加" +
	"标记 `# AI_AUTHORIZED_SESSION_KILL`（用户授权后使用）。";

const DENY_KILL =
	"[session-guard] 拦截：禁止用 kill / pkill / killall 关闭 pi 会话——用户终端里的前台" +
	"会话就在其中、由他本人操作（2026-10-04 用户立规）。关闭**后台**会话请用 " +
	"`tmux kill-session -t <pi-名字>`（这才是唯一合法路径）；确需强杀时加标记 " +
	"`# AI_AUTHORIZED_SESSION_KILL`（用户授权后使用）。";

/** 该 pid 的进程名是否是 pi。 */
function isPiProcess(pid: string): boolean {
	try {
		const out = execFileSync("ps", ["-o", "command=", "-p", pid], {
			encoding: "utf8",
			timeout: 5000,
		}).trim();
		return out === "pi" || /^pi\s/.test(out);
	} catch {
		return false;
	}
}

/** kill 命令里出现的候选 pid（排除信号号等短数字）。 */
function candidatePids(command: string): string[] {
	const pids: string[] = [];
	for (const m of command.matchAll(/(?:^|[\s;&|])(\d{2,7})(?=[\s;&|]|$)/g)) {
		pids.push(m[1]);
	}
	return [...new Set(pids)];
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		try {
			if (event.toolName !== "bash" && event.toolName !== "powershell") return;
			const command = (event.input as { command?: string })?.command ?? "";
			if (!command || command.includes(AUTH_MARK)) return;

			if (TMUX_KILL_SERVER.test(command)) {
				return { block: true, reason: DENY_SERVER };
			}
			if (TMUX_KILL_SESSION.test(command) && !/pi-[A-Za-z0-9_-]+/.test(command)) {
				const m = command.match(/-t[ \t]+([^\s;&|]+)/);
				return { block: true, reason: DENY_SESSION(m?.[1] ?? "（未指定名字）") };
			}
			if (KILLISH.test(command)) {
				// 只看 kill 的目标参数：杀 mosh-server / node 等非 pi 进程放行，
				// 只有目标确实是 pi 时才拦。目标为空（`... | xargs kill`）退回整条命令判断。
				for (const target of killTargets(command)) {
					if (PI_MENTION.test(target || command)) {
						return { block: true, reason: DENY_KILL };
					}
				}
				for (const pid of candidatePids(command)) {
					if (isPiProcess(pid)) {
						return { block: true, reason: DENY_KILL };
					}
				}
			}
		} catch {
			// 判定异常时不阻塞会话
		}
	});
}
