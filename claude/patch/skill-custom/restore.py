#!/usr/bin/env python3
"""skill-custom：本机 skill 定制自动恢复器（结构化重打 / upsert 版）。

上游升级覆盖 skill 文件后，按「定位规则 + 定制片段」把本机定制重打回去：
- 定位规则针对结构位置（frontmatter 的某个键、定制段的首行标识、插入锚点），
  不依赖全文 diff，上游改 version、加注释等常规升级不会干扰；
- 定制内容是 snippets/ 下的独立文件——**片段是权威**：目标里定制段缺失 → 重新插入；
  内容与片段不一致 → 更新为目标为片段内容（所以「更新定制」只需要改片段再跑一次）；
- 锚点丢失 → 记 conflict + 桌面通知，不乱写；每步幂等、可重复运行；
- 由 launchd（com.xhq.skill-custom）在 skill 目录变动时触发，另有每小时兜底与登录时一次。

用法：python3 restore.py [--check]    # --check 只报告、不动手
"""

import fcntl
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SNIP = ROOT / "snippets"
LOG = ROOT / "restore.log"
CONFLICTS = ROOT / "conflicts"
LOCK = ROOT / ".lock"

PLANS = [
    {
        "name": "anysearch/SKILL.md",
        "target": "~/.claude/skills/anysearch/SKILL.md",
        "steps": [
            {"op": "fm", "key": "description", "snippet": "anysearch-desc.md"},
            {"op": "block", "marker": "**Freshness note:**",
             "anchor": "Use AnySearch for public discovery",
             "snippet": "anysearch-freshness.md"},
        ],
    },
    {
        "name": "agent-reach/SKILL.md",
        "target": "~/.claude/skills/agent-reach/SKILL.md",
        "steps": [
            {"op": "fm", "key": "description", "snippet": "agent-reach-desc.md"},
            {"op": "line", "marker": "4. **全网调研类任务**",
             "anchor": "5. **替用户盯版本**", "pad": False,
             "snippet": "agent-reach-rule4.md"},
            {"op": "block", "marker": "6. **通用检索走 anysearch**",
             "anchor": "## 路由表", "pad_before": False,
             "snippet": "agent-reach-rule6.md"},
        ],
    },
    {
        "name": "agent-reach/references/search.md",
        "target": "~/.claude/skills/agent-reach/references/search.md",
        "steps": [
            {"op": "line", "marker": "> 通用网页搜索优先用",
             "anchor": "Exa AI 搜索引擎。",
             "snippet": "agent-reach-search-note.md"},
        ],
    },
    {
        "name": "agent-reach/references/web.md",
        "target": "~/.claude/skills/agent-reach/references/web.md",
        "steps": [
            {"op": "line", "marker": "> 通用网页正文提取优先用",
             "anchor": "通用网页、RSS。",
             "snippet": "agent-reach-web-note.md"},
        ],
    },
]


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with LOG.open("a", encoding="utf-8") as f:
            f.write(f"[{ts}] {msg}\n")
        if LOG.stat().st_size > 200_000:  # 简易轮转：保留最后 500 行
            lines = LOG.read_text(encoding="utf-8").splitlines()[-500:]
            LOG.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except Exception:
        pass


def notify(title, msg):
    try:
        subprocess.run(
            ["osascript", "-e",
             f'display notification {json.dumps(msg)} with title {json.dumps(title)}'],
            capture_output=True, timeout=10,
        )
    except Exception:
        pass


def read(p):
    return p.read_text(encoding="utf-8")


def snippet(name):
    return read(SNIP / name).rstrip("\n")


def fm_upsert(txt, key, block):
    """frontmatter 内整块 upsert 某个键（key 行到下一个顶层键之前）。"""
    m = re.match(r"^(---\n)(.*?\n)(---\n)", txt, re.S)
    if not m:
        return txt, "conflict", "frontmatter 结构未识别"
    head, fm, tail = m.group(1), m.group(2), m.group(3)
    lines = fm.split("\n")
    start = next((i for i, ln in enumerate(lines) if re.match(rf"^{re.escape(key)}:", ln)), None)
    if start is None:
        return txt, "conflict", f"frontmatter 缺少 {key}: 键"
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if re.match(r"^[A-Za-z0-9_.-]+:", lines[j]):
            end = j
            break
    block_lines = block.split("\n")
    if lines[start:end] == block_lines:
        return txt, "ok", f"{key} 块已一致"
    new_fm = "\n".join(lines[:start] + block_lines + lines[end:])
    return head + new_fm + tail + txt[m.end():], "rewritten", f"{key} 块已更新"


