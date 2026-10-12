/**
 * ai-edit-diff.ts — 通用「改动可视化 / 双向知情」扩展（与 git 无关）
 *
 * 功能：
 *  A) AI 改动 → 每轮结束时登记「改动前快照」（默认不打开任何窗口、不打扰用户）；
 *     用户需要时由 AI 调用 `open_diff` 工具按需打开——交互流程：
 *     选择文件（候选多于一个时）→ 选择目标 VSCode 窗口（窗口多于一个时）→
 *     用户确认授权 → 在该窗口打开「改动前快照 ↔ 当前内容」的 diff 视图。
 *  B) 用户改动 → 自动通知 AI（附改动前快照），AI 唤醒后知道用户改了什么、不会改回去
 *
 * 特点：不依赖 git；任何目录、任何项目均可工作；只跟随「被 AI 碰过的文本文件」，
 *       二进制/大文件/垃圾目录自动跳过。
 *
 * 数据目录：~/.pi/agent/state/ai-edit-diff/{mirror,snapshots}
 * 建立：2026-10-11（用户需求：Agent 改动可视化 + 用户改动通知 + 通用化）
 * 改造：2026-10-12（用户需求：diff 默认不自动打开；改为用户按需触发、选定
 *       「哪个 VSCode 窗口 + 哪个文件」并授权后才打开——不打扰正在工作的窗口）
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { execFile } from "node:child_process";
import { Type } from "typebox";
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
const RECENT_MAX = 50;                   // 「最近改动」登记上限（供 open_diff 选择）
const USER_POLL_MS = 2500;               // 用户改动轮询间隔
const TOOL_TAIL_MS = 8000;               // 工具结束后视为「AI 动作余波」的时间窗
const FOLLOW_MAX = 25;                   // 跟随文件上限（LRU）

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ===== VSCode 窗口定位（open_diff 用） =====

interface VSCodeWindow {
  uri: string;      // folder 的 file:// URI（供 --folder-uri 使用）
  folder: string;   // folder 本地路径
  name: string;     // 显示名（basename）
}

/** storage.json 的候选路径（按平台：macOS / Linux / Windows）。 */
function codeStorageCandidates(): string[] {
  const home = os.homedir();
  const list = [
    path.join(home, "Library", "Application Support", "Code", "User", "globalStorage", "storage.json"), // macOS
    path.join(home, ".config", "Code", "User", "globalStorage", "storage.json"), // Linux
  ];
  if (process.env.APPDATA) {
    list.push(path.join(process.env.APPDATA, "Code", "User", "globalStorage", "storage.json")); // Windows
  }
  return list;
}

/** 列出当前打开着的 VSCode 窗口（读 windowsState；只含有 folder 的窗口）。 */
function listVSCodeWindows(): VSCodeWindow[] {
  for (const file of codeStorageCandidates()) {
    let data: any;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      continue;
    }
    const opened: any[] = Array.isArray(data?.windowsState?.openedWindows) ? data.windowsState.openedWindows : [];
    const seen = new Set<string>();
    const out: VSCodeWindow[] = [];
    for (const w of opened) {
      const uri = String(w?.folder ?? "");
      if (!uri.startsWith("file://") || seen.has(uri)) continue;
      seen.add(uri);
      let folder = uri;
      try {
        folder = decodeURIComponent(new URL(uri).pathname);
      } catch {}
      out.push({ uri, folder, name: path.basename(folder) || folder });
    }
    return out;
  }
  return [];
}

