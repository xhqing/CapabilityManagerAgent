#!/bin/bash
# 每日逐字节校验（launchd com.xhq.mirror-verify 调用，03:00）
# 输出追加到 ~/Library/Logs/macmini-mirror-verify.log；发现差异时发系统通知（不抢焦点）。
PY=/opt/homebrew/bin/python3
SCRIPT="$HOME/.pi/agent/patch/macmini-mirror/verify.py"
LOG="$HOME/Library/Logs/macmini-mirror-verify.log"
OUT=$("$PY" "$SCRIPT" all 2>&1)
RC=$?
{
  echo "[$(date '+%F %T')] rc=$RC"
  echo "$OUT" | tail -20
} >> "$LOG"
if [ "$RC" -ne 0 ]; then
  osascript -e 'display notification "逐字节校验发现差异，详见 ~/Library/Logs/macmini-mirror-verify.log" with title "镜像校验失败"'
fi
