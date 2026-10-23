# `.claude/` —— 本项目独有的项目级能力目录（2026-08-03 起）

本项目（CapabilityManagerAgent）的**通用能力权威源**位于仓库根 `pi/agent/` 目录（不带点），与全局 `~/.pi/agent/` 对应部分逐字节一致，负责「开源给全世界的通用能力」（skills / CLAUDE.md / docs / patch / extensions 五部分 + npm 清单；patch、extensions 于 2026-09-25 纳入镜像；hooks 为 Claude Code 时代遗留、2026-10-22 随 claude/ 目录删除）。

本 `.claude/` 目录**不参与通用能力同步**，专用于本项目**独有的项目级能力**——放本项目特有、不属于通用底座、不需要开源分发的内容（如本项目专属的 skill、项目级设置、本地配置等）。自研辅助机制的镜像在 `pi/agent/patch/`（来自全局 `~/.pi/agent/patch/`，如 skill-custom 定制恢复器），pi 端工具强制扩展的镜像在 `pi/agent/extensions/`（来自全局 `~/.pi/agent/extensions/`），两者均与本目录无关。

注意：Claude Code 只从 `.claude/`（标准配置目录）自动加载项目级能力；`pi/agent/` 不会被自动加载。本项目运行时实际使用的通用能力由全局 `~/.pi/agent/` 镜像提供。

详见 [pi/agent/CLAUDE.md](../pi/agent/CLAUDE.md)「团队结构参考」节与 [pi/agent/docs/capability-sync.md](../pi/agent/docs/capability-sync.md)（镜像范围与同步流程的完整说明）。
