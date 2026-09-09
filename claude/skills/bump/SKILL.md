---
name: bump
description: 发版前的版本号 bump 专用流程：对齐 main → 在 main 上直接改齐所有版本号文件（VERSION/package.json/CHANGELOG/README 徽章等）→ 指引 git add + /commit 直推 main。当用户说 bump 版本、升级版本号、准备发版、发版前对齐版本、/release 前需要 bump 时必须使用。不负责打 tag 与发 Release（/release 职责）；不在功能分支上 bump（并行冲突纪律——功能分支永不碰版本号）。
---

# Bump：发版前的版本号对齐（三段式发版的第一段）

职责边界（三段式；2026-09-07 用户修订：bump 属普通文件处理修改——不新增测试用例、不碰核心功能，不走 dev-workflow，直接在 main 上改、`/commit` 直推）：

| 段 | 动作 | 执行者 |
|---|---|---|
| ① `/bump` | 对齐 main → 在 main 上改齐版本号 → 指引 `git add` + `/commit`（main 直推） | 本 skill |
| ② `/commit` | commit + push 直推远程 main（main 不设分支保护，2026-09-07 起） | commit skill |
| ③ `/release` | 在最新 main 上打 tag + 发 Release | release skill |

为什么直接在 main 上改：版本号文件属普通文件修改，按 dev-workflow 适用范围（仅存在测试用例的软件开发项目的核心改动走分支 + PR）不走分支流程；main 不设分支保护、不限制直接 push，直改直推最简。功能分支永不 bump 的纪律不变——多个并行分支各自 bump 必然冲突，版本号只在发版时于 main 统一改。

## 执行流程

1. **对齐 main**：`git switch main && git pull --ff-only`。
   - 本地 main 与远端分叉（本地领先 / 历史不一致）→ **暂停报告**，等用户确认对齐方式（如 `git reset --hard origin/main`，重置需征得同意）；
   - 用户在功能分支上触发 `/bump` → 提示：先切回 main（版本号不写在功能分支上）；该功能分支的改动应经自己的 PR 进 main 后再 bump。
2. **判定新版本号**（发布状态必须实测，不凭 VERSION / CHANGELOG / commit 历史推断）：
   - 实测最新已发布版本：`gh release list --limit 1`（或 `gh release view v<版本>` 查重）；
   - **CHANGELOG 顶部条目的版本号高于已发布版本** → 新版本号 = 该条目版本号（CHANGELOG 已定稿，bump 只做各文件对齐）；
   - **无待发布条目** → 从当前 VERSION 起按待发布改动性质定幅度（新增功能 → minor；仅修复 / 文档 → patch；build 号体系按既有序列 +1，如 `3.8.1-32` → `3.8.1-33`），并在 CHANGELOG 顶部**新建**该版本条目（`## [<新版本号>] - <今天日期>`，依据近期 commit 补简要摘要；不改已发布版本的历史条目）。
3. **在 main 上改齐版本号**（以新版本号同步所有版本号载体，存在的才改）：
   - `VERSION`（纯数字 + 换行，无 `v` 前缀）；
   - `package.json` 顶层 `version`；`package-lock.json` **顶层** `version`（不动 packages 内依赖版本）；
   - CHANGELOG 顶部条目版本号与日期（第 2 步已定）；
   - 主 manifest：`manifest.json` / `pyproject.toml` / `Cargo.toml` / `*.csproj`；
   - README（`README.md` / `README_cn.md`）**显式声明当前版本**的文字与版本徽章里的版本号（不抓 changelog 历史版本、不抓依赖版本）；安装命令用固定 tag URL（`releases/download/<tag>/<asset>`）的，其版本号（tag 段与资产名）一并同步到新版本——遇到 `releases/latest/download/` 形式的存量链接顺手改为固定 tag 形式（latest 指针随发布移动、资产名带版本号，历史链接必 404，2026-09-08 用户裁定弃用，规范详见 release skill「安装链接」一节）。
   - 项目无 `VERSION` 文件而以 package.json 为版本源时，跳过 VERSION（不强制创建——创建属 commit skill 第 9m 的职责范围）。
4. **指引用户提交**（本 skill 不执行 `git add` / `git commit`——暂存区与提交授权纪律）：

   ```
   git add <改动文件清单>
   /commit    （commit skill 自动：commit → push 直推 main）
   ```

5. **汇报**：新版本号与幅度判定依据（CHANGELOG 定稿 / 待发布改动性质）、改动文件清单（旧值 → 新值）、下一步（`git add` → `/commit` 直推 → 确认 main 已含 bump 后执行 `/release`）。

## 边界

- 不打 tag、不发 Release（`/release` 职责，且 `/release` 会自行对齐 main 并校验）；
- 不在功能分支上 bump、不修改 CHANGELOG 已发布版本的历史条目；
- 改动只限版本号载体文件（VERSION / package.json / package-lock.json / CHANGELOG 版本条目 / manifest / README 版本声明与徽章），不夹带其它改动。
