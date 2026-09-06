// verify_pdf.swift — PDF 排版定量验证（零依赖，macOS 自带 Swift + Quartz）
// 用法：swift verify_pdf.swift <a.pdf> [b.pdf ...]
// 逐页输出：纸张尺寸判定 + 墨迹（非白像素）左右边界百分比，附窄栏 / 不对称警告。
// 判据（人核对，脚本给数据）：
//   - A4 纵向 = 595×842pt；612×792 = Letter（US）
//   - 满宽排版：左右墨迹边界应与 @page 边距对应且左右对称（如 14mm 边距 → 6.7% / 93.3%）
//   - 右边界停在 ~80%（居中窄栏）或 ~48%（靠左窄栏）= pandoc 默认样式未覆盖

import Quartz
import AppKit

func paperName(_ w: Int, _ h: Int) -> String {
    switch (w, h) {
    case (595, 842): return "A4 纵向"
    case (842, 595): return "A4 横向"
    case (612, 792): return "Letter 纵向"
    case (792, 612): return "Letter 横向"
    default: return "非标准尺寸"
    }
}

var hadWarning = false

for arg in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: arg)
    guard let doc = CGPDFDocument(url as CFURL) else {
        print("\(arg)：无法打开")
        continue
    }
    print("== \(url.lastPathComponent)：共 \(doc.numberOfPages) 页")
    for i in 1...doc.numberOfPages {
        guard let page = doc.page(at: i) else { continue }
        let box = page.getBoxRect(.mediaBox)
        let w = Int(box.width.rounded()), h = Int(box.height.rounded())
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue),
              let data = ctx.data else { continue }
        ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
        ctx.drawPDFPage(page)
        let buf = data.bindMemory(to: UInt8.self, capacity: w * h * 4)
        var leftmost = w, rightmost = 0
        for y in 0..<h {
            for x in 0..<w {
                let off = (y * w + x) * 4
                if buf[off] < 240 || buf[off + 1] < 240 || buf[off + 2] < 240 {
                    if x < leftmost { leftmost = x }
                    if x > rightmost { rightmost = x }
                }
            }
        }
        let lp = Double(leftmost) / Double(w) * 100
        let rp = Double(rightmost) / Double(w) * 100
        let rightGap = 100 - rp
        var warns = [String]()
        if rightmost == 0 {
            warns.append("❌ 本页无墨迹（空白页或错误页）")
            hadWarning = true
        } else {
            // 居中窄栏：左右留白均 >12% 且近似对称（pandoc 默认 36em 窄栏实测 14%/84% 形态）
            if lp > 12 && rightGap > 12 && abs(lp - rightGap) < 6 {
                warns.append("⚠️ 疑似居中窄栏（左留白 \(Int(lp))% / 右留白 \(Int(rightGap))%）——pandoc 默认样式未覆盖")
                hadWarning = true
            }
            // 靠左窄栏：右侧留白远大于左侧（实测案例 13%/48%）；末页短行也会命中，需对照前页与页数
            if rp < 60 {
                warns.append("⚠️ 右边界仅 \(Int(rp))%——疑似靠左窄栏，或末页短行（对照其它页判断）")
                hadWarning = true
            }
            if abs(lp - rightGap) > 15 {
                warns.append("⚠️ 左右边界明显不对称（左 \(Int(lp))% / 右 \(Int(rp))%）")
                hadWarning = true
            }
        }
        let flag = warns.isEmpty ? "✅" : warns.joined(separator: "；")
        print("  第\(i)页 \(w)×\(h)pt \(paperName(w, h))  墨迹 左\(Int(lp))% / 右\(Int(rp))%  \(flag)")
    }
}

exit(hadWarning ? 2 : 0)
