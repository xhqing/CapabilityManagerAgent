6. **通用检索走 anysearch**：通用网页搜索、垂直域结构化检索（股票 / CVE / DOI 等）、
   批量并行搜索与网页正文提取，优先用本机已装的 anysearch skill（有 API key、
   中文内容更强、实测可用）；本 skill 的 Exa（search.md）与 Jina Reader（web.md）
   只在 anysearch 不可用时兜底。平台内数据（帖子 / 评论 / 详情 / 字幕）仍走本 skill。
