<div align="center">
  <img src="assets/logo.svg" width="640" alt="CapabilityManagerAgent">
</div>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Type](https://img.shields.io/badge/Type-AI%20Agent-FF1493.svg)](#)
[![Domain](https://img.shields.io/badge/Domain-%7E%2F.claude-F97316.svg)](#)

</div>

# CapabilityManagerAgent

> 🔥 **Prometheus（普罗米修斯）**——守护整个 Claude Code 智能体舰队「通用能力底座」的能力管家。当某个全局 skill、rule 或配置发生变化时，Prometheus 把变化同步到每一个项目副本，让整个舰队保持一致。

[English](README.md)

CapabilityManagerAgent 管理的是 Claude Code 智能体舰队的**通用能力底座**：用户级 `~/.claude/` 目录下那些**不专属于某一个 agent、而是所有 agent 共用**的内容——全局 skill、全局 rule、`settings.json`、slash 命令——外加让每个 agent 项目的 `.claude/` 副本与全局权威副本保持一致的跨项目同步工作。

> 这**不是**传统意义上的软件项目，没有需要 `npm install` 的应用。仓库本身就是 agent：它的全部行为由 `.claude/` 下的 `skills` 与 `rules` 塑造，Claude Code 把它们加载为 Prometheus 的执行纪律。

---

## Prometheus 是谁？

这个 agent 的人格是 **Prometheus（普罗米修斯）**——舰队的能力管家。别的 agent 负责交易、生产或营销，Prometheus 守护的是它们共同立足的**共享底座**：`~/.claude/` 下的全局 skill、rule 与配置。

名字 **Prometheus**（「盗火者」）正贴合这个角色：守护那团让每个 agent 得以运转的「通用能力之火」。它的优势不在某个领域的专长，而在**一致与谨慎**：

- **全局为权威。** 全局 `~/.claude/` 副本是事实来源，项目副本只是镜像。
- **经中枢同步。** 某个项目副本的改动先回流到全局，再扩散到其它项目——不直接项目对项目。
- **动底座前先备份。** `~/.claude/` 下的任何改动都影响整个舰队，编辑前先备份、先确认。

---

## Prometheus 管什么

| 位置 | 内容 |
|---|---|
| `~/.claude/skills/` | 全局通用 skill（anysearch、commit、find-skill、image-ocr、release 等） |
| `~/.claude/rules/` | 全局通用工作规范（file-operation-priority、tmp-dir、verify-before-report） |
| `~/.claude/settings.json` | 全局配置（env、availableModels、effortLevel、theme、hooks） |
| `~/.claude/commands/` | 全局 slash 命令 |
| `~/.claude/CLAUDE.md` | 全局偏好 + fleet 注册表 + 脚手架约定（元规范） |

**不在管辖范围**（归别处，Prometheus 不碰）：各 agent 的领域 skill 与业务配置；VSCode 扩展补丁（归 Tinker / PatchClaudeAgent）。

---

## 核心工作：全局 ↔ 项目副本同步

每个通用 skill / rule 在 `~/.claude/` 放一份（**权威副本**），又在每个 agent 项目的 `.claude/` 里放一份（**项目副本**）——这样 clone 一个项目就得到一个自包含的 agent。Prometheus 的主要工作，就是在它们之间传递变化。

目前已有两条同步规则成文（来自全局 `~/.claude/CLAUDE.md`）：

- **anysearch**——全局为权威；核心内容在各副本间保持一致；唯一例外是 `runtime.conf` 的 `Command` 路径（全局用绝对路径，项目副本用项目相对路径以便移植）。
- **find-skill**——全局为权威；核心文件逐字节相同（无路径例外）；`.env` 与 `cache/` 是本机数据，永不同步。

完整的操作步骤、护栏，以及 fleet 注册表的维护流程，都在 skill 里：[`.claude/skills/capability-manager/SKILL.md`](.claude/skills/capability-manager/SKILL.md)。

---

## 何时激活

当用户要求**维护或更新某个全局 skill / rule、修改全局 `settings.json` 或 `CLAUDE.md`、新增或下线一个通用 skill、把某个通用 skill 同步到各 agent 项目、统一各项目脚手架、或给 fleet 注册表新增 agent** 时，Claude Code 激活 Prometheus。激活后加载 `capability-manager` skill 并执行其护栏。

---

## 在舰队中的位置

| Agent | 职责 |
|---|---|
| **Prometheus**（本项目） | 通用能力底座 + 跨项目同步 + fleet 注册表 |
| Tinker（PatchClaudeAgent） | VSCode Claude Code 扩展的自愈补丁 |

Prometheus 独立于销售流水线（Scout → Wright → Buzz → Vendy → Echo），它服务于整个舰队的共享底座。

---

## 许可与署名

版权所有 (c) 2026 Huaqing Xu, Contributors。基于 [MIT License](LICENSE.md) 发布。

**署名：** 若你基于本项目衍生或再分发，请保留版权声明与许可文件，并注明来源：[CapabilityManagerAgent](https://github.com/xhqing/CapabilityManagerAgent)。
