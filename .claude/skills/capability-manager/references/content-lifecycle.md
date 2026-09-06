# 改通用能力内容（场景 A 详细流程）

本文件是 SKILL.md「场景 A」的详细展开。覆盖新增 / 修改 / 下线全局 skill、rule、CLAUDE.md 元规范的全链路步骤（`settings.json` 只改全局、不镜像）。重点讲清「一个改动会牵动哪些位置」，避免漏同步。

## 通用原则：一个内容改动牵动哪些位置

通用能力三部分（skills / rules / CLAUDE.md）改动后，至少要同步**两个位置**（全局权威 + 本项目镜像），**通用 skill 还要分发到各 agent 项目副本**。判断矩阵：

| 改的内容 | 全局 `~/.claude/`（权威） | 本项目 `claude/`（镜像） | 各 agent 项目 `.claude/` |
|---|---|---|---|
| CLAUDE.md 元规范 | ✅ 改 | ✅ 镜像 | ❌（各项目有自己的 CLAUDE.md，不通用） |
| rules/ | ✅ 改 | ✅ 镜像 | ❌（rules 随 CLAUDE.md @ 引用，不单独分发） |
| 全团队通用 skill | ✅ 改 | ✅ 镜像 | ✅ 分发（anysearch / find-skill 等） |
| 特定 agent 专属 skill | ❌（不进全局） | ❌（不进镜像） | 只放该项目的 `.claude/skills/`（capability-manager / trade 等） |
| `settings.json` | ✅ 改 | ❌ 不镜像 | ❌ |
| `commands/` | ✅ 改 | ❌ 不镜像 | 视命令通用性 |

**三部分之外**（`settings.json`、`commands/`）只在全局 `~/.claude/` 维护、**不进本项目 `claude/` 镜像**——它们不是开源同步对象。改全局 `settings.json` / `commands/` 时，直接改全局、记 CHANGELOG，不涉及 `claude/` 镜像、不跑 diff。

下面把本项目根记作 `$AUTH`，即 `~/Documents/Projects/CapabilityManagerAgent`。

## 新增一个通用 skill（全链路）

1. **先读 skill-creator**：`~/.claude/skills/skill-creator/SKILL.md`。按它的 Capture Intent → Interview → Write SKILL.md 流程来，遵循 Progressive Disclosure（frontmatter name + pushy description；SKILL.md 正文 <500 行；详情拆 references）。这是 CLAUDE.md「写 skill 内容须依据 skill-creator」的硬要求，**不能凭感觉写**。
2. **在全局落地**：创建 `~/.claude/skills/<skill名>/SKILL.md`（及 references / scripts 等子目录）。
3. **判断是否分发**：
   - 全团队通用的基础能力（搜索、提交、发布、图标等）→ 要分发到各 agent 项目。
   - 仅 Prometheus / 某单个 agent 用的专属能力 → 不分发，放该项目的 `.claude/skills/`、不进全局。
4. **镜像到本项目 `claude/`**：`cp -R ~/.claude/skills/<skill名> "$AUTH/claude/skills/"`。
5. **分发到各项目**（仅通用 skill）：见 [`sync-flow.md`](sync-flow.md)「同步情形 2」。
6. **diff 验证**：`diff -r ~/.claude/skills/<skill名> "$AUTH/claude/skills/<skill名>"`。
7. **记 CHANGELOG**（本项目的）：写清「为什么新增这个 skill + 它做什么 + 同步到了哪些位置」。
8. **README 是否要改**：若新增的是本项目的核心 skill（像 capability-manager），README 可能要提它——检查 README 是否已引用、链接是否指向真实路径。

## 下线一个通用 skill（全链路）

1. **确认无依赖**：grep 各项目与全局，确认没有其它 skill / CLAUDE.md / README 还在引用它。
2. **从全局删**：`~/.claude/skills/<skill名>/`。
3. **从本项目镜像删**：`"$AUTH/claude/skills/<skill名>/"`。
4. **从各项目副本删**（若是通用 skill）：逐个项目删 `.claude/skills/<skill名>/`。
5. **清理引用**：CLAUDE.md / 各项目 CLAUDE.md / README 里对该 skill 的引用全部移除。
6. **diff 验证**：确认全局与镜像都不再含该 skill。
7. **记 CHANGELOG**：写清「为什么下线 + 清理了哪些位置」。

> 注意：删除文件按 CLAUDE.md「文件操作优先级规则」要谨慎——下线 skill 属「明确需要移除」的情形，可以删，但要先把依赖、引用清理干净，并留好 CHANGELOG 记录以便回溯。

## 修改已有 skill 内容

1. **先读 skill-creator**（即便是小改动，涉及结构调整 / 新增章节 / 重写 description 这类「内容性改动」都要以 skill-creator 为准；只改一两个错别字可免）。
2. **在全局改** `~/.claude/skills/<skill>/`。
3. **镜像本项目 `claude/` + 分发项目**（同新增）。
4. **diff 验证 + 记 CHANGELOG**。

## 改 rules/（新增 / 修改 / 删除 rule 文件）

关键约束：**rules 文件必须在 CLAUDE.md 中 `@` 引用才会被加载**（CLAUDE.md「rules 文件必须在 CLAUDE.md 中 @ 引用」节）。

- **新增 rule**：① 在 `~/.claude/rules/` 建 `<rule>.md`；② **同步在 `~/.claude/CLAUDE.md` 加一行 `@rules/<rule>.md` + 一句话摘要**（否则等于白写，不会被加载）；③ 镜像到本项目 `claude/`（rule 文件 + 改动后的 CLAUDE.md 都要 cp）；④ diff 验证。
- **删除 rule**：① 删 `~/.claude/rules/<rule>.md`；② **同步去掉 CLAUDE.md 里对应的 `@` 引用**（否则成 dangling 引用）；③ 镜像 `claude/`；④ diff 验证。
- **修改 rule 内容**：直接改全局，镜像 `claude/`，diff 验证。

## 改 CLAUDE.md（元规范）

CLAUDE.md 是 S 级、每次会话都在场的元规范。改它要格外慎重：

1. **在全局改** `~/.claude/CLAUDE.md`。
2. **检查改动是否影响其它文件**：例如改了「智能体命名注册表」可能要同步各项目 README；改了「脚手架约定」可能影响后续新建项目。按 CLAUDE.md「CHANGELOG 记录纪律」的「溯源与防回归」要求——回溯历史条目、评估回归风险、有风险就提醒用户。
3. **镜像本项目 `claude/`**：`cp ~/.claude/CLAUDE.md "$AUTH/claude/CLAUDE.md"`。
4. **diff 验证**：`diff ~/.claude/CLAUDE.md "$AUTH/claude/CLAUDE.md"`。
5. **记 CHANGELOG**：元规范改动尤其要写清「为什么改 + 边界变化」，方便日后判断后续改动是否破坏这次调整。

## 改 settings.json / commands/

这两部分**不在三部分同步范围**，只在全局 `~/.claude/` 维护、不进本项目 `claude/` 镜像：

1. 直接改全局 `~/.claude/settings.json` 或 `~/.claude/commands/`。
2. 记 CHANGELOG。
3. 不涉及 `claude/` 镜像、不跑 diff（它们本就不镜像）。
