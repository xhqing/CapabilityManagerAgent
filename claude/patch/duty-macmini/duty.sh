#!/bin/bash
# macmini 值班会话守护（launchd 周期调用；确保常驻 screen 会话 pi-macmini 存活）
# 2026-10-17 由 Kit 会话建立。运行位置：macmini（用户 mac）。
# 被 ~/Library/LaunchAgents/com.xhq.pi-duty.plist 每 120 秒调用一次。
set -uo pipefail

SCREEN=/usr/bin/screen
SESSION=pi-macmini
PI=/Users/mac/.local/node/bin/pi
# 固定 screen socket 目录：launchd 与 ssh 环境的 TMPDIR 不同，不固定会导致「检测看不到已有会话」
# 而重复拉起——2026-10-17 事故：3 小时拉起 85 个重复会话，修复后必须保持固定
export SCREENDIR="$HOME/.pi-duty-screens"
mkdir -p "$SCREENDIR" 2>/dev/null
chmod 700 "$SCREENDIR" 2>/dev/null

# 注意：screen -ls 退出码为非零（1），而本脚本顶部 set -o pipefail 会让
# 「screen -ls | grep -q」管道整体返回非零——必须先取输出（|| true 消码）再 grep。
# 2026-10-17 事故根因：pipefail 踩了 screen -ls 的非零退出码，检测永远为假、
# 每个周期重复拉起值班会话（曾 3 小时堆积 85 个）。
LS_OUT=$($SCREEN -ls 2>/dev/null || true)
if printf '%s\n' "$LS_OUT" | grep -q "$SESSION"; then
  echo "[$(date '+%F %T')] 值班会话存活"
  exit 0
fi

# 冷却：60 秒内刚启动过则跳过——防「screen socket 注册延迟」导致的秒级重复拉起
# （2026-10-17 事故教训：检测与启动之间存在极短竞态窗口）
STAMP="$SCREENDIR/.last-start"
if [ -f "$STAMP" ]; then
  LAST=$(stat -f %m "$STAMP" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  if [ $((NOW - LAST)) -lt 60 ]; then
    echo "[$(date '+%F %T')] 最近 60 秒内刚启动过，等待注册（跳过）"
    exit 0
  fi
fi

$SCREEN -dmS "$SESSION" /bin/zsh -lc "export TERM=xterm-256color; cd ~; exec $PI -n macmini"
date +%s > "$STAMP"
echo "[$(date '+%F %T')] 已（重新）启动值班会话 $SESSION"
