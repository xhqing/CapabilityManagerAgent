# Scroll Reverser 完整参考

## 目录

1. [软件与版本](#软件与版本)
2. [工作原理](#工作原理)
3. [权限要求](#权限要求)
4. [安装](#安装)
5. [升级与更新通道](#升级与更新通道)
6. [卸载](#卸载)
7. [全部配置键](#全部配置键)
8. [AppleScript 接口](#applescript-接口)
9. [已知问题与处置（含 GitHub issue 证据）](#已知问题与处置含-github-issue-证据)
10. [macOS 26 现状](#macos-26-现状)
11. [只读检查清单](#只读检查清单)
12. [官方资源](#官方资源)

## 软件与版本

- 作者：Nick Moore（Pilotmoon Software），免费，开源（Apache-2.0），源码在 GitHub。
- 最新版 **1.9**（2024-06-21），要求 macOS 13.5+，Intel 与 Apple Silicon 都支持。
- 旧版回退线：1.8.2（macOS 10.12.6+）、1.7.6（10.7+）、1.5.1（10.4+，含 PowerPC）。
- 配置文件：`~/Library/Preferences/com.pilotmoon.scroll-reverser.plist`（bundle id `com.pilotmoon.scroll-reverser`）。

## 工作原理

核心逻辑在源码 `MouseTap.m`：通过 Quartz Event Services 的 **CGEventTap** 挂进系统滚动事件流，逐个事件判断是否反转。区分触控板与鼠标依靠事件流中的 **gesture 事件**（触控板两指滚动会带 gesture 信息，滚轮鼠标没有）。

由此决定的固有特性：

- 必须持有辅助功能权限，否则 event tap 建不起来、整体不工作。
- gesture 流被系统中断（睡眠唤醒、外接屏接入、部分 macOS 版本 bug）后，app 可能分不清设备或拿不到事件 → 表现为失灵或「反转了鼠标却连带触控板」。
- **手势型滚动界面无法反转**（macOS 日历、iPhone Mirroring 等）——它们不走标准滚动事件。这是设计限制，遇到时向用户说明即可，不要当故障修。
- 滚轮步进：检测到非连续滚动（滚轮鼠标）时按固定行数滚动（`DiscreteScrollStepSize`），替代系统默认的滚动加速；设为 0 则关闭该功能、回到系统默认。
- 调试窗口：⌥ Option 点击菜单栏图标可打开（显示事件流，排障用）。
- 1.7.3 起 app 会在 Mac 从睡眠唤醒时**静默自动重启自己**（针对唤醒后 gesture 流中断的自愈机制）。

## 权限要求

1. **辅助功能（Accessibility）**——必需。系统设置 → 隐私与安全性 → 辅助功能。
2. **输入监控（Input Monitoring）**——1.8 起的界面在缺权限时会提示，一并检查。

官方「无法启用」修复流程（FAQ 原文口径）：

1. 退出 app；
2. 确认 app 位于 /Applications 文件夹；
3. 辅助功能列表中先把 Scroll Reverser 用「−」**移除**，再用「+」**重新添加**（顺序很重要，仅重新勾选可能不够）；
4. 重新启动 app。

macOS 大版本升级后权限静默失效是失灵的常见根因；上述移除重加流程是官方对策。

## 安装

- 官网下载 zip（约 1.6 MB），解压后**拖入 /Applications**（官方明确要求装在 /Applications）。
- 或 Homebrew：`brew install --cask scroll-reverser`。
- 首次运行会请求辅助功能权限；登录自启在 app 设置里开启（新版登录项由系统 ServiceManagement 管理，不走 `StartAtLogin` 遗留键）。
- 不要装在桌面 / 文稿等 iCloud 同步目录：iCloud 可能把 app 数据腾空（只留占位文件）导致启动失败，且登录自启在文件未下载时也会失败。

## 升级与更新通道

- app 内置 Sparkle 自动更新（偏好窗口「App」面板有「Check Now」）；`BetaUpdates=1` 时走 beta 通道。
- 手动升级：官网或 GitHub Releases 下载新版，退出旧版后覆盖 /Applications 里的 app，配置（plist）保留。
- 升级后如果失灵，优先怀疑权限被重置 → 走上面的移除重加流程。

## 卸载

1. 菜单栏图标 → Quit 退出；
2. 把 app 移入废纸篓；
3. 可选：删除 `~/Library/Preferences/com.pilotmoon.scroll-reverser.plist`（不删的话重装后配置仍在）。

## 全部配置键

默认值出处：源码 `AppDelegate.m` 的 `registerDefaults`。

| 键 | 类型 | 含义 | 默认值 |
|---|---|---|---|
| `InvertScrollingOn` | bool | 主开关（菜单「Enable Scroll Reverser」） | 关 |
| `ReverseY` | bool | 垂直方向反转 | 开 |
| `ReverseX` | bool | 水平方向反转 | 关 |
| `ReverseTrackpad` | bool | 触控板反转 | 开 |
| `ReverseMouse` | bool | 鼠标反转 | 开 |
| `DiscreteScrollStepSize` | int | 滚轮每格行数（0 = 关闭步进） | 3 |
| `HideIcon` | bool | 隐藏菜单栏图标 | 关 |
| `BetaUpdates` | bool | beta 更新通道 | 按构建类型 |
| `ShowDiscreteScrollOptions` | bool | 偏好窗口是否显示步进选项 | — |
| `ReverseOnlyRawInput` | bool | 只反转原始（非 gesture）输入——远程桌面软件控制本机时，远端来的滚动事件按鼠标处理，开启后只反转物理设备 | 关 |
| `StartAtLogin` | bool | 遗留键（新版由系统登录项管理，不再使用） | — |

行为细节（源码 `MouseTap.m` 证实）：

- 每个滚动事件都实时读取这些键，因此 `defaults write` 改键**一般即时生效**，无需重启；极少数情况下 app 的偏好缓存滞后，重启 app 即可。
- 反转逻辑链：`InvertScrollingOn` 总开关 → 设备判定（触控板取 `ReverseTrackpad`、鼠标取 `ReverseMouse`）→ 方向判定（垂直乘 `ReverseY`、水平乘 `ReverseX`）。任何一环为否，对应滚动就不反转——排查「方向不对」时沿这条链查。

## AppleScript 接口

v1.7 起内置（sdef 词典只有一个属性）：

```bash
# 读主开关
osascript -e 'tell application id "com.pilotmoon.scroll-reverser" to get enabled'
# 开 / 关
osascript -e 'tell application id "com.pilotmoon.scroll-reverser" to set enabled to true'
# 退出
osascript -e 'tell application id "com.pilotmoon.scroll-reverser" to quit'
```

用 bundle id 寻址比用名字稳（名字含空格，且不依赖 app 所在路径）。首次从某个宿主（Terminal、iTerm、ZCode 宿主等）发 Apple Events 需要「自动化」授权：系统设置 → 隐私与安全性 → 自动化 → 对应宿主勾选 Scroll Reverser；报「not authorized to send Apple events」就是这个没勾。

## 已知问题与处置（含 GitHub issue 证据）

| 症状 | 根因 | 处置 | 证据 |
|---|---|---|---|
| 睡眠唤醒后失灵，方向变回 | 唤醒后系统停止发送 gesture 事件 | 1.7.3 起 app 唤醒时自动静默重启自愈；仍发生则 toggle 主开关（关→开） | ReleaseNotes v1.7.3；issue #15、#195（「deactivating and activating works」） |
| 接外接显示器后失灵 / 方向错乱 | 显示器热插拔打断事件流 | toggle 常救不回，**彻底退出 app 再启动** | issue #132 |
| macOS 26.x 上鼠标滚轮多数时间不反转、激活后短暂有效 | 尚无官方定论，多名用户复现 | toggle 可恢复；暂无官方修复，跟踪 issue | issue #200（作者：26.1/26.2 无已知问题，但多人报告时好时坏） |
| 反转鼠标时触控板也被反转 / 设备识别错乱 | gesture 事件缺失导致设备误判 | 关闭「辅助功能 → 缩放 → 高级 → 控制器 → 使用触控板手势缩放」；部分第三方外接触控板天然被识别为鼠标 | issue #92、#151 |
| 日历、iPhone Mirroring 里方向不反转 | 手势型滚动不走标准事件 | 设计限制，无法修，向用户说明 | issue #184、官方说明 |
| 配置随机变动 | 历史上有（1.7.6 改过加载逻辑） | 复发时对照本机快照 `defaults write` 恢复 | issue #38 |
| 加不进登录项 / 重启后不自启 | 历史问题已修；现多因 app 装在 iCloud 目录或权限失效 | 装到 /Applications、重授权、系统设置里重新勾选登录项 | issue #165、#53 |

## macOS 26 现状

- 1.9 官方支持到 macOS 13.5+，在 macOS 26（Tahoe）上无官方声明的不兼容；作者表态 26.1/26.2「works for me」。
- 但 issue #200 有多名用户（M1/M3，macOS 26.1–26.2）报告鼠标滚轮反转**时好时坏**，多数情况失效、重新激活后短暂有效——与「偶发失灵」的表象吻合。
- 实用结论：macOS 26 上的偶发失灵，按 SKILL.md 第 4 步（toggle）→ 第 5 步（重启）处置即可恢复；若高频复发，可关注 #200 后续或试 `ReverseOnlyRawInput` 等进阶键。

## 只读检查清单

排障时先跑这组只读命令建立事实基线（全部不改变状态）：

```bash
pgrep -fl "Scroll Reverser"                                    # 进程与安装路径
osascript -e 'tell application id "com.pilotmoon.scroll-reverser" to get enabled'   # 主开关
defaults read com.pilotmoon.scroll-reverser                    # 全部配置（未出现的键=默认值）
osascript -e 'tell application "System Events" to get the name of every login item' # 登录项
```

对照 `local/config.md` 的应然快照判断哪一项异常，再进对应修复步骤。

## 官方资源

- 官网（下载 + FAQ）：https://pilotmoon.com/scrollreverser/
- GitHub 源码与 issues：https://github.com/pilotmoon/scroll-reverser
- 支持邮箱：support@pilotmoon.com
