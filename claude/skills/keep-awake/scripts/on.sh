#!/bin/bash
# 启用 Mac 合盖防睡眠。
# AC 电源：caffeinate -s 创建 PreventSystemSleep assertion，防合盖(Clamshell)+维护(Maintenance)两类系统级睡眠。
# 电池供电：合盖是硬件强制睡眠（软件防不住），caffeinate 仍启动（防空闲/维护类睡眠），但必须提醒用户接电源。
set -euo pipefail

# 已在跑则跳过（幂等，避免重复启动）
if pgrep -f "caffeinate -s" >/dev/null 2>&1; then
  echo "☕ caffeinate -s 已在跑（合盖防睡眠已生效）"
  echo "⚠️ 提醒：合盖防睡眠只在接电源时有效，请确认 Mac 已接电源"
  exit 0
fi

# 检测电源
SRC="电源未知"
if out=$(pmset -g batt 2>/dev/null); then
  if echo "$out" | grep -q "AC Power"; then SRC="AC"; fi
  if echo "$out" | grep -q "Battery Power"; then SRC="电池"; fi
fi

# 后台启动 caffeinate -s，脱离当前 shell（nohup + disown：本脚本退出后继续存活）
nohup caffeinate -s >/dev/null 2>&1 &
disown 2>/dev/null || true
sleep 0.5

if pgrep -f "caffeinate -s" >/dev/null 2>&1; then
  echo "☕ caffeinate -s 已启动（${SRC}·合盖防睡眠已开启）"
  if [ "$SRC" = "AC" ]; then
    echo "✅ 当前接电源：合上盖子进程继续跑"
  elif [ "$SRC" = "电池" ]; then
    echo "⚠️⚠️ 当前电池供电：合盖仍是硬件强制睡眠、软件防不住——请立即接入电源！"
    echo "   （电池下 caffeinate 只能防空闲/维护类睡眠，合盖必睡）"
  else
    echo "⚠️ 未能检测到电源状态：合盖防睡眠仅在接电源时有效，请确认已接电源"
  fi
  echo "停用：bash ~/.claude/skills/keep-awake/scripts/off.sh"
else
  echo "⚠️ caffeinate 启动失败" >&2
  exit 1
fi
