#!/usr/bin/env bash
# 把 add-mode 命令装到 ~/.local/bin（复制而非软链：避免仓库目录被移动后命令失效）。
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/add-mode"
DEST_DIR="$HOME/.local/bin"
DEST="$DEST_DIR/add-mode"

mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST"
chmod +x "$DEST"

echo "已安装：$DEST"
case ":$PATH:" in
	*":$DEST_DIR:"*) ;;
	*) echo "提示：$DEST_DIR 不在 PATH 里，需要把它加进 shell 配置。" ;;
esac
"$DEST" list
