<div align="center">
  <img src="assets/logo.svg" width="640" alt="CapabilityManagerAgent">
</div>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Type](https://img.shields.io/badge/Type-AI%20Agent-FF1493.svg)](#)
[![Domain](https://img.shields.io/badge/Domain-%7E%2F.claude-F97316.svg)](#)

</div>

# CapabilityManagerAgent

> 🔥 **Prometheus** — the capability steward who tends the common-capability backbone shared by every Claude Code agent. When a global skill, rule, or setting changes, Prometheus propagates it to every project copy, so the whole fleet stays in sync.

[中文](README_cn.md)

CapabilityManagerAgent manages the **common-capability backbone** of the Claude Code agent fleet: everything under the user-level `~/.claude/` directory that is **not specific to one agent but shared by all** — global skills, global rules, `settings.json`, and slash commands — plus the cross-project sync that keeps every agent project's `.claude/` copy consistent with the global authority.

> This is **not** a traditional software project. There is no application to `npm install`. The repository *is* the agent: its behavior is shaped entirely by the `skills` and `rules` under `.claude/`, which Claude Code loads as Prometheus's operating discipline.

---

## Who is Prometheus?

The agent is personified as **Prometheus** — the capability steward of the fleet. Where other agents trade, produce, or market, Prometheus keeps the **shared foundation** every one of them stands on: the global skills, rules, and config under `~/.claude/`.

The name **Prometheus** ("the one who brings fire") fits the role: tending the common fire — the shared capabilities — that lets every agent do its work. Its edge is not domain expertise but **consistency and care**:

- **Global is authoritative.** The global `~/.claude/` copy is the source of truth; project copies only mirror it.
- **Sync through the hub.** A change in one project copy flows back to global first, then out to every other project — never project-to-project.
- **Back up before you touch the foundation.** Anything under `~/.claude/` affects the whole fleet; edits are backed up and confirmed first.

---

## What Prometheus manages

| Location | Content |
|---|---|
| `~/.claude/skills/` | Global common skills (anysearch, commit, find-skill, image-ocr, release, …) |
| `~/.claude/rules/` | Global working rules (file-operation-priority, tmp-dir, verify-before-report) |
| `~/.claude/settings.json` | Global config (env, availableModels, effortLevel, theme, hooks) |
| `~/.claude/commands/` | Global slash commands |
| `~/.claude/CLAUDE.md` | Global preferences + fleet registry + scaffolding conventions (meta-rules) |

**Out of scope** (owned elsewhere; Prometheus does not touch): each agent's domain skills and business config; VSCode extension patches (Tinker / PatchClaudeAgent).

---

## Core workflow: global ↔ project sync

Every common skill / rule lives once in `~/.claude/` (the **authoritative copy**) and again in each agent project's `.claude/` (a **project copy**) — so cloning a project yields a self-contained agent. Prometheus's main job is propagating changes between them.

Two sync rules are codified today (from the global `~/.claude/CLAUDE.md`):

- **anysearch** — global authoritative; core content kept identical across copies; the `runtime.conf` `Command` path is the one exception (global uses an absolute path, project copies use a project-relative path for portability).
- **find-skill** — global authoritative; core files byte-identical (no path exception); `.env` and `cache/` are machine-local and never synced.

The full procedure, guardrails, and fleet-registry maintenance steps live in the skill: [`.claude/skills/capability-manager/SKILL.md`](.claude/skills/capability-manager/SKILL.md).

---

## How it's activated

Claude Code activates Prometheus whenever the user asks to **maintain or update a global skill / rule, change global `settings.json` or `CLAUDE.md`, add or retire a common skill, sync a common skill across agent projects, unify project scaffolding, or add an agent to the fleet registry**. On activation it loads the `capability-manager` skill and runs its guardrails.

---

## Position in the fleet

| Agent | Role |
|---|---|
| **Prometheus** (this project) | Common-capability backbone + cross-project sync + fleet registry |
| Tinker (PatchClaudeAgent) | VSCode Claude Code extension self-healing patches |

Prometheus is independent of the sales pipeline (Scout → Wright → Buzz → Vendy → Echo); it serves the shared foundation of the whole fleet.

---

## License & Attribution

Copyright (c) 2026 Huaqing Xu, Contributors. Licensed under the [MIT License](LICENSE.md).

**Attribution:** If you derive from or redistribute this project, please retain the copyright notice and license file, and credit the source: [CapabilityManagerAgent](https://github.com/xhqing/CapabilityManagerAgent).
