---
name: capability-manager
description: 维护 Claude Code 智能体团队的通用能力底座，是 Prometheus（通用能力管家）的操作手册。覆盖全局 ~/.claude/ 下 skills / rules / CLAUDE.md 三部分的增删改，全局权威源 ~/.claude/ ↔ 本项目开源镜像 claude/ ↔ 各 agent 项目副本 .claude/ 的跨项目同步与一致性核对，以及团队智能体注册表维护与新 agent 项目脚手架。当用户要求：新增 / 修改 / 下线某个全局 skill 或 rule、改全局 CLAUDE.md 或 settings.json、把某个通用能力同步到本项目镜像或分发到各 agent 项目、核对全局与镜像或项目副本是否一致（diff）、给团队注册表新增或调整 agent、搭新 agent 项目脚手架，或任何涉及「~/.claude 通用能力维护 / 跨项目同步 / 团队注册表」的工作时，都必须用本 skill——即便用户没明说「capability-manager」，只要意图落在上述场景即触发。触发后按对应场景执行流程、跑通用护栏（全局权威优先落地、敏感信息禁写、暂存区禁 AI 增删改、diff 验证逐字节一致、记本项目 CHANGELOG）。
---

# Capability Manager（Prometheus 的操作手册）

本 skill 是 **Prometheus（通用能力管家）** 的操作手册。当用户要维护整个 Claude Code 智能体团队共享的「通用能力底座」时，按场景给出可执行的步骤、护栏与命令模板。

> **本 skill 自身的位置（特殊定位）**：capability-manager 是 Prometheus（本项目 agent）的**项目级专属 skill**，放在本项目 `.claude/skills/` 下，**不进通用能力同步体系**——它管理通用能力，但自己不是通用 skill（不属于下文「三部分」同步对象）。这是它与 anysearch / find-skill 等通用 skill 的区别。

## 核心定位：全局权威 + 两路流出

通用能力底座以**全局 `~/.claude/` 为唯一权威源**，向下流出两路：

```
                  全局 ~/.claude/（唯一权威源；所有项目运行时都加载它）
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
   本项目 claude/（开源镜像）       各 agent 项目 .claude/（项目副本）
   （把全局开源出去的快照）         （各 agent 运行时加载自己这份）
```

- **全局 `~/.claude/` 是权威源**：所有项目运行时实际加载的中心，是「活」的源头。改动从这里开始。
- **本项目 `claude/`（不带点）是开源镜像**：把全局内容开源出去的快照。因目录名不是 `.claude`，Claude Code 不自动加载它；它纯粹用于开源。与全局逐字节一致（三部分：skills / rules / CLAUDE.md）。
- **各 agent 项目的 `.claude/` 是项目副本**：各 agent 运行时加载自己项目里的 `.claude/`，内容从全局分发而来。

**权威方向单向流出**：改动先在全局落地 → 同步到本项目 `claude/` 镜像 + 分发到各 agent 项目副本。**绝不能反过来只改镜像或副本**——那样会与权威源分叉。全局 `~/.claude/CLAUDE.md`「底层通用能力开源」节有完整说明。

**同步范围（三部分）**：`skills/`（通用 skill）、`rules/`、`CLAUDE.md`——这三部分在全局是权威、本项目 `claude/` 是镜像、逐字节一致。**不含**：`commands/`（各处自行管理，不进同步）、项目级专属 skill（如本 capability-manager、各 agent 的 trade / vend 等专属 skill）、`settings.json`（全局维护，但不进开源镜像）。

### 与 CLAUDE.md 的分工（为什么需要这个 skill）

全局 `~/.claude/CLAUDE.md`（与本项目 `claude/CLAUDE.md` 逐字节相同）已经把**规则**写全了——权威方向、逐字节一致、敏感信息禁写、暂存区禁 AI 增删改、CHANGELOG 纪律……这些是 S 级、每次会话都在场的硬规矩。本 skill **不重复这些规则**，而是把它们按「用户现在要做什么」重新编排成**可执行的流程**（步骤顺序、检查清单、命令模板）。换句话说：CLAUDE.md 管「规则与约束」，本 skill 管「按场景怎么做」。遇到规则细节，本 skill 会指向 CLAUDE.md 的具体章节，而不复述。

