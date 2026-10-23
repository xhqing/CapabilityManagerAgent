#!/bin/bash
# 停用 Mac 合盖防睡眠（解除 PreventSystemSleep assertion）。
if pkill -f "caffeinate -s" 2>/dev/null; then
  echo "☕ caffeinate -s 已停用（合盖防睡眠解除，恢复正常睡眠）"
else
  echo "（无 caffeinate -s 在跑，无需停用）"
fi
