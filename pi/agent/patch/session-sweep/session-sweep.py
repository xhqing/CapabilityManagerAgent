#!/usr/bin/env python3
"""后台 pi 会话清扫器（2026-10-04 用户立规配套工具强制）。

规矩背景：用户**看不见 tmux 后台会话**——「后台会话对他而言等于不存在」。所以
`agent_call` / `agent_wake` 拉起的会话不能长期挂着：用完即清、不活跃即清。

本脚本做「定期巡视」那一半：找出**无人在看**（tmux 无客户端附着）且**空闲 ≥ N 分钟**
的后台会话，默认只列出来（干跑），带 `--kill` 才真关闭。

怎么判断「空闲」：每个 pi 会话对应一个记录文件
    ~/.pi/agent/sessions/<cwd-slug>/<启动时间戳>_<会话ID>.jsonl
其中 slug = cwd 去掉首尾斜杠后把 `/` 换成 `-`（首尾各加 `--`）。进程启动时间与文件名
里的 UTC 时间戳几乎一致（实测误差 0–1 秒），据此把 tmux 会话映射到记录文件，取该文件
的 mtime 作为「最后活动时间」。

不会动的东西（安全阀）：
  - 非 `pi-` 前缀的 tmux 会话（用户自己的 tmux 工作区）；
  - 有客户端附着的会话（有人在看）；
  - 不是 tmux 的 pi 进程（用户终端里的会话，`ps -o tty=` 有真实 tty）；
  - 记录文件匹配不到的会话（拿不准就不动，除非显式 `--kill-unknown`）。

用法：
    session-sweep.py                  # 干跑：列出候选
    session-sweep.py --idle-min 60    # 自定义空闲阈值
    session-sweep.py --kill           # 真关闭
    session-sweep.py --kill --exclude pi-Victor,pi-其他   # 排除指定会话
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SESS_ROOT = Path(os.environ.get("PI_SESSION_DIR", Path.home() / ".pi" / "agent" / "sessions"))
MATCH_TOLERANCE_S = 300  # 进程启动时间与文件名时间戳的最大允许偏差


def run(*args: str) -> str:
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=30).stdout
    except Exception:
        return ""


def slug_for(cwd: str) -> str:
    return "--" + cwd.strip("/").replace("/", "-") + "--"


def parse_lstart(s: str) -> float | None:
    s = " ".join(s.split())
    for fmt in ("%a %b %d %H:%M:%S %Y", "%a %b %d %H:%M:%Y %Y"):
        try:
            return datetime.strptime(s, fmt).timestamp()
        except ValueError:
            continue
    return None


def session_file_for(cwd: str, start_ts: float) -> Path | None:
    """按启动时间在对应目录里匹配记录文件。"""
    d = SESS_ROOT / slug_for(cwd)
    if not d.is_dir():
        return None
    best, best_delta = None, None
    for f in d.glob("*.jsonl"):
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})", f.name)
        if not m:
            continue
        ts = datetime(*[int(x) for x in m.groups()], tzinfo=timezone.utc).timestamp()
        delta = abs(ts - start_ts)
        if best_delta is None or delta < best_delta:
            best, best_delta = f, delta
    return best if best is not None and best_delta < MATCH_TOLERANCE_S else None


def collect() -> list[dict]:
    rows: list[dict] = []
    panes = run("tmux", "list-panes", "-a", "-F",
                "#{session_name}\t#{pane_pid}\t#{pane_current_path}\t#{session_attached}")
    for line in panes.splitlines():
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        name, pid, cwd, attached = parts[0], parts[1], parts[2], parts[3]
        if not name.startswith("pi-"):
            continue  # 只管 pi 后台会话，用户自己的 tmux 工作区不碰
        start = parse_lstart(run("ps", "-o", "lstart=", "-p", pid).strip())
        f = session_file_for(cwd, start) if start else None
        idle_min = round((time.time() - f.stat().st_mtime) / 60) if f else None
        rows.append({
            "session": name,
            "pid": pid,
            "cwd": cwd,
            "attached": int(attached or 0),
            "started": datetime.fromtimestamp(start).strftime("%m-%d %H:%M") if start else "?",
            "last_active": datetime.fromtimestamp(f.stat().st_mtime).strftime("%m-%d %H:%M") if f else None,
            "idle_min": idle_min,
            "file": f.name if f else None,
        })
    rows.sort(key=lambda r: (r["idle_min"] is None, -(r["idle_min"] or 0)))
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description="后台 pi 会话清扫器（默认干跑）")
    ap.add_argument("--idle-min", type=int, default=30, help="空闲阈值（分钟），默认 30")
    ap.add_argument("--kill", action="store_true", help="真关闭候选会话（默认只列出）")
    ap.add_argument("--kill-unknown", action="store_true", help="连「匹配不到记录文件」的也清（默认不动）")
    ap.add_argument("--exclude", default="", help="逗号分隔的白名单，排除这些会话")
    ap.add_argument("--json", action="store_true", help="输出 JSON")
    ap.add_argument("--force", action="store_true",
                    help="绕开批量 / 低阈值安全阀（2026-10-04 事故后加，非不得已不要用）")
    args = ap.parse_args()

    exclude = {s.strip() for s in args.exclude.split(",") if s.strip()}
    rows = collect()
    if not rows:
        print("没有正在运行的后台 pi 会话。")
        return 0

    candidates, skipped = [], []
    for r in rows:
        if r["session"] in exclude:
            skipped.append((r, "在排除名单里"))
        elif r["attached"] > 0:
            skipped.append((r, "有人在看（有 tmux 客户端附着）"))
        elif r["idle_min"] is None:
            (candidates if args.kill_unknown else skipped).append(
                (r, "匹配不到记录文件（拿不准）"))
        elif r["idle_min"] >= args.idle_min:
            candidates.append((r, "空闲 ≥ 阈值"))
        else:
            skipped.append((r, f"刚活动过（{r['idle_min']} 分钟前）"))

    killed: list[str] = []
    if args.kill:
        # 安全阀（2026-10-04 事故后加）：低阈值与批量清理必须先显式 --force。
        # 背景：当时为测 kill 路径用了 `--idle-min 0 --kill --kill-unknown`，把所有
        # 无客户端附着的会话（含正在跑提交流程的、在等工作流反馈的）一并清掉。
        if args.idle_min < 10 and not args.force:
            print(f"拒绝执行：--idle-min {args.idle_min} 低于 10 分钟安全下限——这么低的阈值会把「刚用完还热着」的会话也当成候选。"
                  f"先干跑看看清单，确实要清请加 --force。")
            return 2
        if len(candidates) > 3 and not args.force:
            print(f"拒绝执行：本次候选 {len(candidates)} 个（超过 3 个）——批量清理风险高，可能误伤在工作流里的会话。"
                  "候选清单：")
            for r, _ in candidates:
                print(f"  - {r['session']}（空闲 {r['idle_min']} 分钟）")
            print("确认无误后加 --force 重跑。")
            return 2
        for r, _ in candidates:
            if subprocess.run(["tmux", "kill-session", "-t", r["session"]],
                              capture_output=True).returncode == 0:
                killed.append(r["session"])

    if args.json:
        # 纯 JSON 输出（不再混人类可读文字，便于上游扩展 / 脚本解析）
        print(json.dumps({
            "idle_min": args.idle_min,
            "dry_run": not args.kill,
            "candidates": [c[0] for c in candidates],
            "killed": killed,
            "skipped": [{"row": s[0], "why": s[1]} for s in skipped],
        }, ensure_ascii=False, indent=2))
        return 0

    print(f"后台 pi 会话共 {len(rows)} 个（阈值：空闲 ≥ {args.idle_min} 分钟）\n")
    print(f"【候选清理 {len(candidates)} 个】")
    for r, why in candidates:
        print(f"  - {r['session']:<18} 启动 {r['started']}  最后活动 {r['last_active']}"
              f"  空闲 {r['idle_min']} 分钟  ({why})")
    if not candidates:
        print("  （无）")
    print(f"\n【保留 {len(skipped)} 个】")
    for r, why in skipped:
        idle = f"{r['idle_min']} 分钟" if r["idle_min"] is not None else "未知"
        print(f"  - {r['session']:<18} 空闲 {idle}  原因：{why}")

    if args.kill:
        print()
        for s in killed:
            print(f"  ✅ 已关闭 {s}")
        for r, _ in candidates:
            if r["session"] not in killed:
                print(f"  ❌ 关闭失败 {r['session']}")
        print(f"\n结果：成功 {len(killed)} / 失败 {len(candidates) - len(killed)}")
    else:
        print("\n这是干跑（未关闭任何会话）；要真清理加 --kill。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
