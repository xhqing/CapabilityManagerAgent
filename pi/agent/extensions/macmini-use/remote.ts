/**
 * macmini-use 的远端执行层：把命令送到 macmini 跑，并把结果带回来。
 *
 * 关键取舍：
 *   - 统一用 `ssh mac-mini bash -s` + stdin 传脚本，而不是把命令拼进 ssh 参数
 *     ——省掉多层引号地狱，命令原样执行，退出码也能原样带回。
 *   - 远端脚本开头固定 PATH：macmini 上 `bash -lc` 会拿到 Node 16（~/.profile 里的
 *     旧 nvm 路径），非登录 shell 的默认 PATH 才是 Node 22；显式钉住顺序，避免
 *     「同一个命令在两台机器上跑出不同 Node 版本」这种隐蔽差异。
 *   - 长任务用 nohup + 独立日志（/tmp/macmini-jobs/），SSH 断了也不影响；日志放
 *     /tmp 是刻意的——那不在 Syncthing 镜像里，不会把日志刷回本机。
 */

import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";

/** SSH 别名（见 ~/.ssh/config：Tailscale MagicDNS，任何网络都能连）。 */
export const REMOTE_HOST = "mac-mini";

/** macmini 上的家目录（本机是 /Users/xhq，两机目录结构一致、只差 home）。 */
export const REMOTE_HOME = "/Users/mac";

/** 远端固定 PATH：Node 22 在最前，其余是 macOS 默认位置。 */
const REMOTE_PATH_EXPORT =
	'export PATH="$HOME/.local/node/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"';

export interface MappedPath {
	/** macmini 上对应的绝对路径。 */
	remote: string;
	/** 是否落在两机镜像范围内（否：该路径在 macmini 上没有同一份数据）。 */
	mirrored: boolean;
}

/**
 * 把本机路径映射成 macmini 上的路径。
 * 规则与镜像一致：两机 `~/Developer`、`~/.pi/agent` 结构相同，只差 home。
 */
export function mapPath(localPath: string): MappedPath {
	let p = (localPath ?? "").trim();
	if (p === "" || p === "~") p = homedir();
	else if (p.startsWith("~/")) p = resolve(homedir(), p.slice(2));
	else if (!p.startsWith("/")) p = resolve(p);

	if (p === REMOTE_HOME || p.startsWith(REMOTE_HOME + "/")) {
		return { remote: p, mirrored: true }; // 调用方已经写了远端路径
	}
	const home = homedir();
	if (p === home) return { remote: REMOTE_HOME, mirrored: true };
	if (p.startsWith(home + "/")) return { remote: REMOTE_HOME + p.slice(home.length), mirrored: true };
	return { remote: p, mirrored: false };
}

