#!/usr/bin/env python3
"""dev-workflow 测试文件写保护（PreToolUse hook）。

背景：测试开发分离 + 测试先行（dev-workflow 2026-09-21 三次修订，配合
Issue 需求端）：测试（用例）定义权归测试 Agent（Hopper / 独立代行会话 /
用户手写），开发 Agent 对一切测试文件只读 + 可运行、禁止增删改——防
「改不动代码就改测试迁就实现」，也防写完实现后补「快照式测试」把当前
行为连 bug 固化进断言。本 hook 把这条规矩从 skill 文本约束升级为工具强制。

保护对象（测试文件全量）：
- 存量兼容：test-cases/ 目录（独立路径段）；
- 测试目录段：路径中含独立段 test / tests / __tests__ / __snapshots__ /
  spec / e2e（整段匹配，不误伤 latest / contest / testcase 等含 test 字样
  的普通目录）；
- 测试文件名：*.test.* / *.spec.* / test_*.py / *_test.py / *_test.go /
  conftest.py / *.snap。

拦截范围：
- Write / Edit（含 ApplyPatch 别名）写入上述目标；
- Bash 命令中指向上述目标的写类操作：rm / mv / touch / mkdir / tee /
  truncate / chmod 等参数含测试目标；cp / ln / rsync / install 目标参数
  是测试目标；sed -i；输出重定向（> / >>）目标为测试文件；find -delete；
  git rm / mv / add / clean / restore / checkout / stash（显式指向测试目标）。

放行：
- 一切读与运行操作（cat / ls / grep / diff / git log / 跑测试命令等——
  跑测试命令不含写动词，天然放行）；
- 命令中带授权标记 `# TEST_CASES_WRITE_OK` 的整条命令（测试 Agent 出题
  写测试、独立会话代行、用户授权的例外操作走此通道，与杀 VSC 进程 hook
  的 `# AI_AUTHORIZED_KILL_VSC` 同模式）。

拦截动作：exit 2（deny），stderr 说明原因与合规通道。

已知的强度边界（接受）：拦「显式路径的写命令」，拦不住命令内部代码的
文件操作（如 python -c 里 open(..., 'w')）与 `git add .` 这类无显式目标
的形式——深层规避靠 dev-workflow 流程纪律与测试 Agent 独立出题兜底。
"""

import json
import re
import sys

AUTH_MARK = "TEST_CASES_WRITE_OK"

# —— 测试目标判定（路径 / token 形态）——
# 存量 test-cases/ 与常见测试目录（须为独立路径段）
TEST_DIR_SEG = re.compile(
    r"(?:^|/)(?:test-cases|tests?|__tests__|__snapshots__|spec|e2e)(?:/|$)"
)
# 测试文件名（basename 形态锚定结尾；不误伤 foo.testimonial.md 这类
# 双扩展名歧义——按 *.test.<ext> 的主流命名约定判定）
TEST_FILE = re.compile(
    r"(?:^|/)(?:"
    r"[\w.+-]+\.(?:test|spec)\.[A-Za-z0-9.]+"  # a.test.ts / b.spec.js
    r"|test_[\w.+-]+\.py"                       # test_foo.py（pytest）
    r"|[\w.+-]+_test\.py"                       # foo_test.py（unittest 别名）
    r"|[\w.+-]+_test\.go"                       # foo_test.go
    r"|conftest\.py"                            # pytest 基础设施
    r"|[\w.+-]+\.snap"                          # jest/vitest 快照
    r")$"
)


def is_test_target(path: str) -> bool:
    """路径 / token 是否落在保护对象内。"""
    if not path:
        return False
    return bool(TEST_DIR_SEG.search(path) or TEST_FILE.search(path))


