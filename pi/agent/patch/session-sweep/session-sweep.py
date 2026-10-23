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
    session-sweep.py --kill           # 真关闭（每批最多 3 个，其余留待下次巡视）
    session-sweep.py --kill --exclude pi-Victor,pi-其他   # 排除指定会话

2026-10-23 修复（清扫长期失效事故）：
  原实现在「候选 > 3 个」时**整体拒绝执行**（`return 2`）。僵尸一旦积到第 4 个，之后
  每次巡视都拒绝 → 永久死锁、越积越多（实测积到 18 个、跑了 5~15 天）。现改为**分批
  清理**：每批最多 3 个、按空闲降序优先清最老的，其余 `deferred` 留待下次巡视。安全
  阀的意图（防批量误伤）保留，但不再制造死锁。
  另修：`--json` 与低阈值拒绝路径现在**始终输出合法 JSON 且退出码 0**——原实现返回
  非零退出码 + 人类可读文字，上层扩展 `execFileSync` 抛异常后静默吞掉，导致清理失败
  一年无人知晓。
  新增 runaway 检测：「忙死」型会话（跑得久 + 平均 CPU 高）靠 mtime 判空闲永远躲过
  清扫（实测 pi-Hopper 空转 8 天 11 小时吃 87% CPU、上下文 99.3% 卡死，却因持续重试
  写日志被判「刚活动过」而从未被清理）。现在这类会话会单独标记提示，交人判断。
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
BATCH_MAX = 3  # 单次巡视最多清理几个（防批量误伤；其余留待下次，不整体拒绝）
RUNAWAY_MIN_HOURS = 24  # 疑似失控判定：运行时长下限（小时）
RUNAWAY_MIN_CPU = 20.0  # 疑似失控判定：进程生命周期平均 CPU 下限（%）


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


def parse_etime_hours(s: str) -> float | None:
    """解析 ps 的 etime 格式（[[dd-]hh:]mm:ss）为小时数。"""
    s = s.strip()
    if not s:
        return None
    days = 0
    if "-" in s:
        d, s = s.split("-", 1)
        try:
            days = int(d)
        except ValueError:
            return None
    parts = s.split(":")
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return None
    if len(nums) == 3:
        h, m, sec = nums
    elif len(nums) == 2:
        h, m, sec = 0, nums[0], nums[1]
    else:
        return None
    return days * 24 + h + m / 60 + sec / 3600


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
        # 进程生命周期平均 CPU 与时长：用于识别「忙死」型（mtime 一直更新、永远不像空闲）
        pcpu_s = run("ps", "-o", "pcpu=", "-p", pid).strip()
        etime_s = run("ps", "-o", "etime=", "-p", pid).strip()
        try:
            pcpu = float(pcpu_s)
        except ValueError:
            pcpu = 0.0
        run_hours = parse_etime_hours(etime_s)
        runaway = (
            run_hours is not None
            and run_hours >= RUNAWAY_MIN_HOURS
            and pcpu >= RUNAWAY_MIN_CPU
        )
        rows.append({
            "session": name,
            "pid": pid,
            "cwd": cwd,
            "attached": int(attached or 0),
            "started": datetime.fromtimestamp(start).strftime("%m-%d %H:%M") if start else "?",
            "last_active": datetime.fromtimestamp(f.stat().st_mtime).strftime("%m-%d %H:%M") if f else None,
            "idle_min": idle_min,
            "file": f.name if f else None,
            "pcpu": round(pcpu, 1),
            "run_hours": round(run_hours, 1) if run_hours is not None else None,
            "runaway": runaway,
        })
    rows.sort(key=lambda r: (r["idle_min"] is None, -(r["idle_min"] or 0)))
    return rows