/** 在指定 folder 对应的 VSCode 窗口打开 diff（左 = 快照、右 = 当前）。 */
function openDiffInWindow(uri: string, left: string, right: string): Promise<{ ok: boolean; err?: string }> {
  return new Promise((resolve) => {
    try {
      execFile(
        "code",
        ["--folder-uri", uri, "--diff", left, right],
        { timeout: 10000 },
        (err: any, _stdout: any, stderr: any) => {
          if (err) resolve({ ok: false, err: String(stderr || err.message || err) });
          else resolve({ ok: true });
        },
      );
    } catch (e) {
      resolve({ ok: false, err: String(e) });
    }
  });
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

  // 最近改动登记（跨轮次，供 open_diff 候选；同文件保留最新快照，新在前）
  const recentChanges: { path: string; snap: string; at: number }[] = [];
  const pushRecent = (p: string, snap: string) => {
    const i = recentChanges.findIndex((r) => r.path === p);
    if (i >= 0) recentChanges.splice(i, 1);
    recentChanges.unshift({ path: p, snap, at: Date.now() });
    if (recentChanges.length > RECENT_MAX) recentChanges.length = RECENT_MAX;
  };

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

  // ===== 事件：一轮结束（登记改动清单；默认不打开任何窗口） =====
  pi.on("agent_end", async () => {
    if (!active) return;
    if (roundChanges.size === 0) return;
    for (const [p, snap] of roundChanges) {
      const current = readFileSafe(p);
      if (current === null) continue;
      mirrorSet(p, current);                        // AI 改动纳入基线
      if (readFileSafe(snap) === current) continue; // 内容无实际变化——不登记
      pushRecent(p, snap);
    }
    roundChanges.clear();
  });

  // ===== 工具：open_diff —— 按需打开改动 diff（询问选择 + 授权后打开） =====
  pi.registerTool({
    name: "open_diff",
    label: "打开改动 Diff",
    description:
      "打开某个「AI 改动过文件」的 diff 视图（改动前快照 ↔ 当前内容），在用户指定的 VSCode 窗口中打开。" +
      "打开前会询问用户：选择文件（候选多于一个时）、选择目标 VSCode 窗口（窗口多于一个时），并经用户确认授权后才执行。" +
      "本扩展默认不会自动打开任何 diff——只在用户要求查看时由本工具按需打开。",
    promptSnippet: "Open the pre-edit vs current diff of a recently edited file in a user-chosen VSCode window (asks the user first)",
    promptGuidelines: [
      "Use open_diff when the user asks to view or open the diff of recent edits (e.g. 「打开刚才改动的 diff」「看看你改了什么」). Do not call it when no edit was recorded or the user has not asked.",
    ],
    parameters: Type.Object({
      path: Type.Optional(
        Type.String({ description: "要查看 diff 的文件路径（绝对路径或相对当前目录）；省略时列出最近改动的文件供用户选择。" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx?.hasUI) {
        return { content: [{ type: "text", text: "当前会话没有可交互界面（需要 TUI 会话），无法进行选择与授权，未打开。" }] };
      }

      // 候选：最近登记（跨轮）+ 进行中本轮（优先），去重、新在前
      const merged = new Map<string, { path: string; snap: string; at: number }>();
      for (const r of recentChanges) if (!merged.has(r.path)) merged.set(r.path, r);
      for (const [p, snap] of roundChanges) merged.set(p, { path: p, snap, at: Date.now() });
      const candidates = [...merged.values()].sort((a, b) => b.at - a.at);
      if (candidates.length === 0) {
        return { content: [{ type: "text", text: "最近没有记录到可查看的改动（每个文件需先有一次「改动前快照」）。" }] };
      }

      // ① 选文件
      let target: { path: string; snap: string; at: number };
      const wanted = params.path ? path.resolve(ctx.cwd, params.path) : "";
      if (wanted) {
        const hit = candidates.find((c) => c.path === wanted);
        if (!hit) {
          return { content: [{ type: "text", text: `该文件不在最近的改动记录中：${wanted}` }] };
        }
        target = hit;
      } else if (candidates.length === 1) {
        target = candidates[0]!;
      } else {
        const labels = candidates.map((c) => `${path.basename(c.path)} — ${c.path}`);
        const pick = await ctx.ui.select("打开哪个文件的 diff？（左：改动前快照 / 右：当前内容）", labels);
        if (!pick) return { content: [{ type: "text", text: "已取消。" }] };
        target = candidates[labels.indexOf(pick)]!;
      }

      // ② 列窗口（确保有可用的目标窗口）
      const windows = listVSCodeWindows();
      if (windows.length === 0) {
        return { content: [{ type: "text", text: "未发现打开着工作区文件夹的 VSCode 窗口，无法定位打开位置。" }] };
      }
      let win = windows[0]!;
      if (windows.length > 1) {
        const counts = new Map<string, number>();
        for (const w of windows) counts.set(w.name, (counts.get(w.name) ?? 0) + 1);
        const labels = windows.map((w) => ((counts.get(w.name) ?? 0) > 1 ? `${w.name} — ${w.folder}` : w.name));
        const pick = await ctx.ui.select("在哪个 VSCode 窗口打开 diff？", labels);
        if (!pick) return { content: [{ type: "text", text: "已取消。" }] };
        win = windows[labels.indexOf(pick)]!;
      }

      // ③ 差异预检（无差异 / 文件不可读时提前返回，不打扰用户）
      const current = readFileSafe(target.path);
      if (current === null) {
        return { content: [{ type: "text", text: `目标文件当前无法读取（可能已删除）：${target.path}` }] };
      }
      const snapContent = readFileSafe(target.snap);
      if (snapContent !== null && snapContent === current) {
        return { content: [{ type: "text", text: "当前内容与改动前快照一致（无差异），未打开窗口。" }] };
      }

      // ④ 用户确认授权
      const ok = await ctx.ui.confirm(
        "打开 diff 视图？",
        `窗口：${win.name}（${win.folder}）\n文件：${target.path}\n左：改动前快照 / 右：当前内容`,
      );
      if (!ok) return { content: [{ type: "text", text: "已取消（未获授权，未打开）。" }] };

      // ⑤ 打开
      const res = await openDiffInWindow(win.uri, target.snap, target.path);
      if (!res.ok) {
        return { content: [{ type: "text", text: `打开失败：${res.err}` }] };
      }
      return { content: [{ type: "text", text: `已在窗口「${win.name}」打开 ${path.basename(target.path)} 的 diff 视图。` }] };
    },
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
      ctx.ui.notify("已启用「改动可视化」（用户改动自动通知；AI 改动说一声即可按需打开 diff 查看）", "info");
    }
  });

  pi.on("session_shutdown", async () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    roundChanges.clear();
    recentChanges.length = 0;
    follow.clear();
    active = false;
  });
}
