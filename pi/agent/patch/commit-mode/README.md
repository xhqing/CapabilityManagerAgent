# commit-mode —— 按项目开关「自动 commit」

## 这是什么

全局规则里有一条常设授权：**暂存区有待提交内容时，AI 直接按 commit skill 提交，不用问用户**（2026-10-04 用户立）。但有时你想先看看**暂存区相对 HEAD** 的改动（`git diff --cached`），或者干脆不想让 AI 自己提交，这时候需要暂停自动 commit。

`commit-mode` 就是这个开关：把某个项目登记为「手动 commit」，该目录（含子目录里的仓库）就不再由 AI 自动走 `/commit`、`/bump`、`/release`，也不自动执行 `git commit`；只有你在当轮消息里明确要求提交时才执行。

**与 add-mode 完全独立**：两个命令、两个状态文件、两个守卫扩展，互不读对方的代码。本命令只管 commit；想管 add 用另一个命令 `add-mode`。

## 怎么用

```bash
commit-mode status [路径]    # 查看当前（或指定路径）的自动 commit 状态
commit-mode manual [路径]    # 暂停自动 commit
commit-mode auto   [路径]    # 恢复自动 commit
commit-mode toggle [路径]    # 在两种状态之间切换
commit-mode list             # 列出自动 commit 已关闭的项目
commit-mode off / on         # 别名（off = manual，on = auto）
```

- **路径省略时**：默认取当前目录所在 git 仓库的根目录（不在仓库内则取当前目录）。
- **粒度**：登记的是**目录**，该目录及其所有子目录（含子项目仓库）都生效。
- **在会话里也能用**：直接跟 AI 说「把这个项目的 commit 切成手动」「commit 恢复自动」，AI 会执行对应命令。
- **安装 / 更新**：本目录的 `commit-mode` 是脚本本体，`./install.sh` 会复制到 `~/.local/bin/commit-mode`（改过脚本后要重跑一次 install.sh 才生效）。

## 输入框斜杠命令（用户入口）

不用切终端，直接在 pi 输入框敲（扩展注册的真命令，不经过模型、不消耗 token）：

| 命令 | 作用 |
|---|---|
| `/manual-commit` | 暂停本项目的自动 commit（可带路径） |
| `/auto-commit` | 恢复本项目的自动 commit |
| `/commit-mode` | 查看本项目的自动 commit 状态 |

「本项目」= 当前会话的工作目录（脚本会自动取它所在的 git 仓库根）；带路径参数时以参数为准。

**这些命令只是给你的入口**：AI 无法调用斜杠命令（它的工具箱里没有这东西），所以不会出现「AI 自己敲 /manual-commit 把开关关掉」的情况；AI 侧的动作仍然走 shell 命令 `commit-mode ...`，且规则要求只有你明确要求时才能切。

修改扩展后，需要 `/reload` 或新开一个会话，命令才会出现在自动补全里。

## 暂停时的行为

1. **不主动走 `/commit`、`/bump`、`/release`、不执行 `git commit`**；即使 add skill 预检完全干净、准备自动衔接提交，本模式下也停下（只 add、不提交）。只有用户当轮明确要求提交时才执行，照常走 commit skill 全流程与安全阀。
2. 收尾巡检（settle-repo-check）跳过被暂停的仓库，不催促提交。
3. 不会自行把开关切回自动——开关由用户决定。

## 状态文件

`~/.pi/agent/state/commit-mode.json`：

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
| `~/.pi/agent/extensions/commit-mode-guard.ts` | 每轮把「自动 commit 已关闭」注入系统提示（预防）+ 用户没要求时硬拦 `git commit`（下限防线） |
| `~/.pi/agent/extensions/redundant-ask-guard.ts` | 授权清单里 commit 相关那条按状态改写 |
| `~/.pi/agent/extensions/settle-repo-check.ts` | 收尾巡检跳过被暂停的仓库 |

## 已知边界（诚实说明）

- **硬拦截按命令文本判断**：AI 如果把 git 命令写进脚本文件再执行，本扩展看不到、拦不住。它是下限防线，真正的判断靠系统提示与规则文本。
- **「用户当轮明确要求」的判定**：看最近一条用户输入里的意图词（提交、commit、发版、bump、release 等）。**用户只敲 `/add` 不算提交授权**——所以只关 commit 的项目里，`/add` 能正常 add，但不会连带提交。intercom / 系统消息触发的轮次不算用户输入。
- **只管 commit，不管 add**：如果只想看工作区相对暂存区的 diff，应该用 `add-mode`（或两个都关）。
