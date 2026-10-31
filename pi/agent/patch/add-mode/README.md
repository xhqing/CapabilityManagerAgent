# add-mode —— 按项目开关「自动 add」

## 这是什么

全局规则里有一条常设授权：**工作区有待提交内容时，AI 直接按 add skill 预检后加入暂存区，不用问用户**（2026-10-04 用户立）。但有时你想先看看**工作区相对暂存区**的改动（`git diff`），这时候需要暂停自动 add——否则 AI 一看到改动就把它们放进暂存区，`git diff` 就空了。

`add-mode` 就是这个开关：把某个项目登记为「手动 add」，该目录（含子目录里的仓库）就不再由 AI 自动走 `/add`、不再自动执行 `git add`；只有你在当轮消息里明确要求 add / 提交时才执行。

**与 commit-mode 完全独立**：两个命令、两个状态文件、两个守卫扩展，互不读对方的代码。本命令只管 add；想管 commit 用另一个命令 `commit-mode`。

## 怎么用

```bash
add-mode status [路径]    # 查看当前（或指定路径）的自动 add 状态
add-mode manual [路径]    # 暂停自动 add
add-mode auto   [路径]    # 恢复自动 add
add-mode toggle [路径]    # 在两种状态之间切换
add-mode list             # 列出自动 add 已关闭的项目
add-mode off / on         # 别名（off = manual，on = auto）
```

- **路径省略时**：默认取当前目录所在 git 仓库的根目录（不在仓库内则取当前目录）。
- **粒度**：登记的是**目录**，该目录及其所有子目录（含子项目仓库）都生效。
- **在会话里也能用**：直接跟 AI 说「把这个项目的 add 切成手动」「add 恢复自动」，AI 会执行对应命令。
- **安装 / 更新**：本目录的 `add-mode` 是脚本本体，`./install.sh` 会复制到 `~/.local/bin/add-mode`（改过脚本后要重跑一次 install.sh 才生效）。

## 暂停时的行为

1. **不主动走 `/add`、不执行 `git add`**，改动原样留在工作区；只有用户当轮明确要求 add / 提交时才执行，照常走 add skill 全流程与安全阀。
2. 收尾巡检（settle-repo-check）跳过被暂停的仓库，不催促提交。
3. 不会自行把开关切回自动——开关由用户决定。

## 状态文件

`~/.pi/agent/state/add-mode.json`：

```json
{
  "manual": ["/Users/xhq/Developer/某项目"],
  "updated": "2026-10-31T17:00:00+08:00"
}
```

`state/` 目录在 macmini 镜像的排除项里（见 `~/.pi/agent/.stignore`），两台机器各管各的。

## 谁在读这个状态

| 组件 | 作用 |
|---|---|
| `~/.pi/agent/extensions/add-mode-guard.ts` | 每轮把「自动 add 已关闭」注入系统提示（预防）+ 用户没要求时硬拦 `git add`（下限防线） |
| `~/.pi/agent/extensions/redundant-ask-guard.ts` | 授权清单里 add 相关那条按状态改写 |
| `~/.pi/agent/extensions/settle-repo-check.ts` | 收尾巡检跳过被暂停的仓库 |

## 已知边界（诚实说明）

- **硬拦截按命令文本判断**：AI 如果把 git 命令写进脚本文件再执行，本扩展看不到、拦不住。它是下限防线，真正的判断靠系统提示与规则文本。
- **「用户当轮明确要求」的判定**：看最近一条用户输入里的意图词（`/add`、预检、暂存、提交、commit、发版等）。intercom / 系统消息触发的轮次不算用户输入。
