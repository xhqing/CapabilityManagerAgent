#!/usr/bin/env bash
# done-dialog —— 「电脑操作已结束」用毕确认弹窗（屏幕正中央）
#
# 用途：Agent 用 computer-use 操作完用户电脑后，弹此窗口通知用户「操作已结束、控制权归还」，
#       并【阻塞等待】用户点击「知道了」——点击动作即「确认信号」（已看到通知、控制权正式交还）。
#
# 用法：done-dialog.sh [本次操作的一句话说明]
#   用户点击「知道了」   → 退出码 0，stdout 输出 acknowledged
#   用户中止（Esc / 取消）→ 退出码 1，stdout 输出 dismissed
#
# 注意：本脚本会一直等到用户点击为止（这是设计意图：等确认、不自动关闭）。
set -euo pipefail

SUMMARY="${1:-}"

SCRIPT='on run argv
    set msgText to "我已停止电脑操作，控制权已归还给你。"
    set summaryText to ""
    if (count of argv) > 0 then set summaryText to item 1 of argv
    if summaryText is not "" then
        set msgText to msgText & return & "本次操作：" & summaryText
    end if
    try
        display dialog msgText buttons {"知道了"} default button "知道了" with title "电脑操作已结束" with icon note
        return "acknowledged"
    on error number -128
        return "dismissed"
    end try
end run'

RESULT="$(osascript -e "$SCRIPT" -- "$SUMMARY")"
echo "$RESULT"
[ "$RESULT" = "acknowledged" ]
