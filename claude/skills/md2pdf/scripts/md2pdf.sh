#!/bin/bash
# md2pdf.sh — Markdown → PDF 一条龙：pandoc 转 HTML（注入 CSS）→ Chrome headless 打印
# 用法：md2pdf.sh <输入.md> <输出.pdf> [自定义.css]
# 依赖：pandoc、Google Chrome（macOS 标准路径；Linux 下探测 google-chrome / chromium）

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_CSS="$SKILL_DIR/assets/default.css"

if [ $# -lt 2 ]; then
  echo "用法：$0 <输入.md> <输出.pdf> [自定义.css]" >&2
  exit 1
fi

IN_MD="$1"
OUT_PDF="$2"
CSS="${3:-$DEFAULT_CSS}"

[ -f "$IN_MD" ] || { echo "错误：输入文件不存在：$IN_MD" >&2; exit 1; }
[ -f "$CSS" ] || { echo "错误：CSS 不存在：$CSS" >&2; exit 1; }
command -v pandoc >/dev/null || { echo "错误：缺少 pandoc（brew install pandoc）" >&2; exit 1; }

# Chrome 探测（macOS / Linux）
if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif command -v google-chrome >/dev/null 2>&1; then
  CHROME="google-chrome"
elif command -v chromium >/dev/null 2>&1; then
  CHROME="chromium"
else
  echo "错误：找不到 Chrome / Chromium" >&2
  exit 1
fi

# 中间 HTML 与输出 PDF 都转绝对路径——Chrome 打印必须用真实存在的 file:// 绝对路径，
# 路径不存在时 Chrome 不报错、会把 ERR_FILE_NOT_FOUND 错误页打印成「无内容 PDF」
IN_MD_ABS="$(cd "$(dirname "$IN_MD")" && pwd)/$(basename "$IN_MD")"
OUT_PDF_ABS="$(cd "$(dirname "$OUT_PDF")" && pwd)/$(basename "$OUT_PDF")"
HTML_ABS="${OUT_PDF_ABS%.pdf}.html"

# CSS 里的覆盖块（body { margin:0; max-width:none; padding:0 }）必须在 pandoc 默认样式之后。
# 注意：pandoc --include-in-header 对文件是裸文本插入、不会自动包 <style> 标签，
# 必须先包好标签再注入——注入位置恰在 pandoc 默认 <style> 之后，同名规则后者胜
CSS_WRAPPED="$(mktemp -t md2pdf).html"
{
  echo '<style>'
  cat "$CSS"
  echo '</style>'
} > "$CSS_WRAPPED"
trap 'rm -f "$CSS_WRAPPED" "$HTML_ABS"' EXIT

pandoc -s "$IN_MD_ABS" --metadata title="$(basename "$IN_MD" .md)" \
  --include-in-header="$CSS_WRAPPED" -o "$HTML_ABS"

# CVDisplayLink 报错是 macOS headless Chrome 的无害噪音，只看 PDF 是否产出
"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$OUT_PDF_ABS" "file://$HTML_ABS" 2>/dev/null

[ -s "$OUT_PDF_ABS" ] || { echo "错误：Chrome 未产出 PDF：$OUT_PDF_ABS" >&2; exit 1; }

echo "已生成：${OUT_PDF_ABS}（$(du -h "$OUT_PDF_ABS" | cut -f1)）"
echo "下一步（必做）：swift $SKILL_DIR/scripts/verify_pdf.swift \"$OUT_PDF_ABS\""