def content_upsert(txt, step, block):
    """定制段 upsert：存在则更新为片段内容，缺失则在锚点前插入。"""
    lines = txt.split("\n")
    new = block.split("\n")
    start = next((i for i, ln in enumerate(lines) if ln.startswith(step["marker"])), None)
    if start is not None:
        end = start + 1
        if step["op"] == "block":  # 段一直延伸到空行或下一个标题
            while end < len(lines) and lines[end].strip() != "" and not lines[end].startswith("#"):
                end += 1
        if lines[start:end] == new:
            return txt, "ok", "定制段已一致"
        lines[start:end] = new
        return "\n".join(lines), "rewritten", "定制段已更新"

    anchor = step.get("anchor")
    if not anchor:
        return txt, "conflict", f"定制段缺失且无插入锚点：{step['marker'][:40]}"
    idx = next((i for i, ln in enumerate(lines) if ln.startswith(anchor)), None)
    if idx is None:
        return txt, "conflict", f"定制段缺失且锚点未找到：{anchor[:40]}"
    pad_before = step.get("pad_before", step.get("pad", True))
    pad_after = step.get("pad_after", step.get("pad", True))
    ins = []
    if idx > 0 and lines[idx - 1] == "":
        if not pad_before:
            del lines[idx - 1]  # 吞掉原有空行，紧贴上一行
            idx -= 1
    elif pad_before:
        ins.append("")
    ins += new
    if pad_after and (idx >= len(lines) or lines[idx] != ""):
        ins.append("")
    return "\n".join(lines[:idx] + ins + lines[idx:]), "rewritten", "定制段已插入"


def run(check_only=False):
    results = []
    conflicts = []

    for plan in PLANS:
        name = plan["name"]
        try:
            target = Path(os.path.expanduser(plan["target"]))
            if not target.exists():
                results.append((name, "skip", "target 不存在（未安装或已卸载）"))
                continue
            txt = read(target)
            orig = txt
            details = []
            for step in plan["steps"]:
                block = snippet(step["snippet"])
                if step["op"] == "fm":
                    txt, st, detail = fm_upsert(txt, step["key"], block)
                else:
                    txt, st, detail = content_upsert(txt, step, block)
                if st == "rewritten":
                    details.append(detail)
                elif st == "conflict":
                    conflicts.append((name, detail))
            if txt != orig:
                if check_only:
                    results.append((name, "missing", "需重打（--check 未动手）：" + "；".join(details)))
                else:
                    target.write_text(txt, encoding="utf-8")
                    results.append((name, "rewritten", "；".join(details)))
            else:
                results.append((name, "ok", "定制齐备"))
        except Exception as e:
            results.append((name, "error", f"{type(e).__name__}: {e}"))

    for name, st, msg in results:
        if st != "ok" or check_only:
            print(f"{st:9} {name}: {msg}")

    acted = [r for r in results if r[1] in ("rewritten", "error")]
    if acted:
        log("；".join(f"{n}({s}) {m}" for n, s, m in acted))
    if conflicts:
        CONFLICTS.mkdir(exist_ok=True)
        for name, detail in conflicts:
            out = CONFLICTS / (name.replace("/", "-") + ".md")
            try:
                out.write_text(read(Path(os.path.expanduser(
                    next(p["target"] for p in PLANS if p["name"] == name)))), encoding="utf-8")
            except Exception:
                pass
        log("冲突：" + "；".join(f"{n} {d}" for n, d in conflicts))
        notify("skill-custom：定制重打需要人工介入",
               f"{len(conflicts)} 处锚点丢失：" + "；".join(f"{n} {d}" for n, d in conflicts[:3]))
    return 0


def main():
    check_only = "--check" in sys.argv
    try:
        with LOCK.open("w") as lf:
            try:
                fcntl.flock(lf, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                return 0  # 已有一次在运行
            return run(check_only)
    except Exception as e:
        log(f"fatal: {type(e).__name__}: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
