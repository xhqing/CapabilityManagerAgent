# CapabilityManagerAgent

本项目的通用能力主体（`skills` / `CLAUDE.md` / `docs` / `hooks` / `patch` / pi 扩展六部分）位于 `claude/` 与 `pi/agent/extensions/`，是全局权威源（`~/.claude/` 前五部分、`~/.pi/agent/extensions/` 的 pi 扩展）的**开源镜像**（2026-08-04 起权威方向反转：全局为权威、本项目对应目录为镜像），与全局逐字节一致（原 `rules/` 已于 2026-09-12 并入 CLAUDE.md 后删除；`docs/` 于 2026-09-12 拆出参考文档后纳入镜像；`hooks/`、`patch/` 于 2026-09-25 纳入镜像，`patch/` 由 `local/` 改名而来；pi 扩展（`~/.pi/agent/extensions/` 的四个工具强制 `.ts`）于 2026-09-25 纳入镜像）。本文件（`.claude/CLAUDE.md`）**不承载通用能力内容**（避免与 `claude/CLAUDE.md` 重复或冲突、也不参与「全局 ↔ 本项目镜像六部分逐字节一致」的核对），仅作为本项目的简要说明。`.claude/` 目录为本项目独有的项目级能力目录，放本项目特有、不随通用能力同步的内容（如 capability-manager skill——Prometheus 本项目的专属工具，同步规则详见 `~/.claude/docs/capability-sync.md`）。

commit skill 的检测缓存已独立到项目根 [`.commit-cache.md`](.commit-cache.md)（2026-08-03 起从本文件迁出，2026-08-10 按文件命名规范简化文件名），不再寄生在本 `CLAUDE.md` 里。
