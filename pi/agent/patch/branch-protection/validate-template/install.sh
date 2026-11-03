#!/usr/bin/env bash
# 给一个仓库装上团队标准的 validate CI 检查（三件套的第一件套）。
#
# 用法（在目标仓库根目录执行）：
#   ~/.pi/agent/patch/branch-protection/validate-template/install.sh [默认分支名]
#
# 省略默认分支名时自动取当前分支。
#
# 只写文件，不碰 git、不提交——装完后自己走 PR 流程：
#   1. 本地跑一遍：python3 .github/scripts/validate.py
#   2. 提交 + push + 开 PR
#   3. PR 合并后，用 branch-protection.sh apply 把 validate 挂成 required 并设 strict

set -euo pipefail

BRANCH="${1:-}"
if [ -z "$BRANCH" ]; then
  # 空仓库（还没有任何 commit）时 rev-parse 会报错，统一落回 main
  BRANCH=$( { git rev-parse --abbrev-ref HEAD 2>/dev/null || true; } | head -1 | tr -d '[:space:]')
  case "$BRANCH" in
    ''|HEAD) BRANCH=main ;;
  esac
fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -e .git ]; then
  echo "错误：请在目标仓库根目录执行（当前目录不是 git 仓库）" >&2
  exit 2
fi

mkdir -p .github/workflows .github/scripts

if [ -f .github/workflows/validate.yml ]; then
  echo "跳过：.github/workflows/validate.yml 已存在（如需覆盖请先手动删除）"
else
  sed "s/%BRANCH%/$BRANCH/" "$HERE/validate.yml" > .github/workflows/validate.yml
  echo "写入：.github/workflows/validate.yml（触发分支 ${BRANCH}）"
fi

cp "$HERE/validate.py" .github/scripts/validate.py
chmod +x .github/scripts/validate.py
echo "写入：.github/scripts/validate.py"

echo ""
echo "本地验证："
python3 .github/scripts/validate.py
