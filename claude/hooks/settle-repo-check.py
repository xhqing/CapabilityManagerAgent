#!/usr/bin/env python3
"""子项目仓库收尾巡检（2026-10-09 用户立规的配套工具强制）。

用户规则：所有 Agent 会话结束任务之前，都要检查自己负责的子项目仓库是否干净，
不干净的全部要处理干净（规则正文见全局 ~/.claude/CLAUDE.md「会话收尾检查」节）。

用法：
  settle-repo-check.py --cwd <dir> [--json]   # pi 端扩展 settle-repo-check.ts 调用
  settle-repo-check.py --cc-stop              # CC 端 Stop hook：stdin 读 hook JSON，
                                              # 未干净时 exit 2 阻断收尾（stderr 给 Claude 理由）；
                                              # stop_hook_active 时直接放行（防循环）

逻辑：
  - 由 cwd（Agent 项目目录，或某个子项目目录）在 ~/.claude/docs/agents-registry.md 的
    「超集关系映射」表里定位所属 Agent 与它的全部子项目；
  - 逐个 `git status --porcelain`（目录不存在 / 非 git 的跳过）；
  - cwd 不属于任何 Agent / 子项目 → 无此项、静默通过（exit 0）。
"""

import json
import os
import re
import subprocess
import sys

REG = os.path.expanduser("~/.claude/docs/agents-registry.md")
DEV = os.path.expanduser("~/Developer")


def registry_rows():
    """从注册表「超集关系映射」表取 [(Agent 项目名, 子项目目录名)]。"""
    try:
        text = open(REG, encoding="utf-8").read()
    except OSError:
        return []
    m = re.search(r"\*\*超集关系映射.*?\n\n(\|.*?)\n\n", text, re.S)
    if not m:
        return []
    rows = []
    for line in m.group(1).splitlines():
        if not line.startswith("|") or line.startswith("|---") or "Agent 项目（拟人名）" in line:
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) >= 3:
            rows.append((cells[0].split("（")[0].strip(), re.split(r"[（(]", cells[1])[0].strip()))
    return rows


def find_agent(cwd, rows):
    """cwd 是 Agent 项目 → 它自己；cwd 是某个子项目 → 归其 Agent；都不匹配 → None。"""
    name = os.path.basename(os.path.normpath(cwd))
    if name in {a for a, _ in rows}:
        return name
    for agent, proj in rows:
        if proj == name:
            return agent
    return None


def dirty_repos(agent, rows):
    out = []
    for a, proj in rows:
        if a != agent:
            continue
        d = os.path.join(DEV, proj)
        if not os.path.isdir(os.path.join(d, ".git")):
            continue
        r = subprocess.run(
            ["git", "-C", d, "status", "--porcelain"], capture_output=True, text=True
        )
        if r.returncode == 0 and r.stdout.strip():
            out.append({"repo": proj, "changes": len(r.stdout.strip().splitlines()), "path": d})
    return out


def main():
    args = sys.argv[1:]
    cc = "--cc-stop" in args
    cwd = None
    if "--cwd" in args:
        idx = args.index("--cwd")
        if idx + 1 < len(args):
            cwd = args[idx + 1]

    if cc:
        try:
            payload = json.load(sys.stdin)
        except Exception:
            payload = {}
        if payload.get("stop_hook_active"):
            sys.exit(0)  # 防循环：第二次收尾不再阻断
        cwd = payload.get("cwd") or os.getcwd()

    cwd = cwd or os.getcwd()
    rows = registry_rows()
    agent = find_agent(cwd, rows)
    if not agent:
        sys.exit(0)  # 非 Agent / 子项目会话 → 无此项

    dirty = dirty_repos(agent, rows)

    if cc:
        if dirty:
            names = "、".join(f"{r['repo']}（{r['changes']} 处改动）" for r in dirty)
            print(
                f"[settle-repo-check] 你名下还有 {len(dirty)} 个子项目仓库不干净：{names}。"
                "按用户 2026-10-09 立的规则，收尾前必须全部处理干净：各仓库按自己的流程 "
                "/add → /commit（该发版就照常发版）；在途 WIP（如 dev-workflow 先行的测试产物）"
                "向用户说明即可、不要硬提交。",
                file=sys.stderr,
            )
            sys.exit(2)
        sys.exit(0)

    result = {"agent": agent, "dirty": dirty}
    if "--json" in args:
        print(json.dumps(result, ensure_ascii=False))
    elif dirty:
        print(f"[settle-repo-check] {agent} 名下不干净的子项目仓库：")
        for r in dirty:
            print(f"  - {r['repo']}（{r['changes']} 处改动）")
    else:
        print(f"[settle-repo-check] {agent} 名下子项目仓库全部干净 ✅")
    sys.exit(0)


if __name__ == "__main__":
    main()
