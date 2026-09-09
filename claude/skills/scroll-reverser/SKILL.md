---
name: scroll-reverser
description: Mac 滚动方向工具 Scroll Reverser（Pilotmoon 出品，开源）的使用、配置与失灵排查修复。当用户提到 Scroll Reverser，或说滚动方向、滑动方向、触控板方向、鼠标滚轮方向反了、不对、变回默认、时好时坏、失灵了，或睡眠唤醒、接外接屏后方向异常，或要安装、升级、卸载、重配该工具、恢复其配置时，必须使用本 skill。提供无 GUI 的 AppleScript 与 defaults 命令通道、分级修复流程与官方失灵处置依据。
---

# Scroll Reverser 使用与失灵修复

## 它是什么

Scroll Reverser 是免费开源（Apache-2.0）的 macOS 工具，用来反转滚动方向，可对触控板与鼠标分别设置，垂直与水平方向也分别可设。当前最新版 1.9（2024-06-21），要求 macOS 13.5 及以上。

工作原理：通过 CGEventTap 拦截整条滚动事件流，并依靠事件流里的 gesture 事件区分「这是触控板还是鼠标」。由此推出两个关键事实：

1. **它必须持有「辅助功能」权限**（事件拦截的前提），权限出问题就整体失灵。
2. **gesture 事件流被系统断掉时会失灵**——典型触发场景：睡眠唤醒、连接 / 断开外接显示器、macOS 版本升级后。这正是「偶尔失灵、方向变回去」的根因大类。

已知设计限制（不是失灵，别去修）：手势型滚动界面（macOS 日历、iPhone Mirroring 等）无法被反转，手势方向跟随系统「自然滚动」设置。

## 失灵时的分级修复流程

用户报「滚动方向反了 / 变回去了 / 失灵」时，按以下顺序诊断与修复。每步都有命令，修完一步先验证再进下一步。

### 第 1 步：进程在不在

```bash
pgrep -fl "Scroll Reverser"
```

没有输出 → app 没在运行（重启后自启失败是常见失灵形态）。启动它：

```bash
open -a "Scroll Reverser"
```

若 `open -a` 找不到 app，说明安装位置特殊，去 `local/config.md`（本机应然配置）里拿本机安装路径。

### 第 2 步：主开关开着吗

```bash
osascript -e 'tell application id "com.pilotmoon.scroll-reverser" to get enabled'
```

返回 `false` → 主开关被关了（可能被误点）。打开它：

```bash
osascript -e 'tell application id "com.pilotmoon.scroll-reverser" to set enabled to true'
```

### 第 3 步：配置漂移了吗

```bash
defaults read com.pilotmoon.scroll-reverser
```

对照 `local/config.md` 里的本机应然配置快照（用户惯用的开关组合）。发现某键被改掉 → 用 `defaults write` 恢复（键名含义见下方速查表），运行中的 app 在每个滚动事件里实时读取这些键，一般即时生效；未见生效就重启 app（第 5 步的命令）。

### 第 4 步：都对但仍失灵 → toggle 重置（最高频解法）

进程在、开关开、配置对，但方向就是不对——这是 gesture 事件流断掉的经典形态（睡眠唤醒、外接屏、macOS 26 偶发）。官方 ReleaseNotes v1.7.2 明说：停止工作时把 Scroll Reverser 关一下再开即可重置。一条命令完成：

```bash
osascript -e 'tell application id "com.pilotmoon.scroll-reverser" to set enabled to false' -e 'tell application id "com.pilotmoon.scroll-reverser" to set enabled to true'
```

### 第 5 步：toggle 无效 → 彻底重启 app

接外接屏导致的失灵（GitHub issue #132 实证）往往 toggle 救不回来，必须整个重启进程：

```bash
osascript -e 'tell application id "com.pilotmoon.scroll-reverser" to quit' && sleep 1 && open -a "Scroll Reverser"
```

### 第 6 步：仍无效 → 权限与安装位置

1. **重授权**（官方 FAQ 流程）：系统设置 → 隐私与安全性 → 辅助功能——先把 Scroll Reverser 用「−」移除，再用「+」重新添加，然后重启 app。「输入监控」权限同样检查一遍。macOS 大版本升级后权限静默失效是常见根因。
2. **确认装在 /Applications**：官方 FAQ 要求。装在桌面等 iCloud 同步目录里，存在数据被腾空、登录自启失败等隐患（若发现装错位置，迁移 = 退出 app → 移动到 /Applications → 重新启动；迁移前告知用户并征得同意）。

### 修复后验证

- `pgrep -fl "Scroll Reverser"` 有进程；
- AppleScript `get enabled` 返回 `true`；
- 让用户实际滑一下触控板确认方向。

## 配置键速查

| plist 键 | 含义 | 默认值（源码 registerDefaults） |
|---|---|---|
| `InvertScrollingOn` | 主开关（= 菜单栏「Enable Scroll Reverser」） | 关（未写盘即关） |
| `ReverseY` | 垂直方向反转 | 开 |
| `ReverseX` | 水平方向反转 | 关 |
| `ReverseTrackpad` | 触控板反转 | 开 |
| `ReverseMouse` | 鼠标反转 | 开 |
| `DiscreteScrollStepSize` | 滚轮每格滚动行数（0 = 关闭步进、用系统默认加速） | 3 |
| `HideIcon` | 隐藏菜单栏图标 | 关 |
| `BetaUpdates` | 接受 beta 更新 | 按构建类型 |
| `ReverseOnlyRawInput` | 只反转原始输入（远程桌面控制本机时的进阶场景） | 关 |

写法示例：

```bash
defaults write com.pilotmoon.scroll-reverser ReverseMouse -bool NO
defaults write com.pilotmoon.scroll-reverser DiscreteScrollStepSize -integer 3
```

注意：plist 里**未出现的键等于取默认值**——看到键缺失不是配置丢了。配置文件位置：`~/Library/Preferences/com.pilotmoon.scroll-reverser.plist`。`StartAtLogin` 是遗留键，新版登录项由系统管理，检查用 `osascript -e 'tell application "System Events" to get the name of every login item'`。

## 常见坑

- **AppleScript 报「not authorized to send Apple events」**：运行 agent 的宿主终端缺少自动化授权 → 系统设置 → 隐私与安全性 → 自动化 → 给宿主 app（Terminal / iTerm / ZCode 宿主等）勾上 Scroll Reverser。
- **触控板被当成鼠标**（表现为反转了鼠标却连带触控板、或反之）：关闭 系统设置 → 辅助功能 → 缩放 → 高级 → 控制器 里的「使用触控板手势缩放」（issue #92）。
- **菜单栏图标被藏**（`HideIcon=1` 时用户找不到开关入口）：⌥ Option 点击菜单栏图标可开调试窗口；把 `HideIcon` 写回 0 恢复图标。

## 深入参考

- 完整指南（工作原理、安装 / 升级 / 卸载、权限细节、全部已知问题与 issue 证据、macOS 26 现状）：`references/guide.md`
- 本机应然配置快照（用户惯用开关组合、安装路径、版本、一键恢复命令块）：`local/config.md`——读取不到说明不在用户本机环境，按通用流程处理即可。
