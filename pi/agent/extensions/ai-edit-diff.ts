/**
 * ai-edit-diff.ts — 通用「改动可视化 / 跨会话双向知情」扩展（与 git 无关）
 *
 * 功能：
 *  A) AI 改动 → 登记「改动前快照」（默认不打开任何窗口、不打扰）；用户需要时由 AI 调用
 *     `open_diff` 按需打开 diff（左：改动前快照 / 右：当前内容；先选文件与 VSCode 窗口、经用户确认）。
 *  B) 文件变更通知 → 任何来源的变更（用户手动改 / 某个会话改），都会通知给**所有碰过该文件的
 *     活跃会话**（前台与后台一视同仁），让每个会话都及时更新对该文件的最新认知；通知附带变更
 *     来源与「改动前快照」，并提醒先重新读取、不要覆盖。
 *
 * 机制（跨会话通过共享状态目录协调，无守护进程）：
 *  - mirror/  ：各文件最近一次已知内容（全局共享基线；采集"改动前快照"用）
 *  - meta/    ：每个文件的最新变更记录（新内容哈希 + 改动前快照路径 + 来源：会话/用户）
 *  - touched/ ：每个会话「碰过」哪些文件（会话私有、持久化；重启恢复后仍然记得）
 *  - claims/  ：会话工具正在改某文件的短时声明（把变更归因到会话，而不是"用户"）
 *  每个会话轮询自己碰过的文件：内容哈希与「自己已知」不一致即为变更 → 归因（meta/claim）→
 *  通知本会话 → 更新自己已知的哈希与 stat 快照（mtime+size 未变则跳过读取，省 IO）。
 *  自己工具的改动不通知自己，但会写 meta/mirror 供其他会话感知。
 *
 * 特点：不依赖 git；任何目录、任何项目均可工作；二进制/大文件/垃圾目录自动跳过。
 * 建立：2026-10-11（用户需求：Agent 改动可视化 + 用户改动通知 + 通用化）
 * 改造：2026-10-12（用户需求：diff 默认不自动打开；改为用户按需触发、选定窗口与文件并授权）
 * 改造：2026-10-12（用户需求：跨会话广播——碰过文件的活跃会话都要收到变更通知，无论改动人/会话是谁）
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { execFile } from "node:child_process";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ===== 共享状态目录（跨会话协调；可用环境变量覆盖，便于测试/调试） =====
const STATE_DIR = process.env.AI_EDIT_DIFF_STATE_DIR ?? path.join(os.homedir(), ".pi/agent/state/ai-edit-diff");
const MIRROR_DIR = path.join(STATE_DIR, "mirror");     // 文件最近一次已知内容（全局共享）
const SNAP_DIR = path.join(STATE_DIR, "snapshots");    // 改动前快照
const META_DIR = path.join(STATE_DIR, "meta");         // 每个文件的最新变更记录（共享）
const TOUCH_DIR = path.join(STATE_DIR, "touched");     // 每个会话碰过的文件（会话私有）
const CLAIM_DIR = path.join(STATE_DIR, "claims");      // 会话工具的短时声明（归因用）

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
const TOUCH_MAX = 300;                   // 每个会话跟踪的文件上限（LRU）
const POLL_MS = Math.max(200, Number(process.env.AI_EDIT_DIFF_POLL_MS) || 2500); // 轮询间隔
const CLAIM_TTL_MS = 60_000;             // 工具声明的有效期（超时视为失效）
const SNAP_KEEP_MS = 30 * 24 * 3600 * 1000; // 快照保留期（更早的清掉）
const MISSING = "__missing__";           // 文件不存在的特殊哈希

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return new Date(ts).toISOString();
  }
}

/** 原子写文件（临时文件 + rename），避免读到半截内容。 */
function atomicWrite(file: string, data: string): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(tmp, data, "utf-8");
    fs.renameSync(tmp, file);
  } catch {}
}

