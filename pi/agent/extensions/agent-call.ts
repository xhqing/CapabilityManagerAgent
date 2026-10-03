/**
 * Agent Call Extension（agent-call）
 *
 * 跨会话调用工具（基于 pi-intercom）：确保目标 pi 会话在线（不在线则自动启动），
 * 然后发送消息——mode=ask 阻塞等待回复，mode=send 仅投递通知。
 *
 * 解决「对方会话没开着，任务被阻塞」的问题：
 *   1. 用 `pi-intercom list --json` 检查目标是否在线；
 *   2. 不在线时用 tmux 在目标项目目录启动 `pi -n <名字>`（名字即 pi-intercom 别名）；
 *   3. 轮询等待对方注册到 intercom，再发送消息。
 *
 * 两条发送通道（各有取舍，均已按 pi-intercom 的官方接口实现）：
 *   - send：走 pi-intercom 的扩展 Outbox 事件通道（intercom:outbox-request），
 *     消息以「本会话」身份发出，对方能正确看到发送者；
 *   - ask：走 pi-intercom CLI（阻塞等待回复，超时可控）。CLI 以工具身份注册
 *     （pi-intercom-cli），因此消息会自动附带「来自会话 <名字>」签名，
 *     接收方按签名回复即可（回复经 pending-ask 通道返回本工具）。
 *
 * 依赖：pi-intercom（`pi install npm:pi-intercom`）+ tmux + pi 命令可用。
 *
 * 环境变量（均可选）：
 *   PI_INTERCOM_CLI   pi-intercom CLI 路径覆盖（默认探测 ~/.pi/agent/npm/node_modules/.bin/pi-intercom）
 *   PI_AGENT_BIN      启动新会话用的 pi 命令（默认 "pi"）
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const DEFAULT_WAIT_SECONDS = 20;
const DEFAULT_TIMEOUT_MS = 120_000;
const OUTBOX_REQUEST_EVENT = "intercom:outbox-request";
const OUTBOX_RESULT_EVENT = "intercom:outbox-result";
const OUTBOX_TIMEOUT_MS = 20_000;

interface SessionInfo {
	name?: string;
	status?: string;
	cwd?: string;
}

interface OutboxResult {
	requestId?: string;
	status?: string;
	code?: string;
	detail?: string;
	messageId?: string;
}

function findIntercomCli(): string {
	const fromEnv = process.env.PI_INTERCOM_CLI;
	if (fromEnv) return fromEnv;
	const candidate = join(homedir(), ".pi", "agent", "npm", "node_modules", ".bin", "pi-intercom");
	if (existsSync(candidate)) return candidate;
	return "pi-intercom";
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listSessions(pi: ExtensionAPI, signal?: AbortSignal): Promise<SessionInfo[]> {
	const cli = findIntercomCli();
	const result = await pi.exec(cli, ["list", "--json"], { signal, timeout: 15_000 });
	if (result.code !== 0) {
		throw new Error(`pi-intercom list 失败（退出码 ${result.code}）：${(result.stderr || result.stdout).trim().slice(0, 300)}`);
	}
	try {
		const data = JSON.parse(result.stdout) as { sessions?: SessionInfo[] };
		return data.sessions ?? [];
	} catch {
		throw new Error(`pi-intercom list 输出无法解析：${result.stdout.slice(0, 200)}`);
	}
}

async function isOnline(pi: ExtensionAPI, name: string, signal?: AbortSignal): Promise<boolean> {
	const sessions = await listSessions(pi, signal);
	return sessions.some((s) => s.name === name);
}

async function wakeSession(
	pi: ExtensionAPI,
	name: string,
	dir: string,
	waitSeconds: number,
	signal?: AbortSignal,
): Promise<{ ok: boolean; detail: string }> {
	if (await isOnline(pi, name, signal)) {
		return { ok: true, detail: `会话「${name}」已在线` };
	}
	const tmuxSession = `pi-${name}`;
	const has = await pi.exec("tmux", ["has-session", "-t", tmuxSession], { signal, timeout: 5_000 });
	if (has.code !== 0) {
		const piBin = process.env.PI_AGENT_BIN ?? "pi";
		const start = await pi.exec(
			"tmux",
			["new-session", "-d", "-s", tmuxSession, "-c", dir, `${piBin} -n ${name}`],
			{ signal, timeout: 10_000 },
		);
		if (start.code !== 0) {
			return { ok: false, detail: `启动 tmux 会话失败：${(start.stderr || start.stdout).trim().slice(0, 300)}` };
		}
	}
	for (let i = 1; i <= waitSeconds; i++) {
		if (signal?.aborted) return { ok: false, detail: "已取消" };
		await sleep(1_000);
		if (await isOnline(pi, name, signal)) {
			return { ok: true, detail: `已唤醒「${name}」（${i} 秒完成注册）` };
		}
	}
	return { ok: false, detail: `等待 ${waitSeconds} 秒后「${name}」仍未注册到 intercom（可检查目标目录是否正确）` };
}

export default function agentCallExtension(pi: ExtensionAPI) {
	// ---------------------------------------------------------------------------
	// Outbox 通道：send 模式以「本会话」身份发送（pi-intercom 扩展 API）
	// ---------------------------------------------------------------------------
	const pendingOutbox = new Map<string, (result: OutboxResult) => void>();
	pi.events.on(OUTBOX_RESULT_EVENT, (result: OutboxResult) => {
		if (!result || typeof result.requestId !== "string") return;
		const resolver = pendingOutbox.get(result.requestId);
		if (resolver) {
			pendingOutbox.delete(result.requestId);
			resolver(result);
		}
	});

	async function sendViaOutbox(to: string, message: string): Promise<{ ok: boolean; detail: string }> {
		const requestId = `agent-call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		return await new Promise((resolve) => {
			const timer = setTimeout(() => {
				pendingOutbox.delete(requestId);
				resolve({ ok: false, detail: "等待 pi-intercom 发送结果超时（请确认本会话已启用 pi-intercom）" });
			}, OUTBOX_TIMEOUT_MS);
			pendingOutbox.set(requestId, (result) => {
				clearTimeout(timer);
				if (result.status === "sent") {
					resolve({
						ok: true,
						detail: `消息已送达「${to}」（以本会话身份发送${result.messageId ? `，消息 id ${result.messageId}` : ""}）`,
					});
				} else {
					resolve({
						ok: false,
						detail: `发送失败（${result.code ?? result.status ?? "未知"}）${result.detail ? `：${result.detail}` : ""}`,
					});
				}
			});
			pi.events.emit(OUTBOX_REQUEST_EVENT, {
				version: 1,
				requestId,
				extensionId: "agent-call",
				extensionName: "Agent Call",
				to,
				message,
			});
		});
	}

	// ---------------------------------------------------------------------------
	// CLI 通道：ask 模式阻塞等待回复（自动附加发送者签名）
	// ---------------------------------------------------------------------------
	async function askViaCli(
		name: string,
		message: string,
		timeoutMs: number,
		signal?: AbortSignal,
	): Promise<{ ok: boolean; detail: string; reply?: string }> {
		const sessionName = pi.getSessionName()?.trim();
		const signed = sessionName
			? `${message}\n\n（来自 pi 会话「${sessionName}」；请直接回复本会话。）`
			: message;
		const cli = findIntercomCli();
		const result = await pi.exec(
			cli,
			["ask", "--to", name, "--text", signed, "--json", "--timeout-ms", String(timeoutMs)],
			{ signal, timeout: timeoutMs + 20_000 },
		);
		let parsed: { ok?: boolean; error?: string; reply?: string; text?: string } | undefined;
		try {
			parsed = JSON.parse(result.stdout);
		} catch {
			parsed = undefined;
		}
		if (result.code === 0 && (parsed?.ok ?? true)) {
			return { ok: true, detail: `「${name}」的回复已收到`, reply: parsed?.reply ?? parsed?.text };
		}
		if (result.code === 2) {
			return { ok: false, detail: `等待「${name}」回复超时（${Math.round(timeoutMs / 1000)} 秒）` };
		}
		const err = parsed?.error ?? (result.stderr || result.stdout).trim().slice(0, 300);
		return { ok: false, detail: `发送失败（退出码 ${result.code}）：${err}` };
	}

	// ---------------------------------------------------------------------------
	// 工具注册
	// ---------------------------------------------------------------------------
	pi.registerTool({
		name: "agent_wake",
		label: "Agent Wake",
		description:
			"确保另一个 pi 会话（pi-intercom 互通）处于在线状态：若不在线，则在指定项目目录用 tmux 启动一个新 pi 会话（pi -n <名字>，名字即 intercom 别名）并等待其注册。可在 agent_call 之前预热，或单独准备对方会话。",
		parameters: Type.Object({
			name: Type.String({ description: "目标会话名字（pi-intercom 别名，与 /alias 或 pi -n 设置一致）" }),
			dir: Type.String({ description: "目标会话的启动工作目录（绝对路径或 ~ 开头）" }),
			wait_seconds: Type.Optional(
				Type.Number({ description: `等待注册的最长秒数（默认 ${DEFAULT_WAIT_SECONDS}）`, minimum: 3, maximum: 120 }),
			),
		}),
		async execute(_toolCallId, params, signal) {
			const name = String(params.name ?? "").trim();
			const dir = String(params.dir ?? "").trim();
			if (!NAME_RE.test(name)) {
				return { content: [{ type: "text", text: `名字不合法：「${name}」——只允许字母、数字、点、下划线、连字符（首字符须为字母或数字）` }] };
			}
			if (!dir) {
				return { content: [{ type: "text", text: "缺少 dir：需要目标项目的目录路径才能启动会话。" }] };
			}
			const wait = Math.min(Math.max(Number(params.wait_seconds ?? DEFAULT_WAIT_SECONDS), 3), 120);
			try {
				const r = await wakeSession(pi, name, dir, wait, signal);
				return { content: [{ type: "text", text: r.ok ? `✅ ${r.detail}` : `❌ ${r.detail}` }] };
			} catch (error) {
				return { content: [{ type: "text", text: `❌ 唤醒失败：${error instanceof Error ? error.message : String(error)}` }] };
			}
		},
	});

	pi.registerTool({
		name: "agent_call",
		label: "Agent Call",
		description:
			"调用另一个 pi 会话（pi-intercom 互通）：先确保对方在线（不在线且提供了 dir 时自动唤醒），再发送消息。mode=send 以本会话身份发送通知（不等待）；mode=ask（默认）阻塞等待对方回复。消息为纯文本，对方看不到本会话上下文，请自带背景与明确请求。",
		parameters: Type.Object({
			name: Type.String({ description: "目标会话名字（pi-intercom 别名）" }),
			message: Type.String({ description: "消息内容（对方看不到本会话上下文，请自带背景与明确请求）" }),
			dir: Type.Optional(Type.String({ description: "目标会话工作目录；对方不在线时用它自动唤醒（建议总是提供）" })),
			mode: Type.Optional(
				StringEnum(["ask", "send"] as const, { description: "ask=阻塞等回复（默认）；send=仅通知、以本会话身份发送" }),
			),
			timeout_ms: Type.Optional(
				Type.Number({ description: `ask 等待回复的超时毫秒数（默认 ${DEFAULT_TIMEOUT_MS}）`, minimum: 10_000, maximum: 1_800_000 }),
			),
		}),
		async execute(_toolCallId, params, signal, onUpdate) {
			const name = String(params.name ?? "").trim();
			const message = String(params.message ?? "").trim();
			const dir = typeof params.dir === "string" ? params.dir.trim() : "";
			const mode = (params.mode === "send" ? "send" : "ask") as "ask" | "send";
			const timeoutMs = Math.min(Math.max(Number(params.timeout_ms ?? DEFAULT_TIMEOUT_MS), 10_000), 1_800_000);

			if (!NAME_RE.test(name)) {
				return { content: [{ type: "text", text: `名字不合法：「${name}」——只允许字母、数字、点、下划线、连字符（首字符须为字母或数字）` }] };
			}
			if (!message) {
				return { content: [{ type: "text", text: "消息内容不能为空。" }] };
			}
			try {
				const online = await isOnline(pi, name, signal);
				if (!online) {
					if (!dir) {
						return {
							content: [{
								type: "text",
								text: `「${name}」当前不在线，且未提供 dir——无法自动唤醒。请提供目标项目目录后重试，或等对方开启会话。`,
							}],
						};
					}
					onUpdate?.({ content: [{ type: "text", text: `「${name}」不在线，正在唤醒…` }] });
					const woke = await wakeSession(pi, name, dir, DEFAULT_WAIT_SECONDS, signal);
					if (!woke.ok) {
						return { content: [{ type: "text", text: `❌ 无法联系「${name}」：${woke.detail}` }] };
					}
					onUpdate?.({ content: [{ type: "text", text: `✅ ${woke.detail}，正在发送消息…` }] });
				}
				if (mode === "send") {
					const sent = await sendViaOutbox(name, message);
					return { content: [{ type: "text", text: sent.ok ? `✅ ${sent.detail}` : `❌ ${sent.detail}` }] };
				}
				const asked = await askViaCli(name, message, timeoutMs, signal);
				if (!asked.ok) {
					return { content: [{ type: "text", text: `❌ ${asked.detail}` }] };
				}
				const lines = [`✅ ${asked.detail}`];
				if (asked.reply) lines.push("", `「${name}」的回复：`, asked.reply);
				return { content: [{ type: "text", text: lines.join("\n") }] };
			} catch (error) {
				return { content: [{ type: "text", text: `❌ 调用失败：${error instanceof Error ? error.message : String(error)}` }] };
			}
		},
	});
}
