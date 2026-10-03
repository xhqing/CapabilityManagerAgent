---
name: bump
description: 发版前的版本号 bump 专用流程：对齐 main → 建 bump 分支改齐所有版本号文件（VERSION/package.json/CHANGELOG/README 徽章等）→ 自动衔接 /add（预检 + git add，候选为本次改动文件；预检完全干净时继续自动衔接 /commit → PR + CI 合并 → 自动衔接 /release 完成发版，2026-10-02 起）。当用户说 bump 版本、升级版本号、准备发版、发版前对齐版本、/release 前需要 bump 时必须使用，或由 commit skill 第 10 步检测出「需要 bump」时自动衔接（不询问、不提示）。不负责打 tag 与发 Release（/release 职责）；不在功能分支上 bump、不直接 push main（remote main 已锁定直推，2026-09-21 起 bump 经 PR + CI 进 main）。
---

# Bump：发版前的版本号对齐（三段式发版的第一段）

职责边界（三段式；2026-09-21 修订：remote main 恢复分支保护、锁定直推，bump 从「main 直改直推」改为「bump 分支 + PR + CI」——与 dev-workflow 2026-09-21 版对齐）：

| 段 | 动作 | 执行者 |
|---|---|---|
| ① `/bump` | 对齐 main → 建 bump 分支改齐版本号 → **自动衔接 `/add`**（预检 + git add）→ 预检完全干净时继续自动衔接 `/commit`（push + 建 PR + auto-merge，2026-10-02 起） | 本 skill |
| ② CI | 远端 CI 跑全量，绿后 GitHub 自动 squash 合并进 main | GitHub Actions |
| ③ `/release` | 在最新 main 上打 tag + 发 Release（2026-10-02 起由 commit skill 第 10 步自动衔接） | release skill |

为什么走分支 + PR：main 已锁定直推（2026-09-21 起），版本号文件改动与其它内容一样经 PR + CI 进 main——CI 顺带验证 bump 没碰坏任何东西（版本文件也是回归面）。功能分支永不 bump 的纪律不变——多个并行分支各自 bump 必然冲突，版本号只在发版时经 bump 分支统一改。

## 执行流程

1. **对齐 main**：`git switch main && git fetch origin && git pull --ff-only`（以 origin/main 为准）。
   - 本地 main 与远端分叉（本地领先 / 历史不一致）→ **暂停报告**，等用户确认对齐方式（对齐操作由用户执行或明确授权，本 skill 不自行 reset / force）；
   - 用户在功能分支上触发 `/bump` → 提示：先让该功能分支的 PR 合并进 main（版本号不写在功能分支上），再来 bump。
2. **建 bump 分支**：`git switch -c chore/bump-v<目标版本>`（从最新 main 开出）。
3. **判定新版本号**（发布状态必须实测，不凭 VERSION / CHANGELOG / commit 历史推断）：
   - 实测最新已发布版本：`gh release list --limit 1`（或 `gh release view v<版本>` 查重）；
   - **CHANGELOG 顶部条目的版本号高于已发布版本** → 新版本号 = 该条目版本号（CHANGELOG 已定稿，bump 只做各文件对齐）；
   - **无待发布条目** → 从当前 VERSION 起按待发布改动性质定幅度（新增功能 → minor；仅修复 / 文档 → patch；build 号体系按既有序列 +1，如 `3.8.1-32` → `3.8.1-33`），并在 CHANGELOG 顶部**新建**该版本条目（`## [<新版本号>] - <今天日期>`，依据近期 commit 补简要摘要；不改已发布版本的历史条目）。
4. **在 bump 分支上改齐版本号**（以新版本号同步所有版本号载体，存在的才改）：
   - `VERSION`（纯数字 + 换行，无 `v` 前缀）；
   - `package.json` 顶层 `version`；`package-lock.json` **顶层** `version`（不动 packages 内依赖版本）；
   - CHANGELOG 顶部条目版本号与日期（第 3 步已定）；
   - 主 manifest：`manifest.json` / `pyproject.toml` / `Cargo.toml` / `*.csproj`；
   - README（`README.md` / `README_cn.md`）**显式声明当前版本**的文字与版本徽章里的版本号（不抓 changelog 历史版本、不抓依赖版本）；安装命令用固定 tag URL（`releases/download/<tag>/<asset>`）的，其版本号（tag 段与资产名）一并同步到新版本——遇到 `releases/latest/download/` 形式的存量链接顺手改为固定 tag 形式（latest 指针随发布移动、资产名带版本号，历史链接必 404，2026-09-08 用户裁定弃用，规范详见 release skill「安装链接」一节）。
   - 项目无 `VERSION` 文件而以 package.json 为版本源时，跳过 VERSION（不强制创建——创建属 commit skill 第 9m 的职责范围）。
5. **自动衔接 /add（2026-10-02 用户立）**：本 skill 改完版本号文件后，**直接进入 add skill 完整流程**——以第 4 步的「改动文件清单」为候选集（只处理 bump 改动的版本号载体文件、不扫工作区其它改动）：
   - add 预检（gitleaks + AI 语义扫描）**完全干净** → add skill 按其第 7 步继续自动衔接 commit skill（push bump 分支 + 建 PR + enable auto-merge → 9z 等待 CI 合并、对齐本地 main → 第 10 步自动衔接 `/release` 完成发版）——整条链自动跑完；
   - **有任何「需人工过目」/「不建议入库」内容** → 链条停在 add 报告阶段（干净文件已入暂存区），等用户处理后再推进（重新 `/add` 或 `/commit`）；
   - 本 skill 自身仍不执行 `git add` / `git commit`（由 add / commit skill 按各自授权执行）；
   - **逃生口**：用户当轮明确说「只 bump、不要提交」时，不衔接、按旧例输出以下指引供用户手动执行：

   ```
   git add <改动文件清单>
   /commit    （commit skill 自动：commit → push chore/bump 分支 → 建 PR）
   ```

6. **链条中的 auto-merge**：commit skill 建 PR 时已顺手 enable auto-merge（`gh pr merge --squash --auto --delete-branch`）——CI 绿 + up-to-date 后自动合并进 main；本 skill 不重复操作。若 auto-merge 被挡（分支冲突 / 分支过期），按 commit 汇报的提示处理。
7. **汇报**：新版本号与幅度判定依据（CHANGELOG 定稿 / 待发布改动性质）、改动文件清单（旧值 → 新值）；并说明已自动衔接 `/add`（→ `/commit` → `/release`）链条——提交推送、PR、CI 合并、自动发版的结果连在本次汇报中一并呈现（无需手动 `/add`、`/commit`、`/release`，2026-10-02 起）。

## 边界

- 不打 tag、不发 Release（由链条中的 commit skill 第 10 步自动衔接 `/release` 完成——2026-10-02 起；`/release` 会自行对齐 main 并校验）；
- 不在功能分支上 bump、不直接 push main（远端已锁定，2026-09-21 起）、不修改 CHANGELOG 已发布版本的历史条目；
- 改动只限版本号载体文件（VERSION / package.json / package-lock.json / CHANGELOG 版本条目 / manifest / README 版本声明与徽章），不夹带其它改动。
