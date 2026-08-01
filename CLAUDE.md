# CapabilityManagerAgent

本项目的通用能力主体（`skills` / `rules` / `commands` / `CLAUDE.md`）位于 `.claude/`，与全局 `~/.claude/` 对应部分逐字节一致，是整个 Claude Code 智能体舰队的通用能力底座权威源。项目根本目录的这个 `CLAUDE.md` **不承载通用能力内容**（避免与 `.claude/CLAUDE.md` 重复或冲突、也不参与「全局 ↔ 本项目四部分逐字节一致」的核对），仅作为 commit skill 的检测缓存载体，记录项目标配检测的就绪状态，供后续 `/commit` 跳过重复检测。

## commit skill 检测缓存

<!-- commit-skill: readme-standard = ok -->
- README 中英双语 + LOGO + 徽章 + 版权署名：已就绪（2026-07-31 确认）

<!-- commit-skill: license = ok -->
- LICENSE.md：已存在（2026-07-31 确认）

<!-- commit-skill: github-about = ok -->
- GitHub About：已配置（英文 description + topics，2026-07-31）

<!-- commit-skill: agent-persona = ok -->
- Agent 拟人名：已写入 README（Prometheus，2026-07-31）

<!-- commit-skill: attribution-name = ok -->
- 版权人/署名引用名字：已归一为 All Contributors（2026-07-31 确认）

<!-- commit-skill: readme-link-text = ok -->
- 英文版 README 跳转中文版链接文字：已统一为「简体中文」（2026-07-31 确认）

<!-- commit-skill: repo-sponsors = ok -->
- 仓库 Sponsors 按钮：已就绪（xhqing/.github 全局默认 FUNDING.yml，2026-07-31 确认）
