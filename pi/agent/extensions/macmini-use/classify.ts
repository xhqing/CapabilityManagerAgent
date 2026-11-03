/**
 * macmini-use 的纯判定逻辑（不依赖 pi 运行时，可单独测试）。
 *
 * 三件事：
 *   ① 当前是不是 macmini（是则整个扩展不生效——不能把活分流给「自己」）；
 *   ② 一条本机命令是不是「重型、可分流」的活（命中则拦下，要求改用 macmini_run）；
 *   ③ 一条远端命令是不是在镜像目录里递归删除（macmini 上删 = 本机也删，必须先确认）。
 *
 * 设计口径（2026-11-03 用户立）：本机是用户正在用的 MacBook Air（8 核 / 8GB），
 * macmini 是 12 核 / 32GB 的常驻算力机。目标不是「什么都往远端扔」，而是把
 * **会长时间占满本机 CPU / 内存的活**挪走，短命令留在本机（SSH 往返反而更慢）。
 * 所以这里的重型清单只收「明显长耗时且 macmini 能接得住」的类型（编译 / 重构建 /
 * 转码 / OCR / 语音转写），不把常见的几秒级命令（npm run build、pytest 单文件等）算进来，
 * 也不收 macmini 上跑不了的（xcodebuild 需要完整 Xcode、Docker daemon 在 macmini 上是坏的）
 * ——那些交给系统提示里的每轮分流判断按实际情况决定。
 */

import { hostname } from "node:os";
import { posix } from "node:path";

/** 当前机器是不是 macmini（与 git-readonly-guard / session-link 的判定同口径）。 */
export function isMacminiHost(host: string = hostname()): boolean {
	const h = host.toLowerCase();
	return h.includes("mac-mini") || h.includes("macmini");
}

/** 本地执行重型命令的逃生标记：确需在本机跑时，命令末尾带上它 + 一句话理由。 */
export const LOCAL_MARK = "AI_LOCAL_OK";

/** 远端递归删除的逃生标记：确认要同步删除本机副本时带上。 */
export const REMOTE_RM_MARK = "AI_REMOTE_RM_OK";

/** 命令段切分：&& / || / ; / 换行 / 管道（与其它守卫同口径）。 */
const SEGMENT_SPLIT = /&&|\|\||;|\n|\|/;