/** 读取文件状态：content（有内容）/ missing（不存在）/ skip（存在但读不了）。 */
type ReadState = { kind: "content"; text: string } | { kind: "missing" } | { kind: "skip" };
function readState(p: string): ReadState {
  try {
    return { kind: "content", text: fs.readFileSync(p, "utf-8") };
  } catch {
    try {
      fs.statSync(p);
      return { kind: "skip" };
    } catch {
      return { kind: "missing" };
    }
  }
}

/** stat 快查：用于 mtime+size 快速判断「内容没变」（省去整文件读取）。 */
type StatState = { kind: "file"; mtimeMs: number; size: number } | { kind: "missing" } | { kind: "skip" };
function statState(p: string): StatState {
  try {
    const st = fs.statSync(p);
    if (st.isFile()) return { kind: "file", mtimeMs: st.mtimeMs, size: st.size };
    return { kind: "skip" };
  } catch {
    return { kind: "missing" };
  }
}

/** 变更来源：某个会话（id/name）/ 用户 / 未知。 */
interface ChangedBy { kind: "session" | "user" | "unknown"; id?: string; name?: string }
/** 共享变更记录：谁在什么时候把文件变成了什么（附改动前快照）。 */
interface MetaRec { path: string; hash: string; snapshot: string | null; changedAt: number; changedBy: ChangedBy }
/** 会话工具声明：某会话的工具正在动这个文件。 */
interface Claim { id: string; name?: string; ts: number }
/** 会话碰过的文件（持久化，重启恢复后仍记得）。 */
interface TouchRec { hash: string; ts: number; mtimeMs?: number; size?: number }
interface TouchStore { id: string; name?: string; cwd: string; updatedAt: number; files: Record<string, TouchRec> }

const metaFile = (p: string) => path.join(META_DIR, md5(p) + ".json");
const claimFile = (p: string) => path.join(CLAIM_DIR, md5(p) + ".json");
const touchFile = (sid: string) => path.join(TOUCH_DIR, md5(sid) + ".json");

function readMeta(p: string): MetaRec | null {
  try {
    const rec = JSON.parse(fs.readFileSync(metaFile(p), "utf-8")) as MetaRec;
    return rec && rec.path === p ? rec : null;
  } catch {
    return null;
  }
}
const writeMeta = (p: string, rec: MetaRec) => atomicWrite(metaFile(p), JSON.stringify(rec));