/** 单引号安全引用（只用于我们自己拼的路径，不用于用户命令正文）。 */
export function shq(s: string): string {
	return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** 组装远端要执行的脚本正文（带 PATH、可选 cd）。 */
export function buildScript(remoteCwd: string | null, command: string): string {
	const lines: string[] = [REMOTE_PATH_EXPORT];
	if (remoteCwd) {
		lines.push(`cd ${shq(remoteCwd)} || {`);
		lines.push(`  echo "[macmini-use] 远端目录不存在：${remoteCwd}" >&2`);
		lines.push(`  echo "[macmini-use] 多半是刚在本机建的目录、Syncthing 还没同步过去（约 3 秒）；确认远端存在再跑。" >&2`);
		lines.push(`  exit 97`);
		lines.push(`}`);
	}
	lines.push(command);
	return lines.join("\n") + "\n";
}

export interface ExecResult {
	stdout: string;
	stderr: string;
	/** 远端退出码（SSH 自身失败时是 255 / null）。 */
	code: number | null;
	timedOut: boolean;
	durationMs: number;
}

export interface ExecOptions {
	timeoutMs: number;
	signal?: AbortSignal;
}

/**
 * 同步执行：把脚本从 stdin 交给远端 bash，等它跑完。
 * 超时只杀本地 ssh 进程，远端命令可能继续跑——长任务请改用 launchRemote。
 */
export function execRemote(script: string, opts: ExecOptions): Promise<ExecResult> {
	const started = Date.now();
	return new Promise((resolvePromise) => {
		const child = spawn(
			"ssh",
			[
				"-o", "BatchMode=yes",
				"-o", "ConnectTimeout=10",
				"-o", "ServerAliveInterval=20",
				"-o", "ServerAliveCountMax=3",
				REMOTE_HOST,
				"bash -s",
			],
			{ stdio: ["pipe", "pipe", "pipe"] },
		);

		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let settled = false;
		const finish = (code: number | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			opts.signal?.removeEventListener?.("abort", onAbort);
			resolvePromise({ stdout, stderr, code, timedOut, durationMs: Date.now() - started });
		};

		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
			setTimeout(() => child.kill("SIGKILL"), 1500);
		}, Math.max(1000, opts.timeoutMs));

		const onAbort = () => {
			child.kill("SIGTERM");
			setTimeout(() => child.kill("SIGKILL"), 1500);
		};
		opts.signal?.addEventListener?.("abort", onAbort, { once: true });

		child.stdout?.on("data", (b: Buffer) => {
			if (stdout.length < 4_000_000) stdout += b.toString("utf8");
		});
		child.stderr?.on("data", (b: Buffer) => {
			if (stderr.length < 1_000_000) stderr += b.toString("utf8");
		});
		child.on("error", (err) => {
			stderr += `[macmini-use] 无法启动 ssh：${err.message}\n`;
			finish(null);
		});
		child.on("close", (code) => finish(code));
		child.stdin?.end(script);
	});
}

export interface LaunchResult {
	jobId: string;
	pid: string;
	logPath: string;
	scriptPath: string;
	error?: string;
}

/**
 * 后台启动：把脚本写成远端 /tmp 下的文件，nohup 跑起来，立刻返回日志路径。
 * 之后用 `macmini_run` 执行 `tail -n 60 <log>` 取进度 / 结果。
 */
export async function launchRemote(script: string, label: string): Promise<LaunchResult> {
	const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	const hex = Buffer.from(script, "utf8").toString("hex");
	const scriptPath = `/tmp/macmini-jobs/${jobId}.sh`;
	const logPath = `/tmp/macmini-jobs/${jobId}.log`;
	const launcher = [
		"set -e",
		"mkdir -p /tmp/macmini-jobs",
		// 用 hex + xxd 写脚本：避开所有引号 / 换行 / $ 的转义问题。
		`printf '%s' '${hex}' | xxd -r -p > ${scriptPath}`,
		`nohup bash ${scriptPath} > ${logPath} 2>&1 < /dev/null &`,
		'echo "PID=$!"',
		label ? `echo "LABEL=${label.replace(/"/g, "")}"` : "true",
	].join("\n");

	const res = await execRemote(launcher, { timeoutMs: 60_000 });
	if (res.code !== 0) {
		return { jobId, pid: "", logPath, scriptPath, error: (res.stderr || res.stdout || "").trim() };
	}
	const pid = res.stdout.match(/^PID=(\d+)$/m)?.[1] ?? "";
	return { jobId, pid, logPath, scriptPath };
}

/** 两机负载概览脚本（macmini_status 用）。 */
export const STATUS_SCRIPT = [
	REMOTE_PATH_EXPORT,
	'echo "host=$(hostname)  arch=$(uname -m)  cores=$(sysctl -n hw.ncpu)  mem=$(($(sysctl -n hw.memsize) / 1073741824))GB"',
	'echo "load=$(sysctl -n vm.loadavg | tr -d "{}")"',
	'echo "disk=$(df -h / | tail -1 | awk \'{print $4 " 可用 / " $2 " 总"}\')"',
	'echo "--- 占 CPU 前 5 的进程 ---"',
	"ps -Ao pcpu,pmem,comm -r | head -6",
	'echo "--- tmux 会话 ---"',
	"tmux ls 2>/dev/null | head -10 || echo '(无)'",
	'echo "--- /tmp/macmini-jobs 最近日志 ---"',
	"ls -t /tmp/macmini-jobs/*.log 2>/dev/null | head -5 || echo '(无)'",
].join("\n");
