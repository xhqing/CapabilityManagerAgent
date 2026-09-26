description: >
  MUST USE when the user mentions a platform or shares a platform link:
  小红书/xiaohongshu/xhs, Twitter/推特/X, B站/bilibili, Reddit, Facebook,
  Instagram, V2EX, LinkedIn/领英/jobs, YouTube, GitHub code search, 小宇宙播客,
  雪球/股票行情, RSS feeds —— 需要从该平台取内容时（搜索 / 帖子 / 评论 / 字幕 /
  行情），比如「小红书上关于 X 的笔记」「推特上大家怎么评价 X」。

  15 platforms, multi-backend routing (OpenCLI / per-platform CLIs / APIs).
  Zero config for 6 channels. Run `agent-reach doctor --json` to see which
  backend serves each platform right now.

  【分工】通用网页搜索、垂直域检索（股票 / CVE / DOI 等）、批量搜索
  与网页正文提取优先用 anysearch skill（有 key、中文更强）；本 skill 的
  Exa / Jina Reader（search.md、web.md）仅作兜底；平台内数据（帖子 / 评论 / 字幕）仍走本 skill。

  NOT for: 写报告/数据分析/翻译等内容加工；发帖/评论/点赞等写操作；已有专门 skill 的平台。

  【路由方式】SKILL.md 包含路由表和常用命令，复杂场景需按需阅读对应分类的 references/*.md。
  分类：search / social (小红书/推特/B站/V2EX/Reddit/Facebook/Instagram) / career(LinkedIn) / dev(github) / web(网页/文章/RSS) / video(YouTube/B站/播客) / finance(雪球/股票)。