function readClaim(p: string): Claim | null {
  try {
    const c = JSON.parse(fs.readFileSync(claimFile(p), "utf-8")) as Claim;
    if (Date.now() - c.ts <= CLAIM_TTL_MS) return c;
    try { fs.unlinkSync(claimFile(p)); } catch {}
  } catch {}
  return null;
}
const dropClaim = (p: string) => { try { fs.unlinkSync(claimFile(p)); } catch {} };

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
  let sessionId = "";
  let sessionCwd = "";
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const sessionName = (): string | undefined => {
    try {
      return pi.getSessionName?.() ?? undefined;
    } catch {
      return undefined;
    }
  };
  const whoami = (): ChangedBy => ({ kind: "session", id: sessionId, name: sessionName() ?? sessionId.slice(0, 8) });

  // ===== 会话「碰过」的文件：path -> {hash, mtime, size, ts}（自己的已知状态） =====
  const touched = new Map<string, TouchRec>();
  let touchedDirty = false;

  const touchSet = (p: string, hash: string, mtimeMs?: number, size?: number) => {
    touched.set(p, { hash, ts: Date.now(), mtimeMs, size });
    if (touched.size > TOUCH_MAX) {
      let oldest: string | null = null;
      let oldestTs = Infinity;
      for (const [k, v] of touched) {
        if (v.ts < oldestTs) { oldestTs = v.ts; oldest = k; }
      }
      if (oldest) touched.delete(oldest);
    }
    touchedDirty = true;
  };

  const saveTouched = () => {
    if (!touchedDirty || !sessionId) return;
    const data: TouchStore = {
      id: sessionId,
      name: sessionName(),
      cwd: sessionCwd,
      updatedAt: Date.now(),
      files: Object.fromEntries(touched),
    };
    atomicWrite(touchFile(sessionId), JSON.stringify(data));
    touchedDirty = false;
  };

  const loadTouched = () => {
    try {
      const data = JSON.parse(fs.readFileSync(touchFile(sessionId), "utf-8")) as TouchStore;
      for (const [p, rec] of Object.entries(data?.files ?? {})) {
        if (rec && typeof rec.hash === "string") touched.set(p, rec);
      }
    } catch {}
  };

  // ===== 共享镜像：文件最近一次已知内容 =====
  const mirrorGet = (p: string): string | null => {
    try {
      return fs.readFileSync(path.join(MIRROR_DIR, md5(p) + ".content"), "utf-8");
    } catch {
      return null;
    }
  };
  const mirrorSet = (p: string, content: string) => {
    atomicWrite(path.join(MIRROR_DIR, md5(p) + ".content"), content);
    atomicWrite(path.join(MIRROR_DIR, md5(p) + ".path"), p);
  };

  // ===== 快照 =====
  const writeSnapshot = (p: string, content: string): string | null => {
    try {
      fs.mkdirSync(SNAP_DIR, { recursive: true });
      const snap = path.join(SNAP_DIR, `${stamp()}-${path.basename(p)}`);
      fs.writeFileSync(snap, content, "utf-8");
      return snap;
    } catch {
      return null;
    }
  };
  const readSnapshot = (snap: string): string | null => {
    try {
      return fs.readFileSync(snap, "utf-8");
    } catch {
      return null;
    }
  };

  // ===== 本轮改动清单：path -> 改动前快照（供 flush 与 open_diff） =====
  const roundChanges = new Map<string, string>();

  // 最近改动登记（跨轮次，供 open_diff 候选；同文件保留最新快照，新在前）
  const recentChanges: { path: string; snap: string; at: number }[] = [];
  const pushRecent = (p: string, snap: string) => {
    const i = recentChanges.findIndex((r) => r.path === p);
    if (i >= 0) recentChanges.splice(i, 1);
    recentChanges.unshift({ path: p, snap, at: Date.now() });
    if (recentChanges.length > RECENT_MAX) recentChanges.length = RECENT_MAX;
  };

  // ===== 工具侧：改动前快照 / 声明 / 读基线 =====

  /** 采集「改动前快照」：仅在本轮该文件第一次被工具触碰时执行。 */
  const takeSnapshot = (p: string) => {
    if (roundChanges.has(p)) return;
    const st = readState(p);
    if (st.kind !== "content") return;
    if (mirrorGet(p) === null) {
      // 镜像不存在 → 建立基线（不产生 diff）
      mirrorSet(p, st.text);
      return;
    }
    const snap = writeSnapshot(p, st.text);
    if (snap) roundChanges.set(p, snap);
  };

  /** 工具声明：告诉其他会话「是某个会话在改它」，避免被误标成"用户"。 */
  const writeClaim = (p: string) => {
    if (!sessionId) return;
    atomicWrite(claimFile(p), JSON.stringify({ id: sessionId, name: sessionName(), ts: Date.now() } satisfies Claim));
  };

  /** 「AI 读过该文件」→ 刷新镜像与自己已知状态（基线 = 刚看到的内容）。 */
  const baselineOnRead = (p: string) => {
    const st = readState(p);
    if (st.kind !== "content") return;
    mirrorSet(p, st.text);
    const s = statState(p);
    touchSet(p, md5(st.text), s.kind === "file" ? s.mtimeMs : undefined, s.kind === "file" ? s.size : undefined);
  };

  /** 把本轮工具改动落盘：更新镜像、写共享 meta（含改动前快照）、更新自己已知状态。 */
  const flushPaths = (paths: string[]) => {
    for (const p of paths) {
      const snap = roundChanges.get(p) ?? null;
      const st = readState(p);
      if (st.kind === "skip") continue; // 读不了：保留待下次重试
      const hash = st.kind === "missing" ? MISSING : md5(st.text);
      if (st.kind === "content") mirrorSet(p, st.text);
      writeMeta(p, { path: p, hash, snapshot: snap, changedAt: Date.now(), changedBy: whoami() });
      dropClaim(p);
      const s = statState(p);
      touchSet(p, hash, s.kind === "file" ? s.mtimeMs : undefined, s.kind === "file" ? s.size : undefined);
      if (snap && st.kind === "content") {
        if (readSnapshot(snap) !== st.text) pushRecent(p, snap);
      }
      roundChanges.delete(p);
    }
  };

  // ===== 通知 =====
  const notify = (p: string, info: { deleted: boolean; snap: string | null; changedBy: ChangedBy; changedAt: number }) => {
    const name = info.changedBy.name ?? info.changedBy.id?.slice(0, 8) ?? "未知";
    const who =
      info.changedBy.kind === "session"
        ? `由会话「${name}」修改`
        : info.changedBy.kind === "user"
          ? "由用户手动修改"
          : "检测到外部修改";
    const lines = [
      `【文件变更通知 · ${who}】`,
      `文件：${p}`,
      ...(info.deleted ? ["状态：文件已被删除（快照为删除前内容）"] : []),
      ...(info.snap ? [`改动前快照：${info.snap}`] : []),
      `变更时间：${formatTime(info.changedAt)}`,
      "⚠️ 该文件此前的内容可能仍留在你的上下文中，且已过时。在后续回答或操作前，请重新读取该文件，不要基于旧内容回答或处理。",
      "这次变更不是你做的——它是最新基线，不要覆盖；继续操作前先读取最新内容。",
    ];
    pi.sendMessage(
      { customType: "file-change-notify", content: lines.join("\n"), display: true },
      { triggerTurn: true },
    );
  };

  /** 处理一处变更：归因（meta/claim）→ 通知 → 更新自己已知状态。 */
  const handleChange = (p: string, cur: string | null, hash: string, s: StatState) => {
    // 自己的工具正在改它（声明还是我自己的）→ 等工具结束落盘，不通知自己
    const claim = readClaim(p);
    if (claim && claim.id === sessionId) return;

    const meta = readMeta(p);
    let changedBy: ChangedBy;
    let snap: string | null;
    let changedAt: number;
    if (meta && meta.hash === hash) {
      changedBy = meta.changedBy;
      snap = meta.snapshot;
      changedAt = meta.changedAt;
    } else {
      // 我是第一个发现者 → 补记一份（快照取自镜像里的旧内容）
      const old = mirrorGet(p);
      snap = old !== null && old.length <= MAX_FILE_BYTES ? writeSnapshot(p, old) : null;
      changedBy = claim ? { kind: "session", id: claim.id, name: claim.name } : { kind: "user" };
      changedAt = Date.now();
      writeMeta(p, { path: p, hash, snapshot: snap, changedAt, changedBy });
    }
    if (cur !== null) mirrorSet(p, cur);
    touchSet(p, hash, s.kind === "file" ? s.mtimeMs : undefined, s.kind === "file" ? s.size : undefined);

    // 通知（自己之外的一切来源：用户、其它会话、未知）
    if (!(changedBy.kind === "session" && changedBy.id === sessionId)) {
      notify(p, { deleted: cur === null, snap, changedBy, changedAt });
    }
  };

  // ===== 轮询：检测「自己碰过的文件」发生的一切变更（用户 / 其它会话） =====
  const poll = () => {
    if (!active) return;
    for (const [p, rec] of [...touched]) {
      const s = statState(p);
      if (s.kind === "skip") continue;
      if (s.kind === "missing") {
        if (rec.hash !== MISSING) handleChange(p, null, MISSING, s);
        continue;
      }
      // 快速路径：mtime + size 都没变 → 内容没变，跳过读取
      if (rec.hash !== MISSING && rec.mtimeMs === s.mtimeMs && rec.size === s.size) continue;
      const st = readState(p);
      if (st.kind !== "content") continue; // 读不了：下轮再试
      if (st.text.length > MAX_FILE_BYTES) continue;
      const hash = md5(st.text);
      if (hash === rec.hash) {
        // 内容其实没变（只是 mtime 变了）→ 刷新 stat 缓存即可
        touchSet(p, hash, s.mtimeMs, s.size);
        continue;
      }
      handleChange(p, st.text, hash, s);
    }
    saveTouched();
  };

  // ===== 事件：工具调用（改动前快照 / 声明 / 读基线） =====
  pi.on("tool_call", async (event: any) => {
    if (!active) return;
    const name = event.toolName;
    const input = event.input || {};
    try {
      if (name === "write" || name === "edit") {
        const p = String(input.path ?? "");
        if (p && shouldTrack(p)) {
          takeSnapshot(p);
          writeClaim(p);
        }
      } else if (name === "read") {
        const p = String(input.path ?? "");
        if (p && path.isAbsolute(p) && shouldTrack(p)) baselineOnRead(p);
      } else if (name === "bash") {
        const cmd = String(input.command ?? "");
        if (cmd) {
          const paths = extractPaths(cmd);
          const isReadCmd = /\b(cat|head|tail|less|grep|rg|wc|file|stat|ls|diff)\b/.test(cmd);
          for (const p of paths) {
            if (!shouldTrack(p)) continue;
            if (isReadCmd) {
              baselineOnRead(p);
            } else {
              takeSnapshot(p);
              writeClaim(p);
            }
          }
        }
      }
    } catch {}
  });

  // ===== 事件：工具结束（动静及时落盘 → 其它会话能及时感知） =====
  pi.on("tool_execution_end", async () => {
    if (!active) return;
    try {
      if (roundChanges.size > 0 && sessionId) flushPaths([...roundChanges.keys()]);
    } catch {}
  });

  // ===== 事件：一轮结束（兜底落盘） =====
  pi.on("agent_end", async () => {
    if (!active) return;
    try {
      if (roundChanges.size > 0 && sessionId) flushPaths([...roundChanges.keys()]);
    } catch {}
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
      const current = (() => { try { return fs.readFileSync(target.path, "utf-8"); } catch { return null; } })();
      if (current === null) {
        return { content: [{ type: "text", text: `目标文件当前无法读取（可能已删除）：${target.path}` }] };
      }
      const snapContent = readSnapshot(target.snap);
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
    try { sessionId = String(ctx?.sessionManager?.getSessionId?.() ?? ""); } catch {}
    if (!sessionId) sessionId = `pid-${process.pid}`;
    try { sessionCwd = String(ctx?.cwd ?? process.cwd()); } catch {}
    for (const d of [MIRROR_DIR, SNAP_DIR, META_DIR, TOUCH_DIR, CLAIM_DIR]) {
      try { fs.mkdirSync(d, { recursive: true }); } catch {}
    }
    // 轻量 GC：清掉超过保留期的旧快照（meta 里的老引用已无意义）
    try {
      const cutoff = Date.now() - SNAP_KEEP_MS;
      for (const f of fs.readdirSync(SNAP_DIR)) {
        const full = path.join(SNAP_DIR, f);
        try { if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full); } catch {}
      }
    } catch {}
    loadTouched();
    poll(); // 立即跑一轮：恢复会话时能立刻补上「缺席期间」发生过的变更
    pollTimer = setInterval(poll, POLL_MS);
    if (ctx?.ui?.notify) {
      ctx.ui.notify("已启用「改动可视化」：碰过文件的活跃会话都会收到文件变更通知；AI 改动可用 open_diff 按需查看 diff。", "info");
    }
  });

  pi.on("session_shutdown", async () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    saveTouched();
    roundChanges.clear();
    recentChanges.length = 0;
    active = false;
  });
}
