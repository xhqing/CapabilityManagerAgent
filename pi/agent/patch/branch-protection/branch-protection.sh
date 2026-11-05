#!/usr/bin/env bash
# GitHub 仓库 main 分支保护 —— strict 模式 PR CI 的配置与审计
#
# 规矩来源：~/.pi/agent/AGENTS.md「开发流程：worktree + PR」第 3 条
#           （2026-11-03 用户立规：新建项目仓库一律必须 strict 模式的 PR CI）
# 说明文档：~/.pi/agent/docs/repo-branch-protection.md
#
# 用法：
#   branch-protection.sh audit --owner <owner> [仓库列表文件] [--json]
#   branch-protection.sh show  <owner/repo> [--branch main]
#   branch-protection.sh apply <owner/repo> [--branch main] --checks "a,b" [--apply]
#
# audit  审计一批仓库的 strict 状态（只读）
#   - 不给列表文件时，自动取该 owner 名下全部未归档仓库
#   - 列表文件每行 "-- 仓库名 [分支]"，分支缺省 main，"--" 开头为注释
#   - 退出码：0 = 全部合规；1 = 存在不合规
# show   查单个仓库的详细保护配置（只读）
# apply  给单个仓库配置 strict 保护三件套
#   - 默认 dry-run，只打印将执行的命令与 JSON；加 --apply 才真改
#
# 判定口径（与 GitHub 实际行为一致）：
#   classic branch protection 与 rulesets 是叠加生效的，多个规则取并集。
#   所以只要任一来源要求 strict，该仓库就是 strict 生效；只看 classic 会漏判。

set -euo pipefail

PROG=$(basename "$0")

die() { echo "错误：$*" >&2; exit 2; }
need_gh() { command -v gh >/dev/null || die "需要安装 gh（GitHub CLI）"; }

# ---------- 单仓库检测 ----------

# 输出：<status>|<source>|<checks>
#   status: strict / non-strict / no-required-check
#   source: classic / ruleset / classic+ruleset / -
detect() {
  local repo=$1 branch=$2
  local prot rc rules
  prot=$(gh api "repos/$repo/branches/$branch/protection" 2>/dev/null); rc=$?
  rules=$(gh api "repos/$repo/rules/branches/$branch" 2>/dev/null || echo '[]')

  PROG_IN="$repo" BR_IN="$branch" PROT_IN="$prot" PROT_RC="$rc" RULES_IN="$rules" \
  python3 -c '
import json, os

repo = os.environ["PROG_IN"]
prot_rc = int(os.environ["PROT_RC"])
prot_raw = os.environ.get("PROT_IN", "")
try:
    rules = json.loads(os.environ.get("RULES_IN") or "[]")
except Exception:
    rules = []

sources = []
# classic 分支保护
if prot_rc == 0 and prot_raw:
    try:
        d = json.loads(prot_raw)
    except Exception:
        d = {}
    rsc = d.get("required_status_checks")
    if rsc:
        checks = list(rsc.get("contexts") or []) + list(rsc.get("checks") or [])
        names = []
        for c in checks:
            names.append(c.get("context") if isinstance(c, dict) else str(c))
        # classic 存在时 strict 字段一定是明确的 true/false
        sources.append(("classic", bool(rsc.get("strict")), names))

# rulesets（叠加生效）
if isinstance(rules, list):
    for r in rules:
        if r.get("type") != "required_status_checks":
            continue
        p = r.get("parameters") or {}
        names = [c.get("context", "?") for c in (p.get("required_status_checks") or [])]
        sources.append(("ruleset", bool(p.get("strict_required_status_checks_policy")), names))

if not sources:
    print("no-required-check|-|-")
else:
    strict = any(s[1] for s in sources)
    src = "+".join(dict.fromkeys(s[0] for s in sources))
    names = []
    for s in sources:
        names.extend(s[2])
    names = list(dict.fromkeys(n for n in names if n))
    print(("%s" % ("strict" if strict else "non-strict")) + "|" + src + "|" + (",".join(names) or "-"))
'
}

# 仓库里是否有 GitHub Actions workflow（区分「有 CI 没挂门禁」与「压根没 CI」）
has_workflow() {
  local repo=$1
  local n
  n=$(gh api "repos/$repo/contents/.github/workflows" --jq 'length' 2>/dev/null || echo x)
  if [ "$n" = "x" ] || [ -z "$n" ]; then
    echo no
  elif [ "$n" -gt 0 ] 2>/dev/null; then
    echo yes
  else
    echo no
  fi
}

default_branch() {
  gh api "repos/$1" --jq '.default_branch' 2>/dev/null || echo main
}

