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

## 常用命令

| 目的 | 命令 |
|---|---|
| 查保护状态 | `gh api repos/<o>/<r>/branches/<branch>/protection`（404 = 未保护；注意 `gh api` 的 404 响应体是合法 JSON，**判定要看退出码**，别看输出能不能解析） |
| 查 auto-merge | `gh api repos/<o>/<r> --jq .allow_auto_merge` |
| 查 PR 检查名 | `gh api repos/<o>/<r>/commits/main/check-runs --jq '[.check_runs[].name]\|unique'` |
| 全机扫描 | 遍历 `~/Developer/*/`：`git -C <dir> remote get-url origin` 提取 `owner/repo`，再逐个查保护 |
| 紧急关闭（管理员逃生门） | `gh api -X DELETE repos/<o>/<r>/branches/<branch>/protection` |

## 与技能的关系

commit skill 已按「有无保护」分流（原话：「**仅当远端 main 无分支保护时这条直推通道可用**；已开保护的仓库 push 会被拒 → 第 8 步自动走 PR 兜底通道」），**开保护不需要改技能**。本文件补的是「哪些仓库处于哪种状态」这个事实来源。
