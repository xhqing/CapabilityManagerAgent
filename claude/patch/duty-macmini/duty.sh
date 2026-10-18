#!/bin/bash
# macmini 多会话守护（launchd 每 120 秒调用一次）
# 按 duty.conf 保证各会话常驻（掉线自动重拉）+ 到期自动重启（定时清上下文）
# 2026-10-17 由 Kit 会话建立；含三次事故修复（pipefail/SCREENDIR 未固定/冷却窗口）。
set -uo pipefail

SCREEN=/usr/bin/screen
PI=/Users/mac/.local/node/bin/pi
CONF="$(cd "$(dirname "$0")" && pwd)/duty.conf"

# 固定 screen socket 目录（launchd 与 ssh 的 TMPDIR 不同；不固定会导致检测失效、重复拉起）
export SCREENDIR="$HOME/.pi-duty-screens"
mkdir -p "$SCREENDIR" 2>/dev/null
chmod 700 "$SCREENDIR" 2>/dev/null

# 注意：screen -ls 退出码非零（1），脚本顶部 set -o pipefail 会让
# 「screen -ls | grep -q」整体返回非零——必须先取输出（|| true）再 grep（事故根因）。
LS_OUT="$($SCREEN -ls 2>/dev/null || true)"

now=$(date +%s)

while IFS='|' read -r name ikey cwd restart_h; do
  # 跳过注释与空行
  case "$name" in ''|\#*) continue ;; esac

  alive=false
  printf '%s\n' "$LS_OUT" | grep -qE "[[:space:]][0-9]+\.${name}[[:space:]]" && alive=true

  # 到期检查（alive 时才查；时间戳文件由本脚本在不重启路径维护）
  expired=false
  stamp="$SCREENDIR/.$name.started"
  if $alive && [ "${restart_h:-0}" != "0" ] && [ -f "$stamp" ]; then
    started=$(stat -f %m "$stamp" 2>/dev/null || echo "$now")
    if [ $(( (now - started) / 3600 )) -ge "$restart_h" ]; then
      expired=true
    fi
  fi

  if $alive && ! $expired; then
    # 存活且未到期：如缺时间戳则补写（例如手工起的会话）
    [ -f "$stamp" ] || date +%s > "$stamp"
    continue
  fi

  # 冷却：60 秒内刚启动过则跳过（防「socket 注册延迟」的秒级重复拉起）
  if [ -f "$stamp" ]; then
    last=$(stat -f %m "$stamp" 2>/dev/null || echo 0)
    if [ $((now - last)) -lt 60 ]; then
      echo "[$(date '+%F %T')] ${name}：最近 60 秒内刚启动过，等待注册（跳过）"
      continue
    fi
  fi

  reason="掉线"
  $alive && reason="到期重启（已运行 ${restart_h}h+）"
  # 注意：screen -S 是「前缀匹配」——`pi-Mark` 会歧义匹配到 pi-Mark-Intraday 等；
  # 必须用「PID」精确关（ls 行形如 `70996.pi-Mark\t(Detached)`，按 name 后跟空白界定）。
  pid=$(printf '%s\n' "$LS_OUT" | grep -oE "[0-9]+\.${name}[[:space:]]" | head -1 | cut -d. -f1)
  [ -n "$pid" ] && $SCREEN -S "$pid" -X quit 2>/dev/null
  sleep 1
  $SCREEN -dmS "$name" /bin/zsh -lc "export TERM=xterm-256color; cd '$cwd' || exit 1; exec $PI -n '$ikey'"
  date +%s > "$stamp"
  echo "[$(date '+%F %T')] ${name}：已启动（${reason}，cwd=${cwd}，intercom=${ikey}）"
done < "$CONF"
