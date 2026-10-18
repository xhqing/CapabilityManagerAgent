#!/bin/bash
# chain-reset.sh —— 任务链级重置（macmini 侧执行）
#
# 由本机 session-link 扩展在「派活会话关闭」时通过 ssh 调用：
#   bash ~/.pi/agent/patch/session-link/chain-reset.sh --chain c-xxx [--chain c-yyy]
# 直接把链上全部会话重启（kill + 立刻重拉，清上下文），不等 duty 的 2 分钟周期。
#
# 也支持单个会话调试：--session Mark
#
# 2026-10-17 用户方案（Kit 实现）：后端会话的清零时机绑定在「本机派活会话关闭」上；
# 一次派活在 macmini 上可能级联出子会话（Mark → Mark-Intraday …），都要一起清。
# 注意：macOS 自带 bash 3.2，避免 mapfile / 关联数组等 4+ 特性。
set -uo pipefail

SCREEN=/usr/bin/screen
CONF="$HOME/.pi/agent/patch/duty-macmini/duty.conf"
REGISTRY="$HOME/.pi/agent/patch/session-link/chain-registry.json"
PI=/Users/mac/.local/node/bin/pi

export SCREENDIR="$HOME/.pi-duty-screens"
mkdir -p "$SCREENDIR" 2>/dev/null
chmod 700 "$SCREENDIR" 2>/dev/null

chains=()
direct_sessions=()
while [ $# -gt 0 ]; do
  case "$1" in
    --chain) chains+=("$2"); shift 2 ;;
    --session) direct_sessions+=("$2"); shift 2 ;;
    *) shift ;;
  esac
done

# 收集要重置的会话名到临时文件（每行一个）
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# 链 → 会话（从注册表展开）
if [ ${#chains[@]} -gt 0 ] && [ -f "$REGISTRY" ]; then
  python3 - "$REGISTRY" "${chains[@]}" >>"$TMP" <<'PY'
import json, sys
path = sys.argv[1]
wanted = set(sys.argv[2:])
try:
    data = json.load(open(path))
except Exception:
    sys.exit(0)
for cid, info in (data.get("chains") or {}).items():
    if cid in wanted:
        for s in info.get("sessions") or []:
            print(s)
PY
fi

# 显式指定的会话直接加入
for s in "${direct_sessions[@]:-}"; do
  [ -n "$s" ] && echo "$s" >>"$TMP"
done

# 去重
sort -u -o "$TMP" "$TMP"

count=$(grep -c . "$TMP" 2>/dev/null || echo 0)
if [ "$count" -eq 0 ]; then
  echo "chain-reset: 无可重置的会话（链：${chains[*]:-无}）"
  exit 0
fi

echo "chain-reset: 重置链 [${chains[*]:-无}] → 会话：$(paste -sd' ' "$TMP")"

while IFS= read -r name; do
  [ -z "$name" ] && continue
  # 从 duty.conf 找该会话的 cwd / intercom 名（单一事实源）
  line=$(grep -E "^pi-${name}\|" "$CONF" 2>/dev/null | head -1)
  if [ -z "$line" ]; then
    echo "  ${name}: 不在 duty.conf（跳过）"
    continue
  fi
  IFS='|' read -r screen_name ikey cwd _restart <<<"$line"

  # kill 现有会话（screen -S 前缀匹配会歧义：pi-Mark 会匹配 pi-Mark-Intraday；必须按 PID 精确）
  pid=$($SCREEN -ls 2>/dev/null | grep -oE "[0-9]+\.${screen_name}[[:space:]]" | head -1 | cut -d. -f1)
  [ -n "$pid" ] && $SCREEN -S "$pid" -X quit 2>/dev/null
  sleep 1

  # 立刻重拉（干净上下文；不等 duty）
  $SCREEN -dmS "$screen_name" /bin/zsh -lc "export TERM=xterm-256color; cd '$cwd' || exit 1; exec $PI -n '$ikey'"
  date +%s > "$SCREENDIR/.${screen_name}.started"
  echo "  ${name}: 已重置（intercom=${ikey}, cwd=${cwd}）"
done <"$TMP"

# 清理已完成重置的链记录
if [ -f "$REGISTRY" ] && [ ${#chains[@]} -gt 0 ]; then
  python3 - "$REGISTRY" "${chains[@]}" <<'PY'
import json, sys
path = sys.argv[1]
wanted = set(sys.argv[2:])
try:
    data = json.load(open(path))
except Exception:
    sys.exit(0)
chains = data.get("chains") or {}
for cid in list(chains.keys()):
    if cid in wanted:
        del chains[cid]
json.dump(data, open(path, "w"), ensure_ascii=False, indent=2)
PY
fi

echo "chain-reset: 完成"
