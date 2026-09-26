# `.claude/` —— 本项目独有的项目级能力目录（2026-08-03 起）

本项目（CapabilityManagerAgent）的**通用能力权威源**位于仓库根 `claude/` 目录（不带点），与全局 `~/.claude/` 对应部分逐字节一致，负责「开源给全世界的通用能力」（skills / CLAUDE.md / docs / hooks / patch / pi 扩展六部分；hooks、patch、pi 扩展于 2026-09-25 纳入镜像）。

本 `.claude/` 目录**不参与通用能力同步**，专用于本项目**独有的项目级能力**——放本项目特有、不属于通用底座、不需要开源分发的内容（如本项目专属的 skill、项目级设置、本地配置等）。通用强制守卫 hook 的镜像在 `claude/hooks/`（来自全局 `~/.claude/hooks/`），自研辅助机制的镜像在 `claude/patch/`（来自全局 `~/.claude/patch/`，如 skill-custom 定制恢复器），pi 端工具强制扩展的镜像在 `pi/agent/extensions/`（来自全局 `~/.pi/agent/extensions/`），三者均与本目录无关。

注意：Claude Code 只从 `.claude/`（标准配置目录）自动加载项目级能力；`claude/` 不会被自动加载。本项目运行时实际使用的通用能力由全局 `~/.claude/` 镜像提供。

详见 [claude/CLAUDE.md](../claude/CLAUDE.md)「团队结构参考」节与 [claude/docs/capability-sync.md](../claude/docs/capability-sync.md)（镜像范围与同步流程的完整说明）。
