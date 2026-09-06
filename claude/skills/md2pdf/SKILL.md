---
name: md2pdf
description: Markdown 转 PDF 一条龙（pandoc 转 HTML + Chrome headless 打印 + 像素级排版定量验证）。当用户要把 md / markdown 文档转成 PDF、导出 PDF、生成 PDF 交付版（个人文档、报告、说明书、标书、笔记等，尤其中文文档），或 PDF 出现「内容只占半页 / 右半边空白 / 窄栏 / 页数虚多 / 打开无内容」等排版问题需要修复或验证时，必须使用本 skill。
---

# MD → PDF 一条龙

把 Markdown 转成排版正确、经过定量验证的 PDF。核心工具链：**pandoc（MD→HTML）→ Chrome headless（打印 PDF）→ 像素级墨迹扫描（验证排版）**。

本 skill 的价值一半在转换、一半在验证——PDF 排版问题（窄栏、半页空白、错误页）肉眼和视觉模型都容易看走眼，必须用定量判据核对。

## 使用流程

### 第 1 步：转换

```bash
~/.claude/skills/md2pdf/scripts/md2pdf.sh 输入.md 输出.pdf [自定义.css]
```

- 不指定 CSS 时用内置 `assets/default.css`（A4、PingFang SC 中文紧凑排版，**已内置 pandoc 默认样式覆盖**——见下文坑 1）。
- 需要定制风格（字号、主题色、边距）时复制 default.css 改后作为第三个参数传入。
- 脚本内部：pandoc `-s --include-in-header` 注入 CSS（注入位置在 pandoc 默认样式**之后**，天然可覆盖）→ Chrome `--headless --no-pdf-header-footer --print-to-pdf` 打印，自动用 `file://` 绝对路径（防坑 2）。

### 第 2 步：定量验证（必做，不许跳过）

```bash
swift ~/.claude/skills/md2pdf/scripts/verify_pdf.swift 输出.pdf
```

输出每页的纸张尺寸（MediaBox）、墨迹左右边界百分比。逐条核对判据：

- ✅ **纸张正确**：A4 纵向 = 595×842 pt；612×792 = Letter（中文文档默认应 A4）
- ✅ **墨迹左右对称**：左右边界百分比应与 `@page` 边距对应（default.css 的 14mm 边距 → 左 6.7% / 右 93.3%），左右差值应在几个百分点内
- ✅ **无窄栏**：右边界若停在 80% 附近（居中窄栏）或 48% 附近（靠左窄栏）→ pandoc 默认样式没覆盖掉，见坑 1
- ✅ **页数合理**：与内容量匹配；窄栏会让行数翻倍、页数虚多一倍（2 页内容变 4 页是典型症状）
- ✅ **非错误页**：打开无内容 / 只有 1 页 / 体积异常小（几十 KB）→ 大概率是 Chrome 把错误提示页打成了 PDF，见坑 2

多页 PDF 若另外截图抽查：截图之间必须 md5 互异（曾发生两页校验图 md5 全同、校验实际失效的事故）。

### 第 3 步：交付

判据全部通过后再交付 / 覆盖目标文件。验证不过就回去改，**不要**靠「肉眼看一眼差不多」放行。

## 四大坑速查（实战踩过，详解见 references/pitfalls.md）

| # | 坑 | 典型症状 | 一句话修复 |
|---|---|---|---|
| 1 | pandoc 默认窄栏样式 | 内容只占左半边 / 居中窄书芯、页数虚多一倍 | CSS 显式写 `body { margin: 0; max-width: none; padding: 0 }` |
| 2 | Chrome 打印错误页 | PDF 打开无内容、1 页、几十 KB | 打印命令用真实存在的 `file://` 绝对路径，产出后核对页数 |
| 3 | 视觉模型验证不可靠 | 窄栏 / 半页空白被判「排版正常」（两次误判实录） | 一律用 verify_pdf.swift 的像素边界做定量判据 |
| 4 | 校验截图互相同一 | 逐页校验图 md5 全同，校验失效 | 截图后 `md5` 核对各页互异 |

## 工具链选型结论

- **pandoc + Chrome headless**：中文渲染紧凑专业（PingFang SC）、分页可控，本 skill 默认。
- **weasyprint**：同样 HTML 渲染页数明显偏多（中文排版松散）、安装依赖重，仅当无 Chrome 环境时考虑。
- 两者都要求先解决坑 1——pandoc 默认样式与浏览器默认样式都可能窄栏。

## references

- `references/pitfalls.md` — 四大坑的完整来龙去脉（症状截图判据、根因 CSS、防御写法）+ default.css 定制指南 + weasyprint 对比数据。改 CSS 或排查疑难时读。
