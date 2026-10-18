#!/bin/bash
# 同步本机全局 pi 能力层 → macmini（单向：本机为权威源）
#
# 用法：bash sync-to-macmini.sh [目标主机，默认 mac-mini]
# 由 Kit 会话 2026-10-17 建立（首次全量同步验证后固化）。
#
# 同步内容（能力层）：CLAUDE.md / skills / docs / patch / extensions
#   + settings.json / models.json / mcp-adapter.json / auth.json
# 不传（运行时/本机专属）：sessions / state / intercom / bin / models-store /
#   mcp-*-cache / tmp / trust.json
# 注：bin/（fd/rg 辅助二进制）不随同步——macmini 侧已单独补装 x64 版
#   （rg 15.0.0 / fd 10.5.0，2026-10-17）；本机为 arm64 版，勿直接拷贝
# 排除（本机私有）：.env / *.env / backup endpoints / __pycache__ / *.lock / *.log
# 目标侧路径修正：用户名不同（本机 xhq → macmi 的 mac），anysearch runtime.conf 自动改写
set -euo pipefail

HOST="${1:-mac-mini}"
G="$HOME/.pi/agent"
T=".pi/agent"
EX="--exclude=__pycache__ --exclude=*.pyc --exclude=.env --exclude=*.env --exclude=endpoints.json --exclude=*.lock --exclude=*.log --exclude=tmp --exclude=.lock.d --exclude=session-link/config.json --exclude=session-link/local-links.json --exclude=session-link/chain-registry.json"

# 并发锁（watcher 与手动执行互斥；已在跑则幂等跳过）
LOCK="$G/patch/sync-to-macmini/.lock.d"
if ! mkdir "$LOCK" 2>/dev/null; then echo "（已有同步进行中，跳过）"; exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "== 同步 $G → $HOST:~/$T =="

# 核心文件（含凭据 auth.json——保持两机一致可用；如 macmini 独立授权请自行排除）
rsync -a "$G/CLAUDE.md" "$G/settings.json" "$G/models.json" "$G/mcp-adapter.json" "$G/auth.json" "$HOST:$T/"

# 能力目录
rsync -a --delete $EX "$G/skills/" "$HOST:$T/skills/"
rsync -a --delete --exclude='__pycache__' "$G/docs/" "$HOST:$T/docs/"
rsync -a --delete $EX "$G/patch/" "$HOST:$T/patch/"
rsync -a --delete --exclude='__pycache__' "$G/extensions/" "$HOST:$T/extensions/"

# 目标侧修正：路径（/Users/xhq → /Users/mac）+ 权限
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" 'chmod 600 ~/.pi/agent/auth.json; perl -pi -e "s|/Users/xhq|/Users/mac|g" ~/.pi/agent/skills/anysearch/runtime.conf 2>/dev/null || true'

echo "== 完成 =="
echo "验证建议：ssh $HOST 'cd ~ && pi -p \"列出你的技能并给出 add 的 SKILL.md 路径\"'"
