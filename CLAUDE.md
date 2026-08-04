# CapabilityManagerAgent

本项目的通用能力主体（`skills` / `rules` / `CLAUDE.md` 三部分）位于 `claude/`，是全局 `~/.claude/`（权威源）的**开源镜像**（2026-08-04 起权威方向反转：全局为权威、本项目 `claude/` 为镜像），与全局逐字节一致。项目根本目录的这个 `CLAUDE.md` **不承载通用能力内容**（避免与 `claude/CLAUDE.md` 重复或冲突、也不参与「全局 ↔ 本项目镜像三部分逐字节一致」的核对），仅作为本项目的简要说明。`.claude/` 目录为本项目独有的项目级能力目录，放本项目特有、不随通用能力同步的内容（如 capability-manager skill——Prometheus 本项目的专属工具，详见 `claude/CLAUDE.md`「底层通用能力开源」节）。

commit skill 的检测缓存已独立到项目根 [`.commit-skill-cache.md`](.commit-skill-cache.md)（2026-08-03 起从本文件迁出），不再寄生在本 `CLAUDE.md` 里。