def collect_runaways(rows: list[dict]) -> list[dict]:
    """筛出「忙死」型会话：跑得久 + 生命周期平均 CPU 高。

    为什么单独一类：清扫靠记录文件 mtime 判「空闲」，但失控会话会持续重试、不停写日志，
    mtime 一直刷新，于是永远被判「刚活动过」而躲过清理。实测 pi-Hopper 空转 8 天 11 小时、
    吃 87% CPU、上下文 99.3% 卡死，却从未被清——这类比「闲死」更耗资源，必须单独盯。

    只报告、不自动杀：长跑的真任务也会命中（比如大迁移），误杀代价大，交人判断。
    """
    return [r for r in rows if r.get("runaway")]


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
    deferred: list[str] = []
    refused: str | None = None
    if args.kill:
        # 低阈值安全阀（2026-10-04 事故后加）：--idle-min < 10 会把「刚用完还热着」
        # 的会话也当候选，必须先显式 --force。
        if args.idle_min < 10 and not args.force:
            refused = (
                f"拒绝执行：--idle-min {args.idle_min} 低于 10 分钟安全下限——这么低的阈值会把"
                "「刚用完还热着」的会话也当成候选。先干跑看看清单，确实要清请加 --force。"
            )
        else:
            # 批量安全阀（2026-10-23 重做）：原实现候选 > 3 就整体拒绝 → 僵尸积到第 4 个
            # 后永久死锁。现改为分批：每批最多 BATCH_MAX 个，按空闲降序优先清最老的，
            # 其余进 deferred 留待下次巡视。--force 时一次清完。
            ordered = sorted(candidates, key=lambda c: -(c[0]["idle_min"] or 0))
            if args.force:
                to_kill = ordered
            else:
                to_kill = ordered[:BATCH_MAX]
                deferred = [c[0]["session"] for c in ordered[BATCH_MAX:]]
            for r, _ in to_kill:
                if subprocess.run(["tmux", "kill-session", "-t", r["session"]],
                                  capture_output=True).returncode == 0:
                    killed.append(r["session"])

    if args.json:
        # 纯 JSON 输出（不再混人类可读文字，便于上游扩展 / 脚本解析）。
        # 2026-10-23 修：无论是否拒绝、退出码一律 0——原实现返回非零 + 非 JSON，
        # 上层 execFileSync 抛异常后被静默吞掉，清理失败长期无人知晓。
        print(json.dumps({
            "idle_min": args.idle_min,
            "dry_run": not args.kill,
            "candidates": [c[0] for c in candidates],
            "killed": killed,
            "deferred": deferred,
            "refused": refused,
            "runaways": [r for r in collect_runaways(rows)],
            "skipped": [{"row": s[0], "why": s[1]} for s in skipped],
        }, ensure_ascii=False, indent=2))
        return 0

    if refused:
        print(refused)
        return 2

    print(f"后台 pi 会话共 {len(rows)} 个（阈值：空闲 ≥ {args.idle_min} 分钟）\n")
    runaways = collect_runaways(rows)
    if runaways:
        print(f"【❗ 疑似失控 / 忙死型 {len(runaways)} 个（跑得久 + CPU 高，不自动处理，请人工判断）】")
        for r in runaways:
            print(f"  - {r['session']:<18} 已运行 {r['run_hours']} 小时  平均 CPU {r['pcpu']}%"
                  f"  空闲标记 {r['idle_min']} 分钟  {r['cwd']}")
        print()
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
            if r["session"] not in killed and r["session"] not in deferred:
                print(f"  ❌ 关闭失败 {r['session']}")
        if deferred:
            print(f"\n  ⏳ 另有 {len(deferred)} 个候选本轮未清（每批上限 {BATCH_MAX} 个，防止批量误伤）："
                  f" {'、'.join(deferred)}")
            print("    下次巡视会继续清；急可加 --force 一次清完。")
        print(f"\n结果：成功 {len(killed)} / 失败 {len(candidates) - len(killed) - len(deferred)}")
    else:
        print("\n这是干跑（未关闭任何会话）；要真清理加 --kill。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
