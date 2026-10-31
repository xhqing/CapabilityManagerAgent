# commit-mode —— 按项目分别切换「自动 add / 自动 commit」两个开关

## 这是什么

全局规则里有一条常设授权：**工作区 / 暂存区有待提交内容时，AI 直接按 add skill / commit skill 提交，不用问用户**（2026-10-04 用户立）。这条规则很好用，但有时用户想先看看改动，这时候需要暂停自动提交。2026-10-31 用户要求**把 add 和 commit 拆成两个独立开关**——两种暂停对应两种看法：

| 关掉的开关 | AI 的行为 | 适合看的 diff |
|---|---|---|
| `add` | 不主动走 `/add`、不执行 `git add`，改动留在工作区 | `git diff`（工作区 vs 暂存区） |
| `commit` | 不主动走 `/commit`、`/bump`、`/release`、不执行 `git commit`；add 仍可自动，但预检干净后不衔接 commit | `git diff --cached`（暂存区 vs HEAD） |
| `all` | 两个都暂停 | 两种 diff 都能看 |

## 怎么用

```bash
commit-mode status [路径]                    # 看 add / commit 两个开关的当前状态
commit-mode manual add    [路径]             # 暂停自动 add
commit-mode manual commit [路径]             # 暂停自动 commit
commit-mode manual all    [路径]             # 两个都暂停（省略对象时默认 all）
commit-mode auto   add|commit|all [路径]     # 恢复自动
commit-mode toggle add|commit|all [路径]     # 在两种状态之间切换
commit-mode list                             # 列出被暂停的项目
commit-mode off / on [对象] [路径]           # 别名（off = manual，on = auto）
```

- **路径省略时**：默认取当前目录所在 git 仓库的根目录（不在仓库内则取当前目录）。
- **粒度**：登记的是**目录**，该目录及其所有子目录（含子项目仓库）都生效。所以：
  - `commit-mode manual all`（在 Agent 项目根执行）→ 该项目下所有子项目都暂停；
  - `commit-mode manual add ~/Developer/xxx-hub/sub` → 只暂停那一个仓库的自动 add。
- **在会话里也能用**：直接跟 AI 说「把这个项目的 add 切成手动」「commit 恢复自动」「两个都暂停」，AI 会执行对应命令。
- **安装 / 更新**：本目录的 `commit-mode` 是脚本本体，`./install.sh` 会把它复制到 `~/.local/bin/commit-mode`（改过脚本后要重跑一次 install.sh 才生效）。

## 被暂停时的行为

1. **不自动执行被暂停的那一步**，只有用户当轮明确要求时才执行（用户要求「提交」时 add 也可执行），且照常走 skill 全流程与全部安全阀。
2. 收尾巡检（settle-repo-check）跳过被暂停的仓库（add 或 commit 任一暂停即跳过），不催促提交。
3. 不会自行把开关切回自动——开关由用户决定。

## 状态文件

`~/.pi/agent/state/commit-mode.json`：

```json
{
  "manualAdd": ["/Users/xhq/Developer/某项目"],
  "manualCommit": ["/Users/xhq/Developer/某项目"],
  "updated": "2026-10-31T17:00:00+08:00"
}
```

旧版单一 `manual` 字段仍被识别（视为两个都手动），下次保存时自动转成新结构。`state/` 目录在 macmini 镜像的排除项里（见 `~/.pi/agent/.stignore`），两台机器各管各的、不会互相覆盖。

## 谁在读这个状态

| 组件 | 作用 |
|---|---|
| `~/.pi/agent/extensions/commit-mode-guard.ts` | 每轮把被暂停的步骤注入系统提示（预防）+ 用户没要求时分别硬拦 `git add` / `git commit`（下限防线） |
| `~/.pi/agent/extensions/redundant-ask-guard.ts` | 授权清单里那条「有待提交内容就直接提交」按两个开关改写 |
| `~/.pi/agent/extensions/settle-repo-check.ts` | 收尾巡检跳过被暂停的仓库 |

## 已知边界（诚实说明）

- **硬拦截按命令文本判断**：AI 如果把 git 命令写进脚本文件再执行，本扩展看不到、拦不住。它是下限防线，真正的判断靠系统提示与规则文本。
- **「用户当轮明确要求」的判定**：看最近一条用户输入里的意图词。commit 要「提交 / commit / 发版」类意图；add 除上述外「/add、预检、暂存」也算。intercom / 系统消息触发的轮次不算用户输入——避免用户上一轮说过的「/commit」被跨会话消息借用成授权。
- **只关自动 commit 时 add 仍会自动**：这是设计如此（为了让暂存区能积累内容供 `git diff --cached` 查看）；如果只想看工作区 vs 暂存区，应该关自动 add（或两个都关）。
