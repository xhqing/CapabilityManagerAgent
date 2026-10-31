#!/bin/sh
# 在 macmini 上撤销只读兜底（去掉全局 core.hooksPath）。仅在用户明确要求时使用。
set -eu

HOST=$(hostname | tr '[:upper:]' '[:lower:]')
case "$HOST" in
	*mac-mini* | *macmini*) ;;
	*)
		echo "本脚本只应在 macmini 上运行（当前 hostname：$HOST）。" >&2
		exit 1
		;;
esac

git config --global --unset core.hooksPath 2>/dev/null || true
echo "已撤销 git 全局 core.hooksPath（当前值：$(git config --global --get core.hooksPath || echo 未设置)）"
echo "注意：撤销后 macmini 的 git 写操作不再被 hook 拦截，pi 扩展那层仍生效（对 pi 会话而言）。"
