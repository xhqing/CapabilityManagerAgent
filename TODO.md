# TODO

活跃待办清单：只放**未完成**条目，处理完的移入 `TODO-archive.md`（已放弃的也进归档、标 `✅**已放弃**` + 理由），超低频备忘放 `MEMO.md`。

条目格式：`- [ ] **T编号**` + 正文 + `（记录：YYYY-MM-DD HH:MM）`；编号项目内全局递增、永不复用（跨 `TODO.md` / `TODO-archive.md` / `MEMO.md` 共用）。正文改写时同步更新时间戳；前后矛盾的条目以最新时间戳为准。

紧急度分四级，颜色只标在 `##` 分节标题上：🔴 不修会直接亏钱 / 下错单 / 安全事故 / 数据或统计结论错误 / 核心功能不可用 ＞ 🟠 边界情况出错 / 防护缺口 / 口径不一致可能演化为实际损失 ＞ 🟡 文档措辞 / 格式漂移 / 卫生问题 / 不影响正确性的优化 ＞ 🟢 计划类新功能（改期无实际损失）。

## 🟠 橙色（边界情况出错、防护缺口、口径不一致可能演化为实际损失）

- [ ] **T1** capability-manager 的 `.claude/skills/capability-manager/references/sync-flow.md` 有两处与现状不符，需定口径后一并修正：① 举例仍用**已下线**的 `find-skill`——「同步情形 1」的例外说明（含 `ls ~/.claude/skills/find-skill/.env` 检查命令）与「合法差异表」两行都基于它，而全局 `~/.claude/skills/` 已无该 skill（2026-09 的 delete some skills 提交下线）；现存的合法差异是四项：anysearch `.env`、backup `endpoints.json`、scroll-reverser `local/config.md`、skill-creator `scripts/__pycache__`。②「同步情形 2：全局 → 各 agent 项目副本（分发）」与「一致性巡检：全局 vs 各项目（仅 anysearch / find-skill）」两节，与全局权威源 `~/.claude/docs/capability-sync.md`「单一出口模式下各 agent 项目不再分发副本、该分发层已终结」的口径相反——2026-09-25 实测各 agent 项目 `.claude/skills/` 只剩各自的专属 skill（trade / vend / patch-claude / quant / hot-trend / site-builder / byted-ark-* 等），确无通用 skill 副本；连带 SKILL.md「场景 B」的分发步骤、核心定位图里的「各 agent 项目 `.claude/`（项目副本）」枝叶也可能需要同步收口（注意区分：该分支与全局 CLAUDE.md「Agent 项目与子项目的 `.claude/` 超集关系」是两回事，后者仍有效）。（记录：2026-09-25 20:56）
