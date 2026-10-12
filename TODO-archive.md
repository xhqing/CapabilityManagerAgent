# TODO-archive

已处理的待办归档：从 `TODO.md` 移出的已完成 / 已更新 / 已放弃 / 已转移条目，正文一字不动、仅加处理标记与时间戳（编号保留、不复用）。条目格式与紧急度分级见 `TODO.md` 头部说明。

## 🟠 橙色（边界情况出错、防护缺口、口径不一致可能演化为实际损失）

- [x] **T1** capability-manager 的 `.claude/skills/capability-manager/references/sync-flow.md` 有两处与现状不符，需定口径后一并修正：① 举例仍用**已下线**的 `find-skill`——「同步情形 1」的例外说明（含 `ls ~/.claude/skills/find-skill/.env` 检查命令）与「合法差异表」两行都基于它，而全局 `~/.claude/skills/` 已无该 skill（2026-09 的 delete some skills 提交下线）；现存的合法差异是四项：anysearch `.env`、backup `endpoints.json`、scroll-reverser `local/config.md`、skill-creator `scripts/__pycache__`。②「同步情形 2：全局 → 各 agent 项目副本（分发）」与「一致性巡检：全局 vs 各项目（仅 anysearch / find-skill）」两节，与全局权威源 `~/.claude/docs/capability-sync.md`「单一出口模式下各 agent 项目不再分发副本、该分发层已终结」的口径相反——2026-09-25 实测各 agent 项目 `.claude/skills/` 只剩各自的专属 skill（trade / vend / patch-claude / quant / hot-trend / site-builder / byted-ark-* 等），确无通用 skill 副本；连带 SKILL.md「场景 B」的分发步骤、核心定位图里的「各 agent 项目 `.claude/`（项目副本）」枝叶也可能需要同步收口（注意区分：该分支与全局 CLAUDE.md「Agent 项目与子项目的 `.claude/` 超集关系」是两回事，后者仍有效）。（记录：2026-09-25 20:56）

  ✅**已完成**（完成：2026-10-12 22:27）：① find-skill 举例已由 v1.5.15 / v1.5.21 修复（改为「本机数据差异」通用表述，现行示例 backup/endpoints）；② 分发层表述已由 v1.5.15 对齐（「同步情形 2」改写为「已终结」、巡检去各项目块）；③ 连带 SKILL.md 场景 B 与核心定位图同批收口；④ 括号注「超集关系仍有效」的说法已由 2026-10-12「智能体专属文件归属」新规取代，sync-flow 相应两处于本批（v1.5.35）改写。