/** 命令段开头的「包装」：环境变量赋值、timeout、nice、nohup、sudo、env。 */
const WRAPPERS: RegExp[] = [
	/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/,
	/^timeout\s+(?:-\S+\s+)*\d+(?:\.\d+)?[smhd]?\s+/,
	/^nice\s+(?:-n\s*\d+\s+)?/,
	/^nohup\s+/,
	/^sudo\s+(?:-\S+\s+)*/,
	/^command\s+/,
	/^env\s+(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*/,
];

/** 剥掉命令段开头的包装，露出真正的可执行命令（最多剥 6 层，防死循环）。 */
export function stripWrappers(segment: string): string {
	let s = segment.trim();
	for (let round = 0; round < 6; round++) {
		let changed = false;
		for (const re of WRAPPERS) {
			const next = s.replace(re, "");
			if (next !== s) {
				s = next.trimStart();
				changed = true;
			}
		}
		if (!changed) break;
	}
	return s;
}

/** 已经是远端执行的命令段：不再按「本机重型命令」拦。 */
const REMOTE_HEAD_RE = /^(?:ssh|scp|sftp|rsync|et|macmini|macmini-tmux)(?:\s|$)/;

/**
 * 重型命令清单（只收「长耗时且产物可回传」的类型）。
 * 每条都锚定命令段开头，避免 `echo xcodebuild` / `git commit -m "xcodebuild"` 误报。
 */
const HEAVY: Array<{ label: string; re: RegExp }> = [
	{ label: "swift build/test（Swift 编译）", re: /^swift\s+(?:build|test|package|run)(?:\s|$)/ },
	{ label: "cargo build/test/bench（Rust 编译）", re: /^cargo\s+(?:build|test|bench|run|clippy)(?:\s|$)/ },
	{ label: "rustc（Rust 编译）", re: /^rustc(?:\s|$)/ },
	{ label: "go build/test（Go 编译）", re: /^go\s+(?:build|test|vet|run)(?:\s|$)/ },
	{ label: "cmake --build", re: /^cmake\s+--build(?:\s|$)/ },
	{ label: "ninja 构建", re: /^ninja(?:\s|$)/ },
	{ label: "make -j 并行构建", re: /^(?:make|gmake)\b[^\n]*\s-j(?:\s*\d+)?(?:\s|$)/ },
	{ label: "Gradle / Maven / dotnet 构建", re: /^(?:\.\/)?(?:gradlew?|mvnw?|dotnet)\s+(?:build|test|publish|run|assemble|install)(?:\s|$)/ },
	{ label: "ffmpeg（音视频转码）", re: /^ffmpeg(?:\s|$)/ },
	{ label: "tesseract（OCR）", re: /^tesseract(?:\s|$)/ },
	{ label: "whisper（语音转写）", re: /^(?:whisper|whisper-cli)(?:\s|$)/ },
];

export interface HeavyHit {
	label: string;
	/** 命中的那一段命令（截断展示用）。 */
	segment: string;
}

/**
 * 判断一条本机命令是否属于「应分流到 macmini」的重型命令。
 * 返回 null 表示不拦（放行）。
 */
export function detectHeavy(command: string): HeavyHit | null {
	if (!command) return null;
	for (const raw of command.split(SEGMENT_SPLIT)) {
		const seg = stripWrappers(raw);
		if (!seg) continue;
		if (REMOTE_HEAD_RE.test(seg)) continue; // 已经在远端跑
		for (const h of HEAVY) {
			if (h.re.test(seg)) return { label: h.label, segment: seg.slice(0, 120) };
		}
	}
	return null;
}

export interface DeleteHit {
	segment: string;
	targets: string[];
}

/**
 * 判断一条*远端*命令里有没有「递归删除且目标不在 /tmp」的动作。
 *
 * 为什么单独管这一条：macmini 的 `~/Developer` 与 `~/.pi/agent` 与本机是**双向镜像**，
 * 远端的 `rm -rf` 会原样删掉本机的文件（Syncthing 把删除当作一次同步事件传播）。
 * 临时目录 `/tmp` 不在镜像里，删它无害；镜像目录里的递归删除必须先拿到明确意图。
 *
 * @param command 远端要执行的命令
 * @param remoteCwd 远端工作目录（用于把相对路径解析成绝对路径）
 */
export function detectMirrorDelete(command: string, remoteCwd: string): DeleteHit | null {
	if (!command) return null;
	const base = remoteCwd && remoteCwd.startsWith("/") ? remoteCwd : "/tmp";
	for (const raw of command.split(SEGMENT_SPLIT)) {
		const seg = stripWrappers(raw);
		const m = seg.match(/^rm\s+((?:-\S+\s+)*)(.*)$/);
		if (!m) continue;
		const flags = m[1];
		if (!/-[A-Za-z]*[rR]/.test(flags)) continue; // 非递归删除（rm -f 单文件）不在此列
		const targets = m[2]
			.split(/\s+/)
			.map((t) => t.trim())
			.filter((t) => t !== "" && !t.startsWith("-"));
		if (targets.length === 0) continue; // 目标由变量拼出，看不出来：从宽放行
		const allTmp = targets.every((t) => {
			const abs = t.startsWith("/") || t.startsWith("~") ? t : posix.join(base, t);
			const norm = abs.replace(/^~(?=\/|$)/, "/Users/mac").replace(/\/+$/, "");
			return norm === "/tmp" || norm.startsWith("/tmp/");
		});
		if (!allTmp) return { segment: seg.slice(0, 140), targets };
	}
	return null;
}

/**
 * 用户指令里的「重型任务特征」。命中的话，在开跑前补一句定向提醒（display: false，
 * 只给 AI 看）——系统提示里的每轮判断是常态约束，这条是「这一轮确实像重活」的触发器，
 * 让判断不会在长上下文里被稀释。命中不等于必须分流：几秒的短命令照样留本机。
 */
const TASK_SIGNALS: Array<{ label: string; re: RegExp }> = [
	{ label: "构建 / 编译", re: /构建|编译|build|compile|打包/i },
	{ label: "测试套件", re: /全量测试|测试套件|跑测试|跑一遍测试|test suite|pytest|vitest|jest|npm test/i },
	{ label: "转码 / 渲染", re: /转码|ffmpeg|视频压缩|视频处理|批量.{0,6}(截图|渲染|处理)|transcod/i },
	{ label: "回测 / 数据 / ML", re: /回测|backtest|训练模型|模型训练|数据集|pandas|numpy|walk.?forward/i },
	{ label: "大下载", re: /下载|download|拉取.{0,8}(模型|数据集|仓库)/i },
	{ label: "OCR / 转写", re: /ocr|文字识别|识别.{0,6}文字|语音转写|whisper|tesseract/i },
	{ label: "大文件处理", re: /大文件|哈希|校验和|md5sum|sha256sum|全盘扫描/i },
	{ label: "批量处理", re: /批量|批处理|逐个处理|依次处理|batch/i },
];

/** 指令里命中的重型特征标签（最多返回 2 个，供定向提醒用）。 */
export function detectTaskSignals(prompt: string): string[] {
	if (!prompt) return [];
	const hits: string[] = [];
	for (const s of TASK_SIGNALS) {
		if (s.re.test(prompt) && !hits.includes(s.label)) hits.push(s.label);
		if (hits.length >= 2) break;
	}
	return hits;
}
