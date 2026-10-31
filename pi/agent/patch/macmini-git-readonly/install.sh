#!/bin/sh
# 在 macmini 上把全局 git hooks 指向本目录（只读镜像兜底，2026-10-31 用户立规）。
# 只应在 macmini 上运行——本机（MacBook）不做只读限制，脚本会拒绝在本机执行。
set -eu

HOST=$(hostname | tr '[:upper:]' '[:lower:]')
case "$HOST" in
	*mac-mini* | *macmini*) ;;
	*)
		echo "本脚本只应在 macmini 上运行（当前 hostname：$HOST）。MacBook 不做只读限制。" >&2
		exit 1
		;;
esac

DIR="$HOME/.pi/agent/patch/macmini-git-readonly/hooks"
if [ ! -d "$DIR" ]; then
	echo "钩子目录不存在：$DIR（确认镜像同步已完成再跑）" >&2
	exit 1
fi

chmod +x "$DIR"/*.sh "$DIR"/pre-* 2>/dev/null || true
git config --global core.hooksPath "$DIR"

echo "已设置 git 全局 core.hooksPath → $DIR"
echo "当前值：$(git config --global --get core.hooksPath)"
echo "自检：在任意仓库执行 commit / push 会被拒绝并打印原因；只读命令不受影响。"
