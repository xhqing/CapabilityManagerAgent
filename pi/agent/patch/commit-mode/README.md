# commit-mode —— 按项目切换「自动提交 / 手动提交」模式

## 这是什么

全局规则里有一条常设授权：**工作区 / 暂存区有待提交内容时，AI 直接按 add skill / commit skill 提交，不用问用户**（2026-10-04 用户立）。这条规则很好用，但有时用户想先看看工作区相对暂存区的改动（例如用 diff 视图逐行过一遍），这时候需要暂停自动提交。

`commit-mode` 就是这个开关：把某个项目登记为「手动提交模式」，该目录（含子目录里的仓库）就不再由 AI 自动发起 add / commit；只有用户在当轮消息里明确要求提交时才执行。

## 怎么用

```bash
commit-mode status [路径]    # 查看当前（或指定路径）是自动还是手动模式
commit-mode manual [路径]    # 切换为手动模式（暂停自动 add / commit）
commit-mode auto   [路径]    # 切换回自动模式
commit-mode toggle [路径]    # 在两种模式之间切换
commit-mode list             # 列出手动模式的项目
commit-mode off / on         # 别名（off = manual，on = auto）
```

- **路径省略时**：默认取当前目录所在 git 仓库的根目录（不在仓库内则取当前目录）。
- **粒度**：登记的是**目录**，该目录及其所有子目录（含子项目仓库）都算手动模式。所以：
  - `commit-mode manual`（在 Agent 项目根执行）→ 该项目下所有子项目都暂停自动提交；
  - `commit-mode manual ~/Developer/xxx-hub/sub` → 只暂停那一个仓库。
- **在会话里也能用**：直接跟 AI 说「这个项目切手动提交模式」「暂停自动提交」「切回自动提交」，AI 会执行对应命令。
- **安装 / 更新**：本目录的 `commit-mode` 是脚本本体，`./install.sh` 会把它复制到 `~/.local/bin/commit-mode`（改过脚本后要重跑一次 install.sh 才生效）。

## 手动模式下 AI 的行为

1. **不自动发起** `/add`、`/commit`、`/bump`、`/release`，不主动执行 `git add` / `git commit`，工作区改动保持原样。
2. 用户当轮明确要求提交（「提交一下」「跑 /add」「/commit」）时才执行，且照常走 skill 全流程与全部安全阀。
3. 收尾巡检（settle-repo-check）跳过手动模式的仓库，不催促提交。
4. 不会自行把项目切回自动模式——模式由用户决定。

## 状态文件

`~/.pi/agent/state/commit-mode.json`：

```json
{
  "manual": ["/Users/xhq/Developer/某项目"],
  "updated": "2026-10-31T17:00:00+08:00"
}
```

`state/` 目录在 macmini 镜像的排除项里（见 `~/.pi/agent/.stignore`），所以两台机器各管各的、不会互相覆盖。

## 谁在读这个状态

| 组件 | 作用 |
|---|---|
| `~/.pi/agent/extensions/commit-mode-guard.ts` | 手动模式下每轮把约束注入系统提示（预防）+ 用户没要求时硬拦 `git add` / `git commit`（下限防线） |
| `~/.pi/agent/extensions/redundant-ask-guard.ts` | 授权清单里那条「有待提交内容就直接提交」在手动模式下换成「不要自行提交」 |
| `~/.pi/agent/extensions/settle-repo-check.ts` | 收尾巡检跳过手动模式仓库 |

## 已知边界（诚实说明）

- **硬拦截按命令文本判断**：AI 如果把 git 命令写进脚本文件再执行，本扩展看不到、拦不住。它是下限防线，真正的判断靠系统提示与规则文本。
- **「用户当轮明确要求」的判定**：看最近一条用户输入里有没有提交意图词（`/add`、`/commit`、提交、入库、暂存、commit 等）。intercom / 系统消息触发的轮次不算用户输入——避免用户上一轮说过的「/commit」被跨会话消息借用成授权。
- **手动模式不影响发版本身**：如果手动模式下用户主动敲 `/release`，照常走；只是 AI 不会自己发起。
