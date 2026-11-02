# 分支保护（main 锁定）现状与操作

> 2026-10-04 立。回答一个反复踩到的问题：**「remote main 已锁定」是按仓库实际设置定的，不是全局默认。**
>
> 背景：政策文档早先写了「remote main 恢复分支保护、锁定直推、一切经 PR + CI 合并」，但 2026-10-04 实测发现：全机 42 个远程仓库里只有 **4 个**真开了保护——当天一次正常的直推 main 被当成异常去追查，白花排查时间。口径长期与现实不符，本身就是下一个坑，所以把「哪些仓库是哪种状态」写成事实来源。

## 现状（2026-10-04 实测）

- **已开保护（7 个）**
  - 试点（2026-10-04）：`xhqing/CapabilityManagerAgent`、`xhqing/ExecutiveAssistantAgent`、`xhqing/zcode-cli`
  - 更早：`xhqing/codef`、`xhqing/ghostty`、`xhqing/ghostty-launcher`、`xhqing/pi`
- **未开保护**：其余 public 仓库（直推 main 可用；技能里「已开保护 → push 被拒 → 走 PR 兜底」的分支不触发）
- **无法开保护**：private 仓库（GitHub 免费版不支持分支保护 / rulesets，API 直接报「Upgrade to GitHub Pro」）

### 试点参数（可作模板）

```json
{
  "required_status_checks": {"strict": false, "contexts": ["validate"]},
  "enforce_admins": true,
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

要点：`enforce_admins: true` 是关键——**否则 agent 用同一个账号直推照样能绕过**（保护形同虚设）；`required_approving_review_count: 0` 表示「要 PR、但不要人工批准」；`strict: false` 不要求分支最新，减少无谓重跑。

## 铺开前必须先开 auto-merge（重要）

技能链路在 main 受保护时走「建分支 → push → 建 PR → enable auto-merge → CI 绿自动合并」。仓库若 `allow_auto_merge=false`，这一步会失败 → **PR 悬空等人手动合**（commit skill 的 9z 只等 15 分钟就放弃），比直推更糟。铺开顺序：

1. 先查/开 auto-merge：`gh api -X PATCH repos/<o>/<r> -f allow_auto_merge=true`
2. 确认 PR 上真正会跑的检查名：`gh api repos/<o>/<r>/commits/<sha>/check-runs --jq '[.check_runs[].name]|unique'`
   - **不要把定时任务（`schedule` 触发）的检查名挂成必需**——那种检查在 PR 上不跑，会永远卡住合并（`zcode-cli` 的 `prepare`、`keepalive` 就是例子，只挂 `validate`）
3. 再挂保护：`gh api -X PUT repos/<o>/<r>/branches/<branch>/protection --input - <<< '<上面那份 JSON>'`
4. 挂完确认 CI 本身是绿的——CI 红了又没有逃生门时，PR 会一直合不进去

## 2026-11-02：全团队锁死 remote main（用户立规，已铺开）

用户原话：「任何任务都先单独建立 worktree……所有智能体团队项目（包括 Agent 项目和各个 Agent 的子项目）都锁死 remote-main，不能从本地直接 Push-local-main 到 remote-main，只能从 worktree 走 PR 流程」。规则正文见 `~/.pi/agent/CLAUDE.md`「开发流程：worktree + PR」节。

**已铺开范围**（2026-11-02 实测，脚本逐仓 `PUT …/branches/<default>/protection`）：

- **public 仓库（全部已锁）**：18 个 Agent 项目 + 19 个子项目。参数统一为：PR 必过（0 approvals）、`enforce_admins=true`、禁 force / 禁删除、线性历史、`allow_squash_merge=true` + `allow_merge_commit/rebase_merge=false` + `allow_auto_merge=true` + `delete_branch_on_merge=true`；原有 required check 的仓库保留其 context 并补 `strict=true`（`CapabilityManagerAgent` / `ExecutiveAssistantAgent` = `validate`，`ghostty-launcher` = `Test & Check`，`codef` = `test`，`ghostty` = `build-macos`，`mp4-player` = `build`，`pi-harness` = `build-check-test`，`XPilot` = `test`）。
- **cmux**：保护已开（PR 必过 + 线性 + 禁 force/删除 + admins 受限），但 required check 暂为空——fork 的 Actions 还没启用，加了会冻死 main；启用后再补 `checks`（见 cmux `DEVELOPMENT.md` §9.6）。
- **private 仓库（GitHub 免费版无法开保护，API 直接 403）**：`dotfiles`、`ToolCallingRules`、`xhs-mentor-scam`。这些仓库靠本地 `git-main-guard.ts` 硬拦 + 流程约束。要真正上服务端保护需升级 GitHub Pro 或改 public（用户决定）。
- **暂未锁的例外**：`xhs-mentor-scam` —— 该仓有一个 launchd 每 5 分钟执行的 `autosave.sh` **直接 push main**（备份用途，单写者、无 CI）。锁了会让自动备份静默失败，待决定：改造 autosave 推 `autosave` 分支，或保留豁免。
- **已退役/改名归档仓库不在范围**：`BidOptimizerAgent`、`CommunityManagerAgent`、`DeviceStewardAgent`、`NetOpsAgent`、`PatchClaudeAgent`。

**注意**：`gridtrader` 默认分支是 `master`（其余为 `main`），保护挂在 `master` 上。

**工具强制**：`~/.pi/agent/extensions/git-main-guard.ts`（2026-11-02 新增）拦截两类操作——① `git push` 的 refspec 指向 `main`/`master`（含裸 `git push`、`HEAD:main`、`--delete main`、`--all`/`--mirror`）；② 当前在 `main`/`master` 上的 `git commit`。仅对带 GitHub remote 的仓库生效；逃生标记 `# AI_AUTHORIZED_PUSH_MAIN` / `# AI_AUTHORIZED_COMMIT_MAIN`（仅限用户当轮授权）。**新装的扩展只对新会话生效**，已在跑的会话要重启才会加载。

## 常用命令

| 目的 | 命令 |
|---|---|
| 查保护状态 | `gh api repos/<o>/<r>/branches/<branch>/protection`（404 = 未保护；注意 `gh api` 的 404 响应体是合法 JSON，**判定要看退出码**，别看输出能不能解析） |
| 查 auto-merge | `gh api repos/<o>/<r> --jq .allow_auto_merge` |
| 查 PR 检查名 | `gh api repos/<o>/<r>/commits/main/check-runs --jq '[.check_runs[].name]\|unique'` |
| 全机扫描 | 遍历 `~/Developer/*/`：`git -C <dir> remote get-url origin` 提取 `owner/repo`，再逐个查保护 |
| 紧急关闭（管理员逃生门） | `gh api -X DELETE repos/<o>/<r>/branches/<branch>/protection` |

## 与技能的关系

commit skill 已按 2026-11-02 的新规矩改为「main 上一律先建分支再走 PR 通道」，不再存在「远端无保护就直推 main」的分支；本文件补的是「哪些仓库处于哪种状态」这个事实来源。
