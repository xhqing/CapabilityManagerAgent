/**
 * ai-edit-diff.ts — 通用「改动可视化 / 双向知情」扩展（与 git 无关）
 *
 * 功能：
 *  A) AI 改动 → 每轮结束时自动打开 diff 视图（本轮改动前快照 vs 当前）给用户看
 *     —— 由 write/edit/bash 工具触发，快照在工具执行前采集，精确到「本轮」
 *  B) 用户改动 → 自动通知 AI（附改动前快照），AI 唤醒后知道用户改了什么、不会改回去
 *
 * 特点：不依赖 git；任何目录、任何项目均可工作；只跟随「被 AI 碰过的文本文件」，
 *       二进制/大文件/垃圾目录自动跳过。
 *
 * 数据目录：~/.pi/agent/state/ai-edit-diff/{mirror,snapshots}
 * 建立：2026-10-11（用户需求：Agent 改动可视化 + 用户改动通知 + 通用化）
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { execFile } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STATE_DIR = path.join(os.homedir(), ".pi/agent/state/ai-edit-diff");
const MIRROR_DIR = path.join(STATE_DIR, "mirror");
const SNAP_DIR = path.join(STATE_DIR, "snapshots");

const TEXT_EXT = new Set([
  ".md", ".txt", ".json", ".jsonl", ".py", ".ts", ".tsx", ".js", ".jsx", ".mjs",
  ".toml", ".yaml", ".yml", ".html", ".htm", ".css", ".scss", ".sh", ".bash",
  ".zsh", ".csv", ".tsv", ".xml", ".ini", ".cfg", ".conf", ".env", ".sql",
  ".rs", ".go", ".java", ".c", ".cpp", ".h", ".rb", ".php", ".vue", ".svelte",
]);
const SKIP_SEGMENTS = [
  `${path.sep}.git${path.sep}`, `${path.sep}node_modules${path.sep}`,
  `${path.sep}__pycache__${path.sep}`, `${path.sep}.venv${path.sep}`,
  `${path.sep}venv${path.sep}`, `${path.sep}dist${path.sep}`,
  `${path.sep}build${path.sep}`, `${path.sep}.pi${path.sep}`,
  `${path.sep}.ai-edit-diff${path.sep}`,
];
const MAX_FILE_BYTES = 1024 * 1024;      // 1MB
const MAX_DIFFS_PER_ROUND = 8;           // 每轮最多打开的 diff 标签数
const USER_POLL_MS = 2500;               // 用户改动轮询间隔
const TOOL_TAIL_MS = 8000;               // 工具结束后视为「AI 动作余波」的时间窗
const FOLLOW_MAX = 25;                   // 跟随文件上限（LRU）

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function shouldTrack(p: string): boolean {
  if (!p || !path.isAbsolute(p)) return false;
  const ext = path.extname(p).toLowerCase();
  if (!TEXT_EXT.has(ext)) return false;
  for (const seg of SKIP_SEGMENTS) if (p.includes(seg)) return false;
  if (p.startsWith(STATE_DIR)) return false;
  try {
    const st = fs.statSync(p);
    return st.isFile() && st.size <= MAX_FILE_BYTES;
  } catch {
    return false;
  }
}

// 从 bash 命令文本中解析疑似文件路径
function extractPaths(cmd: string): string[] {
  const out = new Set<string>();
  const re = /(?:~|\/)?[\w./~-]+\.(?:md|txt|json|jsonl|py|ts|tsx|js|jsx|mjs|toml|yaml|yml|html|htm|css|scss|sh|bash|zsh|csv|tsv|xml|ini|cfg|conf|env|sql|rs|go|java|c|cpp|h|rb|php|vue|svelte)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) {
    let p = m[0];
    if (p.startsWith("~/")) p = path.join(os.homedir(), p.slice(2));
    if (!path.isAbsolute(p)) p = path.resolve(process.cwd(), p);
    out.add(p);
  }
  return [...out];
}

export default function (pi: ExtensionAPI) {
  let active = false;

  // 磁盘镜像：被跟踪文件最近一次已知内容
  const mirrorGet = (p: string): string | null => {
    try {
      return fs.readFileSync(path.join(MIRROR_DIR, md5(p) + ".content"), "utf-8");
    } catch {
      return null;
    }
  };
  const mirrorSet = (p: string, content: string) => {
    try {
      fs.mkdirSync(MIRROR_DIR, { recursive: true });
      fs.writeFileSync(path.join(MIRROR_DIR, md5(p) + ".content"), content, "utf-8");
      fs.writeFileSync(path.join(MIRROR_DIR, md5(p) + ".path"), p, "utf-8");
    } catch {}
  };

  // 本轮改动清单：absPath -> 快照文件路径（仅在首次改动前采集）
  const roundChanges = new Map<string, string>();
  // 跟随集合（LRU）
  const follow = new Map<string, number>();
  let lastToolEndAt = 0;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const followTouch = (p: string) => {
    follow.set(p, Date.now());
    if (follow.size > FOLLOW_MAX) {
      let oldest: string | null = null;
      let oldestTs = Infinity;
      for (const [k, v] of follow) {
        if (v < oldestTs) { oldestTs = v; oldest = k; }
      }
      if (oldest) follow.delete(oldest);
    }
  };

  const readFileSafe = (p: string): string | null => {
    try {
      return fs.readFileSync(p, "utf-8");
    } catch {
      return null;
    }
  };

  // 采集「改动前快照」：仅在文件本轮第一次被碰时执行
  const takeSnapshot = (p: string) => {
    if (roundChanges.has(p)) return;
    const content = readFileSafe(p);
    if (content === null) return;
    // 镜像不存在 → 建立基线（不产生 diff）
    if (mirrorGet(p) === null) {
      mirrorSet(p, content);
      return;
    }
    try {
      fs.mkdirSync(SNAP_DIR, { recursive: true });
      const snap = path.join(SNAP_DIR, `${stamp()}-${path.basename(p)}`);
      fs.writeFileSync(snap, content, "utf-8");
      roundChanges.set(p, snap);
      followTouch(p);
    } catch {}
  };

  const openDiff = (snap: string, target: string) => {
    try {
      execFile("code", ["--diff", snap, target], () => {});
    } catch {}
  };

  // 「AI 读过该文件」→ 刷新镜像（基线 = AI 刚看到的内容）+ 进入跟随名单
  // 目的：AI 上下文里有该文件内容后，用户再改它 → 能被检测并通知 AI「你见过的文件变了」
  const refreshBaselineOnRead = (p: string) => {
    const content = readFileSafe(p);
    if (content === null) return;
    mirrorSet(p, content);
    followTouch(p);
  };

  // ===== 事件：工具调用（AI 改动前采集快照 / 读过建基线） =====
  pi.on("tool_call", async (event: any) => {
    if (!active) return;
    const name = event.toolName;
    const input = event.input || {};
    try {
      if (name === "write" || name === "edit") {
        const p = String(input.path ?? "");
        if (p && shouldTrack(p)) takeSnapshot(p);
      } else if (name === "read") {
        // AI 正在读取文件 → 该文件进入保护圈（用户之后再改它会通知 AI）
        const p = String(input.path ?? "");
        if (p && path.isAbsolute(p) && shouldTrack(p)) refreshBaselineOnRead(p);
      } else if (name === "bash") {
        const cmd = String(input.command ?? "");
        if (cmd) {
          const paths = extractPaths(cmd);
          const isReadCmd = /\b(cat|head|tail|less|grep|rg|wc|file|stat|ls|diff)\b/.test(cmd);
          for (const p of paths) {
            if (!shouldTrack(p)) continue;
            if (isReadCmd) {
              refreshBaselineOnRead(p);   // 读取类命令：刷新基线（AI 见过最新版）
            } else {
              takeSnapshot(p);             // 可能修改：采集改动前快照
            }
          }
        }
      }
    } catch {}
  });

  pi.on("tool_execution_end", async () => {
    lastToolEndAt = Date.now();
  });

  // ===== 轮询：捕捉「用户改动」 =====
  const poll = () => {
    if (!active) return;
    const now = Date.now();
    for (const [p] of follow) {
      const current = readFileSafe(p);
      if (current === null) continue;
      const known = mirrorGet(p);
      if (known === null || current === known) continue;

      // AI 工具正在进行 / 刚结束 → 视为 AI 动作余波（由 agent_end 统一处理）
      if (now - lastToolEndAt < TOOL_TAIL_MS) continue;
      if (roundChanges.has(p)) continue;

      // —— 用户改动 ——
      const snap = path.join(SNAP_DIR, `user-edit-${stamp()}-${path.basename(p)}`);
      try {
        fs.mkdirSync(SNAP_DIR, { recursive: true });
        fs.writeFileSync(snap, known, "utf-8");
      } catch {}
      mirrorSet(p, current);
      followTouch(p);

      pi.sendMessage(
        {
          customType: "user-edit-notify",
          content: [
            "【自动通知 · 用户手动修改了文件】",
            `文件：${p}`,
            `改动前快照：${snap}`,
            "⚠️ 重要：该文件此前的内容可能仍留在你的上下文中，且已过时。在后续回答或操作前，请重新读取该文件，不要基于旧内容回答或处理。",
            "用户的改动是新的基线——不要覆盖它。",
          ].join("\n"),
          display: true,
        },
        { triggerTurn: true },
      );
    }
  };

  // ===== 事件：一轮结束（AI 改动 → 打开 diff） =====
  pi.on("agent_end", async () => {
    if (!active) return;
    if (roundChanges.size === 0) return;

    let opened = 0;
    let total = roundChanges.size;
    for (const [p, snap] of roundChanges) {
      const current = readFileSafe(p);
      if (current === null) continue;
      mirrorSet(p, current);       // AI 改动纳入基线
      if (current === readFileSafe(snap)) continue;  // 内容无实际变化
      if (opened < MAX_DIFFS_PER_ROUND) {
        openDiff(snap, p);
        opened += 1;
      }
    }
    const summary = `[ai-edit-diff] 本轮 AI 改动已为 ${opened}/${total} 个文件打开 diff 对比（快照目录：${SNAP_DIR}）`;
    if (total > opened) {
      pi.sendMessage(
        { customType: "ai-edit-diff", content: summary + "（超出上限的文件未自动打开，可让 AI 补开）", display: false },
        {},
      );
    }
    roundChanges.clear();
  });

  pi.on("session_start", async (_event: any, ctx: any) => {
    if (active) return;
    active = true;
    try { fs.mkdirSync(MIRROR_DIR, { recursive: true }); } catch {}
    try { fs.mkdirSync(SNAP_DIR, { recursive: true }); } catch {}

    // 跨会话预加载：镜像里最近修改过的文件进入跟随集（保证旧文件也能被检测用户改动）
    try {
      const entries = fs
        .readdirSync(MIRROR_DIR)
        .filter((f) => f.endsWith(".path"))
        .map((f) => {
          const full = path.join(MIRROR_DIR, f);
          try {
            const target = fs.readFileSync(full, "utf-8").trim();
            const mtime = fs.statSync(full).mtimeMs;
            return { target, mtime };
          } catch {
            return null;
          }
        })
        .filter((x): x is { target: string; mtime: number } => !!x && !!x.target)
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, FOLLOW_MAX);
      for (const e of entries) follow.set(e.target, Date.now());
    } catch {}

    pollTimer = setInterval(poll, USER_POLL_MS);
    if (ctx?.ui?.notify) {
      ctx.ui.notify("已启用「改动可视化」（AI 改动自动 diff / 用户改动自动通知）", "info");
    }
  });

  pi.on("session_shutdown", async () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    roundChanges.clear();
    follow.clear();
    active = false;
  });
}
