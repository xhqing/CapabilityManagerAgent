#!/usr/bin/env python3
"""pi 版 skill 触发评测（run_eval 的 pi 实现，2026-10-17）。

替代原 run_eval.py（依赖 Claude Code CLI `claude -p`）：本脚本用 pi 自身
（`pi -p --mode json`）跑测试查询，从 JSON 事件流里检测「被测 skill 是否
被加载」——即 agent 是否用 read 工具读了该 skill 的 SKILL.md。

用法（与 run_eval.py 对齐）：
  python3 run_eval_pi.py --eval-set <eval.json> --skill-path <skill目录> [options]

eval set 格式（同原版，JSON 数组）：
  [{"query": "用户会说的话", "should_trigger": true}, ...]

默认隔离（只测「该 skill 的 description 本身」）：
  --no-skills（不加载全局 skills）+ --skill <被测> + --no-context-files
  （不加载 AGENTS.md/CLAUDE.md）+ --no-session（不写会话文件）。
  ⚠️ 不要加 --no-extensions：本机模型 provider（volcengine 等）经 extension
  包注册，禁用后认证失败（实测 401）。
  用 --keep-global-skills / --keep-context 可分别放开隔离（测真实环境下的竞争）。

输出：JSON（与原版同构：results + summary）。
退出码：0 正常；1 参数/环境错误。
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from pathlib import Path

# 复用同目录的 frontmatter 解析（与原版一致）
sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from utils import parse_skill_md  # type: ignore
except Exception:  # pragma: no cover - 独立运行时兜底
    def parse_skill_md(skill_path: Path):  # type: ignore
        text = (skill_path / "SKILL.md").read_text()
        m_name = re.search(r"^name:\s*(.+)$", text, re.M)
        m_desc = re.search(r"^description:\s*(.+)$", text, re.M)
        return (
            (m_name.group(1).strip() if m_name else skill_path.name),
            (m_desc.group(1).strip() if m_desc else ""),
            text,
        )


@contextmanager
def skill_dir_with_description(skill_path: Path, description: str | None):
    """--description 覆盖：临时复制 skill 目录并替换 frontmatter 的 description。"""
    if description is None:
        yield skill_path
        return
    tmp = Path(tempfile.mkdtemp(prefix="pi-eval-skill-"))
    dest = tmp / skill_path.name
    shutil.copytree(skill_path, dest)
    skill_md = dest / "SKILL.md"
    text = skill_md.read_text()
    new_text, n = re.subn(r"^description:.*$", "description: " + description, text, count=1, flags=re.M)
    if n == 0:
        raise SystemExit("错误：--description 覆盖时未能在 SKILL.md 找到 description 行")
    skill_md.write_text(new_text)
    try:
        yield dest
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def build_cmd(query: str, skill_dir: Path, args) -> list[str]:
    cmd = ["pi", "-p", query, "--mode", "json", "--no-session"]
    if not args.keep_global_skills:
        cmd.append("--no-skills")
    cmd += ["--skill", str(skill_dir)]
    if not args.keep_context:
        cmd.append("--no-context-files")
    if args.model:
        cmd += ["--model", args.model]
    return cmd


def run_single_query(
    query: str,
    skill_dir: Path,
    timeout: int,
    args,
) -> bool | None:
    """跑一次查询（含空响应重试）。

    返回 True/False = 有效判定（触发/未触发）；None = 无效（连续空响应等，
    不计入触发率统计——2026-10-17 实测 pi 偶发「assistant 空响应」，约 10-25%）。
    """
    target = f"{skill_dir}/SKILL.md"
    for attempt in range(args.retries + 1):
        result = _run_once(query, target, timeout, skill_dir, args)
        if result is not None:
            return result
        if args.verbose:
            print(f"  [retry {attempt + 1}/{args.retries}] 空响应重试：{query[:40]}...", file=sys.stderr)
    return None


def _run_once(query: str, target: str, timeout: int, skill_dir: Path, args) -> bool | None:
    """跑一次 pi 调用；None = 空响应（无有效 assistant 输出）。"""
    cmd = build_cmd(query, skill_dir, args)
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd="/tmp",  # 中性工作目录（无项目文件）
        )
    except subprocess.TimeoutExpired:
        if args.verbose:
            print(f"  [timeout] {query[:50]}...", file=sys.stderr)
        return False
    except FileNotFoundError:
        raise SystemExit("错误：找不到 `pi` 命令（确认 pi 已安装并在 PATH 中）")

    triggered = False
    has_output = False
    for line in (proc.stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("type") == "tool_execution_start":
            blob = json.dumps(ev.get("args") or {}, ensure_ascii=False)
            if target in blob:
                triggered = True
        msg = ev.get("message") or {}
        if msg.get("role") == "assistant":
            content = msg.get("content")
            if isinstance(content, list) and any(
                isinstance(x, dict)
                and ((x.get("type") == "text" and x.get("text")) or x.get("type") == "toolCall")
                for x in content
            ):
                has_output = True
    if not has_output:
        if args.verbose and proc.returncode != 0:
            err = (proc.stderr or "").strip().splitlines()
            if err:
                print(f"  [stderr] {err[-1][:120]}", file=sys.stderr)
        return None
    return triggered


def run_eval(eval_set, skill_name, description, skill_dir, args, project_root=None):
    results_map: dict[str, list[bool]] = {}
    items_map: dict[str, dict] = {}

    jobs = []
    for item in eval_set:
        for _ in range(args.runs_per_query):
            jobs.append(item)

    with ThreadPoolExecutor(max_workers=args.num_workers) as executor:
        future_to_item = {
            executor.submit(run_single_query, item["query"], skill_dir, args.timeout, args): item
            for item in jobs
        }
        for fut in as_completed(future_to_item):
            item = future_to_item[fut]
            q = item["query"]
            items_map[q] = item
            results_map.setdefault(q, [])
            try:
                results_map[q].append(fut.result())
            except SystemExit:
                raise
            except Exception as e:  # noqa: BLE001
                print(f"Warning: query failed: {e}", file=sys.stderr)
                results_map[q].append(False)

    results = []
    invalid_queries = 0
    for query, raw in results_map.items():
        item = items_map[query]
        valid = [r for r in raw if r is not None]
        invalid_runs = len(raw) - len(valid)
        if not valid:
            invalid_queries += 1
            results.append(
                {
                    "query": query,
                    "should_trigger": bool(item["should_trigger"]),
                    "invalid": True,
                    "invalid_runs": invalid_runs,
                    "pass": None,
                }
            )
            continue
        rate = sum(valid) / len(valid)
        should = bool(item["should_trigger"])
        did_pass = (rate >= args.trigger_threshold) if should else (rate < args.trigger_threshold)
        results.append(
            {
                "query": query,
                "should_trigger": should,
                "trigger_rate": rate,
                "triggers": sum(valid),
                "runs": len(valid),
                "invalid_runs": invalid_runs,
                "pass": did_pass,
            }
        )

    passed = sum(1 for r in results if r["pass"] is True)
    failed = sum(1 for r in results if r["pass"] is False)
    return {
        "skill_name": skill_name,
        "description": description,
        "runner": "pi",
        "results": results,
        "summary": {
            "total": len(results),
            "passed": passed,
            "failed": failed,
            "invalid_queries": invalid_queries,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="pi 版 skill 触发评测（run_eval 的 pi 实现）")
    parser.add_argument("--eval-set", required=True, help="eval set JSON 文件路径")
    parser.add_argument("--skill-path", required=True, help="被测 skill 目录")
    parser.add_argument("--description", default=None, help="覆盖 description 测试（不改原文件）")
    parser.add_argument("--num-workers", type=int, default=5, help="并发数（默认 5）")
    parser.add_argument("--timeout", type=int, default=60, help="单查询超时秒数（默认 60）")
    parser.add_argument("--retries", type=int, default=2, help="空响应重试次数（默认 2；每次重试 = 一次额外调用）")
    parser.add_argument("--runs-per-query", type=int, default=3, help="每条查询重复次数（默认 3）")
    parser.add_argument("--trigger-threshold", type=float, default=0.5, help="触发率阈值（默认 0.5）")
    parser.add_argument("--model", default=None, help="传给 pi 的模型（默认用 pi 配置）")
    parser.add_argument("--keep-global-skills", action="store_true", help="放开隔离：同时加载全局 skills（测真实竞争）")
    parser.add_argument("--keep-context", action="store_true", help="放开隔离：同时加载 AGENTS.md/CLAUDE.md")
    parser.add_argument("--dry-run", action="store_true", help="只打印将执行的调用数，不真跑")
    parser.add_argument("--verbose", action="store_true", help="打印进度到 stderr")
    args = parser.parse_args()

    if shutil.which("pi") is None:
        sys.exit("错误：找不到 `pi` 命令（确认 pi 已安装并在 PATH 中）")

    skill_path = Path(args.skill_path).resolve()
    if not (skill_path / "SKILL.md").exists():
        sys.exit(f"错误：{skill_path} 下没有 SKILL.md")

    eval_set = json.loads(Path(args.eval_set).read_text())
    name, original_description, _ = parse_skill_md(skill_path)
    description = args.description or original_description

    total_calls = len(eval_set) * args.runs_per_query
    if args.dry_run:
        print(
            json.dumps(
                {
                    "skill": name,
                    "queries": len(eval_set),
                    "runs_per_query": args.runs_per_query,
                    "total_model_calls": total_calls,
                    "num_workers": args.num_workers,
                    "isolated": (not args.keep_global_skills, not args.keep_context),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return

    if args.verbose:
        print(f"评测 skill「{name}」：{len(eval_set)} 条查询 × {args.runs_per_query} 次 = 共 {total_calls} 次模型调用", file=sys.stderr)

    with skill_dir_with_description(skill_path, args.description) as test_dir:
        output = run_eval(eval_set, name, description, test_dir, args)

    if args.verbose:
        s = output["summary"]
        print(f"结果：{s['passed']}/{s['total']} 通过", file=sys.stderr)
        for r in output["results"]:
            if r.get("invalid"):
                status = "INVALID"
                detail = "(全部空响应)"
            else:
                status = "PASS" if r["pass"] else "FAIL"
                detail = f"rate={r['triggers']}/{r['runs']}"
            print(f"  [{status}] {detail} expected={r['should_trigger']}: {r['query'][:60]}", file=sys.stderr)

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
