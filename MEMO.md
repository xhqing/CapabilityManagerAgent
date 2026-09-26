# MEMO

超低频备忘项（比 🟢 绿色紧急度还低，无排期压力，条件触发时对照处理）。条目格式与 TODO 一致：`[ ]` + `**M编号**` + 正文（写明触发条件或时间锚点）+ `（记录：YYYY-MM-DD HH:MM）`；处理完移入 `MEMO-archive.md`。

- [ ] **M1** anysearch / agent-reach 的 skill 定制防护——**已由自动恢复机制兜底**（本机 `~/.claude/patch/skill-custom/`：launchd 监听 + 结构化重打，文件被覆盖后约 10 秒自动补回，2026-09-25 建立，详见 `README.md`）。本条触发条件为「发现定制丢失或机制失效」：先手动跑 `python3 ~/.claude/patch/skill-custom/restore.py` 恢复一次，再查 `launchctl list | grep skill-custom`（若无输出则 `launchctl load ~/Library/LaunchAgents/com.xhq.skill-custom.plist` 重载）；若是锚点丢失类问题，看 `conflicts/` 现场并更新 `snippets/` 或锚点规则。机制整体重建参照 CapabilityManagerAgent `CHANGELOG.md` 2026-09-25 条目（含设计沿革与验证记录）。（记录：2026-09-25 14:22；更新：2026-09-25 20:46）
