#!/usr/bin/env bash
# subsync 安装脚本：把订阅改写服务部署为 launchd 常驻服务。
#
# 用法：
#   ./install.sh <上游订阅链接> <监听地址> [端口]
#
# 示例（只对 Tailscale 网卡可见）：
#   ./install.sh "https://example.com/sub" 100.64.0.5 8787
#
# 行为：
#   1. 复制 subsync.py 到 ~/.local/lib/subsync/（生产目录，与源码目录隔离）
#   2. 首次运行时生成 ~/.config/subsync/config.json（含随机令牌与随机请求头密钥，权限 600）
#   3. 写入 ~/Library/LaunchAgents/net.xhq.subsync.plist 并加载，开机自启、崩溃自拉
#
# 重复运行是安全的：配置不会被覆盖，服务会被重启以应用新代码。

set -euo pipefail

SOURCE="${1:-}"
BIND="${2:-}"
BINDS_JSON="$(python3 -c 'import json,sys;print(json.dumps([x.strip() for x in sys.argv[1].split(",") if x.strip()]))' "$BIND")"
PORT="${3:-8787}"

if [[ -z "$SOURCE" || -z "$BIND" ]]; then
    echo "用法: $0 <上游订阅链接> <监听地址> [端口]" >&2
    exit 1
fi

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$HOME/.local/lib/subsync"
CONF_DIR="$HOME/.config/subsync"
CONF_FILE="$CONF_DIR/config.json"
LOG_DIR="$HOME/Library/Logs"
PLIST="$HOME/Library/LaunchAgents/net.xhq.subsync.plist"
PYTHON="$(command -v python3 || echo /usr/bin/python3)"

mkdir -p "$LIB_DIR" "$CONF_DIR" "$LOG_DIR" "$(dirname "$PLIST")"
cp "$SRC_DIR/subsync.py" "$LIB_DIR/subsync.py"

if [[ ! -f "$CONF_FILE" ]]; then
    TOKEN="$("$PYTHON" -c 'import secrets; print(secrets.token_hex(16))')"
    KEY="$("$PYTHON" -c 'import secrets; print(secrets.token_urlsafe(24))')"
    "$PYTHON" - "$CONF_FILE" "$TOKEN" "$KEY" "$SOURCE" "$BINDS_JSON" "$PORT" <<'PY'
import json, sys
path, token, key, source, binds, port = sys.argv[1:7]
json.dump({
    "bind": json.loads(binds),
    "port": int(port),
    "token": token,
    "key": key,
    "source": source,
    "cache_ttl": 300,
    "dns_ttl": 600,
    "timeout": 20,
}, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PY
    chmod 600 "$CONF_FILE"
    echo "已生成配置：$CONF_FILE"
else
    echo "配置已存在，保持不变：$CONF_FILE"
fi

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>net.xhq.subsync</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$LIB_DIR/subsync.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>SUBSYNC_CONFIG</key><string>$CONF_FILE</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>$LOG_DIR/subsync.log</string>
    <key>StandardErrorPath</key><string>$LOG_DIR/subsync.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/net.xhq.subsync" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST"
sleep 1

TOKEN="$("$PYTHON" -c "import json;print(json.load(open('$CONF_FILE'))['token'])")"
KEY="$("$PYTHON" -c "import json;print(json.load(open('$CONF_FILE'))['key'])")"
BIND_ADDR="$("$PYTHON" -c "import json;d=json.load(open('$CONF_FILE'))['bind'];print(", ".join(d) if isinstance(d,list) else d)")"
PORT_NUM="$("$PYTHON" -c "import json;print(json.load(open('$CONF_FILE'))['port'])")"

cat <<INFO

部署完成。

  监听地址: $BIND_ADDR:$PORT_NUM
  订阅地址: http://<上面任一地址>:$PORT_NUM/sub/$TOKEN
  请求头:   X-Sub-Key: $KEY
  健康检查: curl http://$BIND_ADDR:$PORT_NUM/healthz
  日志:     $LOG_DIR/subsync.log

手机端（v2rayNG）：订阅分组 → 编辑 → 链接填上面地址、请求头填 X-Sub-Key: <key>、
打开「允许不安全 URL」（因为用的是 http）。

自检: curl -H "X-Sub-Key: $KEY" http://$BIND_ADDR:$PORT_NUM/sub/$TOKEN | head -c 80
INFO
