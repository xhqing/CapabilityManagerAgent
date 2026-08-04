<div align="center">
  <img src="assets/logo.svg" width="640" alt="CapabilityManagerAgent">
</div>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Last Commit](https://img.shields.io/github/last-commit/xhqing/CapabilityManagerAgent)](https://github.com/xhqing/CapabilityManagerAgent/commits/main)
[![Type](https://img.shields.io/badge/Type-AI%20Agent-FF1493.svg)](#)


</div>

# CapabilityManagerAgent

> 🔥 **Prometheus** — the capability steward who guards the common-capability backbone of the entire Claude Code agent fleet. When a global skill, rule, or config changes, Prometheus propagates the change to every project copy, keeping the whole fleet in sync.

[简体中文](README_cn.md)

CapabilityManagerAgent manages the **common-capability backbone** of the Claude Code agent fleet: everything under the user-level `~/.claude/` directory that is **not specific to one agent but shared by all** — global skills, global rules, `settings.json`, and slash commands — plus the cross-project sync that keeps every agent project's `.claude/` copy consistent with the global authoritative copy.

---

## Who is Prometheus?

This agent is personified as **Prometheus** — the capability steward of the fleet. Where other agents trade, produce, or market, Prometheus guards the **shared foundation** they all stand on: the global skills, rules, and config under `~/.claude/`.

The name **Prometheus** ("the one who brings fire") fits the role: guarding the common fire — the shared capabilities — that lets every agent do its work. Its edge is not domain expertise but **consistency and care**:

- **Global is authoritative.** The global `~/.claude/` copy is the source of truth; project copies are only mirrors.

- **Back up before you touch the foundation.** Anything under `~/.claude/` affects the whole fleet; back up and confirm before editing.

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


Two sync rules are codified today (from the global `~/.claude/CLAUDE.md`, byte-identical to `claude/CLAUDE.md`):



The full procedure, guardrails, and fleet-registry maintenance steps are in the skill: [`.claude/skills/capability-manager/SKILL.md`](.claude/skills/capability-manager/SKILL.md).

---

## How it's activated

Claude Code activates Prometheus whenever the user asks to **maintain or update a global skill / rule, change global `settings.json` or `CLAUDE.md`, add or retire a common skill, unify project scaffolding, or add an agent to the fleet registry**. On activation it loads the `capability-manager` skill and runs its guardrails.

---

## Position in the fleet

| Agent | Role |
|---|---|
| **Prometheus** (this project) | Common-capability backbone + cross-project sync + fleet registry |
| Tinker (PatchClaudeAgent) | Self-healing patches for the VSCode Claude Code extension |

Prometheus is independent of the sales pipeline (Scout → Wright → Buzz → Vendy → Echo); it serves the shared foundation of the whole fleet.

---

## License & Attribution

Copyright (c) 2026 All Contributors. Licensed under the [MIT License](LICENSE.md).

**Attribution:** If you derive from or redistribute this project, please retain the copyright notice and license file, and credit the source: [CapabilityManagerAgent](https://github.com/xhqing/CapabilityManagerAgent).