## 通用护栏（所有场景都要跑）

无论做下面哪个场景，每次都要套这一组护栏。它们大多对应 CLAUDE.md 里始终在场的硬规则，这里只列要点与命令，原因见 CLAUDE.md 对应章节。

- **先落全局、再镜像 claude/**：任何内容改动先在全局 `~/.claude/` 改，确认无误后用 `cp` 覆盖到本项目 `claude/` 对应位置。绝不在镜像或项目副本里直接改。（CLAUDE.md「底层通用能力开源」节）
- **敏感信息禁写**：往任何会被 git 跟踪的文件里写内容前，先判断是否含密钥 / 账户号 / token 等；有则用占位符，真实值只写进 `.gitignore` 忽略的本机文件。（CLAUDE.md「敏感信息禁止写入」节）
- **暂存区禁 AI 增删改**：本 skill **绝不执行** `git add` / `git rm --cached` / `git reset HEAD` / `git mv` 等任何会动暂存区的命令。改完的内容留给用户自己 `git add`，提交走 `/commit`。（CLAUDE.md「Git 暂存区禁止 AI 自主增删改」节）
- **diff 验证一致性**：内容改动同步到镜像后，跑 `diff -r ~/.claude/<部分> claude/<部分>` 确认逐字节一致（被 `.gitignore` 隔离的敏感文件是唯一允许的差异）。不一致就说明同步没做对，必须修到一致。（CLAUDE.md「底层通用能力开源」节「怎么验证」）
- **记本项目的 CHANGELOG**：每一次文件增删改都在本项目根 `CHANGELOG.md` 记一条，写清「为什么改 + 改了什么」。同步这件事本身也只记本项目的 CHANGELOG，不记各业务项目的。（CLAUDE.md「CHANGELOG 记录纪律」节 +「同步动作只记本项目的 CHANGELOG」）
- **TODO 闭环**：改完查项目根 `TODO.md`，若改动对应某条待办，按规则标记（`✅**已完成**` / `✅**已更新**`）并补时间戳，不删原条目。

这组护栏是底线，下面三个场景的具体流程都默认你已经套上了它们。

---

## 场景 A：改通用能力内容

**触发**：新增、修改、下线某个全局 skill / rule / CLAUDE.md。（`settings.json` 也归 Prometheus 维护，但只改全局、不进开源镜像。）

**核心步骤**：

1. **定位改什么、为什么**：先确认是哪类内容（skill / rule / CLAUDE.md 元规范 / settings.json），改的触发原因是什么——这一条会写进 CHANGELOG 的「为什么改」。
2. **在全局 `~/.claude/` 改**：改 `~/.claude/skills/`、`~/.claude/rules/`、`~/.claude/CLAUDE.md`（或 `~/.claude/settings.json`）对应文件。
   - 若是**改 skill 内容**（SKILL.md 正文 / description / references 结构），先读 skill-creator 方法论（`~/.claude/skills/skill-creator/`）再动手——这是 CLAUDE.md「写 skill 内容须依据 skill-creator」的硬要求。
   - 若是**新增 / 下线一整个 skill**，涉及多位置联动（镜像、分发、注册表、README），完整流程见 [`references/content-lifecycle.md`](references/content-lifecycle.md)。
3. **镜像到本项目 `claude/`**（仅三部分：skills / rules / CLAUDE.md）：`cp` 覆盖 `claude/` 对应文件。settings.json 不镜像。
4. **diff 验证**：`diff -r` 确认全局与镜像逐字节一致。
5. **记 CHANGELOG + TODO 闭环**。

详见 [`references/content-lifecycle.md`](references/content-lifecycle.md)（含新增 / 下线 skill 的全链路、改 CLAUDE.md 元规范的注意点）。

---

## 场景 B：同步与一致性核对

**触发**：把通用能力同步到本项目镜像或分发到各 agent 项目；或核对全局 / 镜像 / 项目副本是否一致。

**核心步骤**：

1. **判断同步方向**：分三种情形——
   - **全局 → 本项目 `claude/` 镜像**（最常见）：全局改好了，同步到开源镜像。逐部分 `cp` 覆盖。
   - **全局 → 各 agent 项目副本**：某个通用 skill 改完已落全局，分发到各 agent 项目的 `.claude/`。
   - **本项目 `claude/` → 全局**（反向对齐）：若镜像被临时直接改过、领先于全局，把镜像覆盖回全局一次性对齐，之后继续全局优先。
2. **执行同步**：用 `cp` 覆盖目标位置（命令模板与各 agent 项目的定位方法见 [`references/sync-flow.md`](references/sync-flow.md)）。
3. **diff 验证**：
   - 全局 vs 本项目镜像：`diff -r ~/.claude/<部分> ~/Documents/Projects/CapabilityManagerAgent/claude/<部分>`。
   - 全局 vs 某项目副本：`diff -r ~/.claude/skills/<skill> <项目路径>/.claude/skills/<skill>`。
4. **处理差异**：diff 报差异 → 判断是「同步没做对」还是「合法差异」（如 find-skill 的 `.env` / `cache/` 是本机数据、被 `.gitignore` 隔离）。前者修到一致，后者保留。
5. **记 CHANGELOG**：同步动作只记本项目 CHANGELOG。

详见 [`references/sync-flow.md`](references/sync-flow.md)（含三部分同步的完整命令、各 agent 项目副本的定位、合法差异清单、一致性巡检脚本）。

---

## 场景 C：团队扩展（注册表 + 脚手架）

**触发**：给团队注册表新增 / 调整 agent；搭一个新 agent 项目脚手架。

**核心步骤**：

1. **新增 agent（起名 + 入表）**：
   - 拟人名先查全局 `~/.claude/CLAUDE.md` 的「智能体命名注册表」**查重**，全局不可重复；名字要蕴含该 agent 的主要能力（双关优先）。
   - 把「拟人名 + 项目 + 职称 + 职责」追加进注册表（**只追加新行、不改已有行**），并在「销售流水线顺序」段补位置说明。这步**免确认**（CLAUDE.md「新建带拟人名的 Agent 时自动维护注册表」节）。
2. **搭新项目脚手架**：从已有 agent 项目复制，再按角色改写——目录名 `XxxAgent`、复制通用 skills / rules / settings、写角色化 CLAUDE.md + 双语 README（含 logo + 徽章 + 拟人名）、配 `.gitignore`。完整清单见 [`references/registry-and-scaffolding.md`](references/registry-and-scaffolding.md)。
3. **本地 `git init`**（免确认），不建远程、不 push。开源到 GitHub、提交、发版分别由用户触发（走对应流程或 `/commit`、`/release`）。
4. **注册表在全局 CLAUDE.md → 改全局、再镜像 `claude/`**：注册表改动先落全局 `~/.claude/CLAUDE.md`，再 cp 覆盖本项目 `claude/CLAUDE.md`，diff 验证一致。

详见 [`references/registry-and-scaffolding.md`](references/registry-and-scaffolding.md)（含起名查重流程、注册表追加格式、新项目脚手架逐项清单、开源到 GitHub 的步骤）。

---

## 何时激活

只要用户的意图落在下面任一场景，就激活本 skill（即便没明说「capability-manager」）：

- 「更新 / 修改某个全局 skill 或 rule」「给 xx skill 加个功能」
- 「改全局 CLAUDE.md 里某条规则」「改全局 settings.json」
- 「新增一个通用 skill」「下线 / 删除某个 skill」
- 「把 xx 同步到本项目镜像 / 同步到各 agent 项目」
- 「检查全局和镜像 / 项目副本是不是一致」「同步一下」
- 「新建一个 agent」「给团队加个成员」「起个 agent 名字」
- 「搭个新 agent 项目脚手架」

**不激活**的边界：单个业务项目内部的功能开发（那是各 agent 自己的职责）；VSCode 扩展补丁（归 Tinker / PatchClaudeAgent）；git 提交 / 发布（走 `/commit`、`/release`）。

## 汇报

每次完成一个场景后，报告：改了什么（哪些文件 / 哪个 skill / 注册表哪一行）、为什么（触发原因）、同步到了哪些位置（本项目 `claude/` 镜像 / 哪些 agent 项目副本）、diff 验证结果（一致 / 有哪些合法差异）、CHANGELOG 是否已记、是否触及 TODO 待办；若有需要用户自行 `git add` + `/commit` 的内容，明确提示（本 skill 不动暂存区、不提交）。
