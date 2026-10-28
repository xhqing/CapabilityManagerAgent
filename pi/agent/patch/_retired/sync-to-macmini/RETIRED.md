# 已停用（2026-10-28）

这个目录是旧的「本机 → macmini 单向同步」实现（`sync-to-macmini.sh` + `watcher.js`），
由 Kit 于 2026-10-17 建立，负责把全局 `~/.pi/agent/` 的能力层单向 rsync 到 macmini。

**2026-10-28 起已被全量双向镜像取代**：本机与 macmini 的 `~/Developer` 与 `~/.pi/agent`
改由 Syncthing 双向同步（见 `~/.pi/agent/docs/macmini-mirror.md`），旧的 watcher 已从
launchd 卸载（plist 移到 `~/Library/LaunchAgents/disabled/`）。

保留本目录只为可回溯；**不要重新启用**——两套同步同时跑会互相打架（旧的单向 `--delete`
会把 macmini 上新增的内容删掉）。