# ---------- 审计 ----------

cmd_audit() {
  local owner="" list="" json=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --owner) owner=$2; shift 2 ;;
      --json)  json=1; shift ;;
      -*)      die "未知参数：$1" ;;
      *)       list=$1; shift ;;
    esac
  done

  local pairs=()
  if [ -n "$list" ]; then
    [ -f "$list" ] || die "列表文件不存在：$list"
    while IFS= read -r line; do
      line=$(printf '%s' "$line" | sed 's/#.*//' | xargs 2>/dev/null || true)
      [ -z "$line" ] && continue
      set -- $line
      local name=$1 br=${2:-main}
      case "$name" in
        */*) pairs+=("$name $br") ;;
        *)   [ -n "$owner" ] || die "列表文件里的「${name}」没有 owner 前缀，请加 --owner"
             pairs+=("$owner/$name $br") ;;
      esac
    done < "$list"
  elif [ -n "$owner" ]; then
    while IFS=$'\t' read -r name br; do
      pairs+=("$owner/$name ${br:-main}")
    done < <(gh repo list "$owner" --limit 400 \
               --json name,defaultBranchRef,isArchived \
               --jq '.[] | select(.isArchived|not) | "\(.name)\t\(.defaultBranchRef.name // "main")"')
  else
    die "audit 需要 --owner <owner> 或一个仓库列表文件"
  fi

  local tmp
  tmp=$(mktemp)
  export -f detect has_workflow
  printf '%s\n' "${pairs[@]}" | xargs -P 8 -n 2 bash -c '
    repo=$0; br=$1
    st=$(detect "$repo" "$br")
    wf=$(has_workflow "$repo")
    printf "%s|%s|%s|%s\n" "$repo" "$br" "$st" "$wf"
  ' >> "$tmp"

  sort -u "$tmp" | PROG_JSON=$json python3 -c '
import sys, os, json
rows = []
for line in sys.stdin:
    line = line.rstrip("\n")
    if not line: continue
    parts = line.split("|")
    repo, br = parts[0], parts[1]
    status, source, checks, wf = parts[2], parts[3], parts[4], parts[5]
    rows.append(dict(repo=repo, branch=br, status=status, source=source,
                     checks=checks, workflows=(wf == "yes")))
rows.sort(key=lambda r: r["repo"])
if os.environ.get("PROG_JSON") == "1":
    print(json.dumps(rows, ensure_ascii=False, indent=2))
else:
    strict = [r for r in rows if r["status"] == "strict"]
    loose  = [r for r in rows if r["status"] == "non-strict"]
    none   = [r for r in rows if r["status"] == "no-required-check"]
    none_ci   = [r for r in none if r["workflows"]]
    none_noci = [r for r in none if not r["workflows"]]

    print("=== 汇总 ===")
    print("  总仓库数            %d" % len(rows))
    print("  strict 合格         %d" % len(strict))
    print("  有 required 但非 strict  %d" % len(loose))
    print("  无 required check   %d  （其中有 CI 却没挂门禁 %d，无 CI %d）"
          % (len(none), len(none_ci), len(none_noci)))

    if strict:
        print("\n=== strict（合格）===")
        for r in strict:
            print("  OK  %-28s %-7s %-14s %s" % (r["repo"], r["branch"], r["source"], r["checks"]))
    if loose:
        print("\n=== 有 required check 但 strict=false（漏洞）===")
        for r in loose:
            print("  !!  %-28s %-7s %-14s %s" % (r["repo"], r["branch"], r["source"], r["checks"]))
    if none_ci:
        print("\n=== 有 CI 但没挂成 required check（CI 只是看着绿、拦不住合并）===")
        for r in none_ci:
            print("  !!  %-28s %-7s" % (r["repo"], r["branch"]))
    if none_noci:
        print("\n=== 既无 CI 也无 required check（完全没有门禁）===")
        for r in none_noci:
            print("  --  %-28s %-7s" % (r["repo"], r["branch"]))

    bad = len(loose) + len(none)
    print("\n%s：%d/%d 合规%s" % ("结论", len(strict), len(rows),
          "" if bad == 0 else "，%d 个不合规" % bad))
    sys.exit(0 if bad == 0 else 1)
'
  rm -f "$tmp"
}

# ---------- 单仓库详情 ----------

cmd_show() {
  local repo="" branch=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --branch) branch=$2; shift 2 ;;
      -*) die "未知参数：$1" ;;
      *)  repo=$1; shift ;;
    esac
  done
  [ -n "$repo" ] || die "show 需要 <owner/repo>"
  [ -n "$branch" ] || branch=$(default_branch "$repo")

  local det; det=$(detect "$repo" "$branch")
  echo "仓库：$repo    分支：$branch"
  echo "strict 判定：$(echo "$det" | cut -d'|' -f1)"
  echo "来源：$(echo "$det" | cut -d'|' -f2)"
  echo "required checks：$(echo "$det" | cut -d'|' -f3)"
  echo "workflow 存在：$(has_workflow "$repo")"

  echo ""
  echo "最近一次 main 上出现过的 check 名（可用于 --checks）："
  gh api "repos/$repo/commits/$branch/check-runs" --jq '[.check_runs[].name]|unique|.[]' 2>/dev/null \
    | sed 's/^/  - /' || echo "  （取不到，可能是还没有任何 CI 跑过）"
}

# ---------- 配置 strict 三件套 ----------

cmd_apply() {
  local repo="" branch="" checks="" do_apply=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --branch) branch=$2; shift 2 ;;
      --checks) checks=$2; shift 2 ;;
      --apply)  do_apply=1; shift ;;
      -*) die "未知参数：$1" ;;
      *)  repo=$1; shift ;;
    esac
  done
  [ -n "$repo" ] || die "apply 需要 <owner/repo>"
  [ -n "$branch" ] || branch=$(default_branch "$repo")
  [ -n "$checks" ] || die "apply 需要 --checks \"检查名,检查名\"（必须是 PR 上会真实跑的检查；先跑 show 拿到真实名字）"

  # 校验 check 名字是否真实出现过——填错会永久卡住所有 PR
  local known warn=""
  known=$(gh api "repos/$repo/commits/$branch/check-runs" --jq '[.check_runs[].name]|unique|.[]' 2>/dev/null || true)
  IFS=',' read -ra want <<< "$checks"
  for c in "${want[@]}"; do
    c=$(printf '%s' "$c" | xargs)
    if [ -n "$known" ] && ! printf '%s\n' "$known" | grep -Fxq "$c"; then
      warn="$warn\n  ! 检查名「${c}」从未在该仓库 $branch 上出现过——挂上会永久卡住合并"
    fi
  done
  if [ -n "$warn" ]; then
    echo -e "警告（不阻止，但请确认）：$warn"
    echo "  当前已知的检查名："
    printf '%s\n' "$known" | sed 's/^/    - /'
    echo ""
  fi

  local payload
  payload=$(CHECKS_IN="$checks" python3 -c '
import json, os
names = [c.strip() for c in os.environ["CHECKS_IN"].split(",") if c.strip()]
print(json.dumps({
  "required_status_checks": {"strict": True, "contexts": names},
  "enforce_admins": True,
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "restrictions": None,
  "allow_force_pushes": False,
  "allow_deletions": False,
  "required_linear_history": True,
  "required_conversation_resolution": False,
}, ensure_ascii=False, indent=2))
')

  echo "将对 ${repo}（分支 ${branch}）执行："
  echo ""
  echo "1) 仓库合并设置：只允许 squash / 开 auto-merge / 合并后删分支"
  echo "   gh api -X PATCH repos/$repo -F allow_auto_merge=true \\"
  echo "     -F allow_squash_merge=true -F allow_merge_commit=false \\"
  echo "     -F allow_rebase_merge=false -F delete_branch_on_merge=true"
  echo ""
  echo "2) 分支保护（注意 required_status_checks.strict = true）："
  echo "   gh api -X PUT repos/$repo/branches/$branch/protection --input - <<< '<下方 JSON>'"
  echo "$payload" | sed 's/^/   /'
  echo ""

  if [ "$do_apply" -ne 1 ]; then
    echo "（dry-run：以上命令未执行。确认无误后加 --apply 真正生效。）"
    return 0
  fi

  echo "执行中……"
  gh api -X PATCH "repos/$repo" \
    -F allow_auto_merge=true -F allow_squash_merge=true \
    -F allow_merge_commit=false -F allow_rebase_merge=false \
    -F delete_branch_on_merge=true >/dev/null
  printf '%s' "$payload" | gh api -X PUT "repos/$repo/branches/$branch/protection" --input - >/dev/null
  echo "完成。复核结果："
  cmd_show "$repo" --branch "$branch"
}

# ---------- 入口 ----------

need_gh
[ $# -gt 0 ] || { sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
cmd=$1; shift
case "$cmd" in
  audit) cmd_audit "$@" ;;
  show)  cmd_show  "$@" ;;
  apply) cmd_apply "$@" ;;
  -h|--help|help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "未知命令：${cmd}（可用：audit / show / apply）" ;;
esac