# 任意参数含测试目标即违规的写动词（这些动词碰到测试目标必然是
# 删 / 改 / 移动；mv 的源或目标任一在保护内都算）
WRITE_ANY = re.compile(
    r"\b(rm|rmdir|shred|unlink|touch|mkdir|tee|truncate|dd|chmod|chown|mv)\b"
)
# 目标参数（尾部 token）是测试目标才违规的写动词（cp src dst：源是
# 测试目标属于读取，放行；目标写入才拦）
WRITE_DST = re.compile(r"\b(cp|ln|rsync|scp|install)\b")
GIT_WRITE = re.compile(r"\bgit\s+(rm|mv|add|clean|restore|checkout|stash)\b")
SED_INPLACE = re.compile(r"\bsed\s+(?:-\w*i\w*|--in-place)")
REDIRECT = re.compile(r">{1,2}\s*(\S+)")
FIND_DELETE = re.compile(r"\s-delete\b")
TOKEN_SPLIT = re.compile(r"[\s'\"]+")
# Bash 快速预筛：不含这些字样的命令直接放行（段级精判兜底准确性）
PREFILTER = re.compile(r"test|spec|e2e|snap|conftest", re.IGNORECASE)

DENY_REASON = (
    "[test-cases-guard] 拦截：测试文件（测试目录 test/ tests/ __tests__/ "
    "spec/ e2e/、*.test.* / *.spec.* / test_*.py / *_test.go / conftest.py "
    "等）对开发 Agent 只读 + 可运行，禁止增删改——用例定义权归测试 Agent "
    "（测试先行，防「改测试迁就实现」与「补快照式测试」；dev-workflow "
    "纪律）。若确需写入（测试 Agent 出题、独立会话代行出题、用户授权的"
    "例外操作），在命令末尾加授权标记 `# TEST_CASES_WRITE_OK`，或由用户"
    "手动操作；若发现测试 / 需求本身有问题，终止开发并向用户上报，不自行"
    "改测试绕过。"
)


def deny() -> None:
    sys.stderr.write(DENY_REASON)
    sys.exit(2)


def guard_file_tool(tool_input: dict) -> None:
    path = tool_input.get("file_path") or tool_input.get("path") or ""
    if is_test_target(path):
        deny()


def seg_test_target(seg: str) -> bool:
    """段中是否出现指向测试目标的 token。"""
    return any(is_test_target(tok) for tok in TOKEN_SPLIT.split(seg) if tok)


def seg_violates(seg: str) -> bool:
    """判定单个命令段是否对测试目标有写操作。"""
    has_target = seg_test_target(seg)
    m = REDIRECT.search(seg)
    redirect_hit = bool(m and is_test_target(m.group(1).strip("'\"")))
    if not has_target and not redirect_hit:
        return False
    if WRITE_ANY.search(seg) or GIT_WRITE.search(seg) or SED_INPLACE.search(seg):
        return True
    if redirect_hit:
        return True
    if FIND_DELETE.search(seg) and has_target:
        return True
    if WRITE_DST.search(seg):
        # cp / ln / rsync / install：仅当尾部 token（目标）是测试目标
        tokens = [t.strip("'\"") for t in TOKEN_SPLIT.split(seg) if t]
        if tokens and is_test_target(tokens[-1]):
            return True
    return False


def guard_bash(command: str) -> None:
    if AUTH_MARK in command or not PREFILTER.search(command):
        return
    # 按 ; && || | 换行 拆段逐段判定，把误判限制在单段内
    #（如 `git checkout main && ls test/` 的第二段是纯读，放行）
    for seg in re.split(r"[;|&\n]+", command):
        if seg_violates(seg):
            deny()


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        # 输入异常时不阻塞会话（防御性放行）
        sys.exit(0)

    tool = data.get("tool_name") or ""
    tool_input = data.get("tool_input") or {}

    if tool in ("Write", "Edit", "ApplyPatch"):
        guard_file_tool(tool_input)
    elif tool == "Bash":
        guard_bash(tool_input.get("command") or "")
    sys.exit(0)


if __name__ == "__main__":
    main()
