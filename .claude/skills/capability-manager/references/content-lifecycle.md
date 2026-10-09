# 改通用能力内容（场景 A 详细流程）

本文件是 SKILL.md「场景 A」的详细展开。覆盖新增 / 修改 / 下线全局 skill、CLAUDE.md 元规范的全链路步骤（`settings.json` 只改全局、不镜像）。重点讲清「一个改动会牵动哪些位置」，避免漏同步。

## 通用原则：一个内容改动牵动哪些位置

通用能力六部分（skills / CLAUDE.md / docs / hooks / patch / pi 扩展，全局规则随 CLAUDE.md 走）改动后，至少要同步**两个位置**（全局权威 + 本项目镜像；单一出口后不再向各 agent 项目分发副本）。判断矩阵：

| 改的内容 | 全局 `~/.claude/`（权威） | 本项目 `claude/`（镜像） | 各 agent 项目 `.claude/` |
|---|---|---|---|
| CLAUDE.md 元规范 | ✅ 改 | ✅ 镜像 | ❌（各项目有自己的 CLAUDE.md，不通用） |
| docs 参考文档（agents-registry / new-agent-scaffold / capability-sync） | ✅ 改 | ✅ 镜像 | ❌（各项目不装 docs 副本） |
| 全团队通用 skill | ✅ 改 | ✅ 镜像 | ❌（分发层已终结——单一出口，项目不留副本） |
| hooks 强制守卫脚本（pre-tool-use-guard.sh / test-cases-guard.py） | ✅ 改 | ✅ 镜像 | ❌（各项目不装，仅全局 settings.json 注册生效） |
| patch 自研辅助机制（patch/skill-custom/ 等） | ✅ 改 | ✅ 镜像 | ❌（属本机机制，各项目不装） |
| pi 端扩展（`~/.pi/agent/extensions/` 的工具强制 `.ts`） | ✅ 改 | ✅ 镜像（`pi/agent/extensions/`） | ❌（pi 用户级加载，各项目不装） |
| 特定 agent 专属 skill | ❌（不进全局） | ❌（不进镜像） | 只放该项目的 `.claude/skills/`（capability-manager / trade 等） |
| `settings.json` | ✅ 改 | ❌ 不镜像 | ❌ |
| `commands/` | ✅ 改 | ❌ 不镜像 | 视命令通用性 |

**六部分之外**（`settings.json`、`commands/`）只在全局 `~/.claude/` 维护、**不进本项目 `claude/` 镜像**——它们不是开源同步对象。改全局 `settings.json` / `commands/` 时，直接改全局、记 CHANGELOG，不涉及 `claude/` 镜像、不跑 diff。

下面把本项目根记作 `$AUTH`，即 `~/Developer/CapabilityManagerAgent`。

## 新增一个通用 skill（全链路）

1. **先读 skill-creator**：`~/.claude/skills/skill-creator/SKILL.md`。按它的 Capture Intent → Interview → Write SKILL.md 流程来，遵循 Progressive Disclosure（frontmatter name + pushy description；SKILL.md 正文 <500 行；详情拆 references）。这是 CLAUDE.md「写 skill 内容须依据 skill-creator」的硬要求，**不能凭感觉写**。
2. **在全局落地**：创建 `~/.claude/skills/<skill名>/SKILL.md`（及 references / scripts 等子目录）。
3. **判断归属**：全团队通用的基础能力（搜索、提交、发布、图标等）→ 进全局 + 镜像；仅 Prometheus / 某单个 agent 用的专属能力 → 不进全局、放该项目的 `.claude/skills/`（如 capability-manager）。
4. **镜像到本项目 `claude/`**：`cp -R ~/.claude/skills/<skill名> "$AUTH/claude/skills/"`。
5. **diff 验证**：`diff -r ~/.claude/skills/<skill名> "$AUTH/claude/skills/<skill名>"`。
6. **记 CHANGELOG**（本项目的）：写清「为什么新增这个 skill + 它做什么 + 同步到了哪些位置」。
7. **README 是否要改**：若新增的是本项目的核心 skill（像 capability-manager），README 可能要提它——检查 README 是否已引用、链接是否指向真实路径。

## 下线一个通用 skill（全链路）

1. **确认无依赖**：grep 各项目与全局，确认没有其它 skill / CLAUDE.md / README 还在引用它。
2. **从全局删**：`~/.claude/skills/<skill名>/`。
3. **从本项目镜像删**：`"$AUTH/claude/skills/<skill名>/"`。
4. **检查历史残留副本**：单一出口后各项目不应再有该 skill 副本；若个别项目仍有残留（历史遗留），一并清理。
5. **清理引用**：CLAUDE.md / 各项目 CLAUDE.md / README 里对该 skill 的引用全部移除。
6. **diff 验证**：确认全局与镜像都不再含该 skill。
7. **记 CHANGELOG**：写清「为什么下线 + 清理了哪些位置」。

> 注意：删除文件按 CLAUDE.md「文件操作优先级规则」要谨慎——下线 skill 属「明确需要移除」的情形，可以删，但要先把依赖、引用清理干净，并留好 CHANGELOG 记录以便回溯。

## 修改已有 skill 内容

1. **先读 skill-creator**（即便是小改动，涉及结构调整 / 新增章节 / 重写 description 这类「内容性改动」都要以 skill-creator 为准；只改一两个错别字可免）。
2. **在全局改** `~/.claude/skills/<skill>/`。
3. **镜像本项目 `claude/`**（同新增；不再分发项目）。
4. **diff 验证 + 记 CHANGELOG**。

## 改 CLAUDE.md（元规范）

CLAUDE.md 是 S 级、每次会话都在场的元规范。改它要格外慎重：

1. **在全局改** `~/.claude/CLAUDE.md`。
2. **检查改动是否影响其它文件**：例如改了命名规则要同步核对 `agents-registry.md` / `new-agent-scaffold.md` 的口径；改了脚手架约定会影响后续新建项目。按 CLAUDE.md「CHANGELOG 记录纪律」的「溯源与防回归」要求——回溯历史条目、评估回归风险、有风险就提醒用户。
3. **镜像本项目 `claude/`**：`cp ~/.claude/CLAUDE.md "$AUTH/claude/CLAUDE.md"`。
4. **diff 验证**：`diff ~/.claude/CLAUDE.md "$AUTH/claude/CLAUDE.md"`。
5. **记 CHANGELOG**：元规范改动尤其要写清「为什么改 + 边界变化」，方便日后判断后续改动是否破坏这次调整。

## 改 settings.json / commands/

这两者不在同步范围（skills / CLAUDE.md / docs / hooks / patch / pi 扩展）内，只在全局 `~/.claude/` 维护、不进本项目 `claude/` 镜像：

1. 直接改全局 `~/.claude/settings.json` 或 `~/.claude/commands/`。
2. 记 CHANGELOG。
3. 不涉及 `claude/` 镜像、不跑 diff（它们本就不镜像）。
