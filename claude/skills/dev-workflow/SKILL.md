---
name: dev-workflow
description: 软件开发项目的核心功能开发循环（远端 main 分支保护 + 功能分支 + PR + CI 门禁；2026-09-21 三次修订定稿：GitHub Issue 作需求端（fixes #N 合并自动关闭）、测试开发分离 + 测试先行（测试 Agent 主通道出题，先红后绿，开发对测试文件全量只读可运行、hook 强制禁止增删改）、CI 绿即 auto-merge 合并（合并由 CI 独裁）、用户验收是过程（试用预发布版本，体验即验收）、试用满意才正式发版）。当用户在软件开发项目上要开发新功能、修 bug、修改核心功能代码，或提到开发工作流、dev-workflow、开分支、建分支、worktree、全量测试、测试用例、测试先行、TDD、PR、CI、Issue、合并回 main、预发布时必须使用——即便项目本身是软件项目，也要先判断这次需求是不是核心开发（判断标准见第 0 步）；项目尚无 Issue 需求记录或尚无测试不是绕过本流程的理由——此时同样必须使用，相应门禁会阻塞并引导补齐。杂事（文档、README、版本号 bump（/bump）、配置调整等不触碰核心功能代码运行行为的改动）不走本流程的测试门禁，但 main 已锁定直推，杂事同样经轻量分支 + PR + CI 进 main。
---

# 开发工作流：远端 main 保护 + 测试先行 + PR + CI 门禁（核心开发专用）

核心逻辑：**main 必须永远绿，正式发布的版本必须是用户使用验收过的**。remote main 分支锁定（分支保护：禁止直推，一切经 PR）；**需求端是 GitHub Issue**——遇到问题 / 想要功能随手开 Issue（复现步骤 / 预期行为，就是测试的雏形），有空再解决；**测试开发分离 + 测试先行**——测试（用例）由测试 Agent（Hopper，主通道）基于 Issue 在功能分支上先写出、自跑确认红（验证断言有效），开发 Agent 才开工实现到绿；开发对测试文件全量只读 + 可运行（hook 强制禁止增删改——防「改测试迁就实现」，也防写完实现补「快照式测试」把当前行为连 bug 固化进断言）；**回归防护网放远端 CI**——项目全量测试（含新测试）+ 类型检查，每次 PR、每次 main push 都跑，**CI 绿即 auto-merge 合并进 main**（合并的唯一门禁是机器门禁，不等人工）；**用户验收是过程**：CI 跑的窗口期与合并后的时间，用户安装**预发布**版本实际使用（体验即验收；配 auto-rc workflow 的项目预发布随合并自动发，未配则从功能分支手动打），用一段时间没问题才正式发版——**正式发布必须在合并进 main 之后、且以用户试用满意为前提**（`/bump` + `/release` 由用户主动触发，触发本身就是验收通过的表达）；发现问题走修复循环（新 Issue → 测试 Agent 先写失败测试 → 修复 → CI 合并 → 新预发布），正式发版推迟到满意为止。

沿革：2026-09-07 本地裁决版（无 PR 无 CI、main 可直推、本地快进合并）→ 2026-09-21 恢复远端主流模式（锁定 remote main、CI 门禁、回归防护网进 CI），同日二次修订（合并去人工门禁、验收过程化、人工门禁落点移到正式发版），同日三次修订（Issue 替代 test-cases 目录作需求端与状态机、测试 Agent 主通道出题、测试统一先行、开发对测试文件全量只读）→ 2026-09-22 预发布供料自动化（auto-rc workflow：main CI 绿自动发 rc，验收对象随合并自动就位；正式发版权仍在用户）。角色分立：**用例定义权归测试 Agent**——读 Issue 出测试、先红后绿、开发碰不了（独立会话为无测试 Agent 环境的代行选项，用户手写走授权标记）；**代码实现权归开发 Agent**——只写实现，对测试只读可运行；**合并裁决权归机器门禁**（分支保护 + CI，客观回归独裁）；**发布裁决权归用户**（试用满意才发版，主观满意把关）。

**流程总览**（各步细节见正文与 references）：

1. 第 0 步：定性——这次需求是不是核心开发
2. 第 1 步：开工门禁——Issue 与远端门禁就位
3. 第 2 步：建 worktree + 功能分支
4. 第 3 步：测试先行——测试 Agent 出测试（先红）
5. 第 4 步：开发（测试文件只读、问题终止上报、不 bump 版本）
6. 第 5 步：对齐 origin/main + 检查 Issue 与测试变更
7. 第 6 步：本地全量测试（机器门禁·预检）
8. 第 7 步：push + 建 PR（fixes #N）+ enable auto-merge
9. 第 8 步：合并后收尾（删分支、清 worktree、同步）
10. 第 9 步：使用验收（预发布试用一段时间，配 auto-rc 时随合并自动发；发现问题 → 修复循环）
11. 第 10 步：正式发版（用户满意 → `/bump` + `/release`；人工门禁落点）

## 第 0 步：定性——这次需求是不是核心开发

项目是软件项目 ≠ 这次需求就是核心开发。每次触发先判断：**改动会不会触碰核心源代码的运行行为**——是则走本流程（行为改动必须有测试锁定，这是回归防护网完备性的底线）；纯文档、README、版本号、格式调整是杂事，走杂事通道：**建 `chore/<事项>` 分支 → 改 → 用户自行 `git add` + `/commit`（push + 建 PR + enable auto-merge）→ CI 绿自动合并**。main 已锁定直推（2026-09-21 起），杂事不再有「main 直改直推」通道，同样经 PR + CI——杂事改动也过回归防护网（防止文档改动意外碰坏东西）。配置类改动按影响判断：改变运行行为的（构建配置、依赖版本）从严走本流程；不改变的当杂事。拿不准时**从严走本流程或直接问用户**，宁重勿漏。

混合需求（核心功能 + 顺带文档）正常走本流程：琐碎文件修改不作为分支的开发目标，但功能开发必须同步的文档（README、CHANGELOG）在分支上顺带改是允许的，不算违规。

## 第 1 步：开工门禁——Issue 与远端门禁就位

两项都检查（Issue 以远端为准：`gh issue view <N>`）：

1. **Issue 就位**：本次需求有 open 的 GitHub Issue，正文写清**复现步骤 / 预期行为**（bug 给复现，功能给预期）——它同时是需求文档、验收标准、测试的雏形。没有 Issue → 阻塞，请用户开 Issue（`gh issue create`，可由会话代为执行、内容以用户口径为准——需求端的话语权在用户，开发不代定验收标准）。Issue 含糊（复现缺失、预期不明）→ 先在 Issue 评论里与用户澄清补全，再继续。**测试规模与需求体量匹配**：小 bug 一条聚焦断言，大功能成组用例——测试 Agent 出题时把握。
2. **远端门禁就位**（一次性基础设施，就位后后续开发不再检查）：
   - **main 分支保护已开启**：禁止直推（含管理员，不开 bypass）、必须经 PR、CI 状态检查设为 required、合并前要求分支最新（up-to-date）、只允许 squash 合并。未开启 → 列配置清单请用户开启，或经用户同意用 `gh api` 配置（rulesets / branch protection API）；**首次启用顺序：先让 ci.yml 经 PR 进 main，再开保护并把 checks 设 required**——反序会死锁（required check 从无成功记录，任何 PR 永远不满足）。完整配置与顺序论证见 `references/merge-discipline.md`。
   - **CI workflow 就位**：`.github/workflows/ci.yml` 触发器含 `pull_request`（目标 main）与 `push`（main），执行内容覆盖「项目全量测试 + 类型检查」（测试在项目正式测试位置，全量测试天然含它们）。缺失或不达标 → 阻塞，按 `references/test-cases.md` 的「CI 集成」一节补齐。项目没有 CI 不是绕过的理由，正如没有 Issue 不是绕过的理由。
   - **自动预发布 workflow（可选增强，推荐）**：`.github/workflows/auto-rc.yml`——main 的 CI 全绿后自动打 `v<目标版本>-rc.N` tag 发 `--prerelease` Release，把 CI 测过的内容自动交到用户手里试用（第 9 步验收的预发布版本随每次合并自动就位，修复循环的 rc.N+1 也随之自动来）。模板与两个定制点（workflow 名与 ci.yml 一致、构建命令按项目改）见 `assets/auto-rc.yml`；机制与规矩见 `references/acceptance.md` 预发布一节。未配它时预发布走手动通道（第 9 步），不是阻塞项。

## 第 2 步：建 worktree + 功能分支

```bash
cd <主仓库目录> && git switch main && git pull --ff-only
git worktree add ../<仓库名>-<功能名> -b <分支名>    # 并行开发（推荐）
# 或不并行时：
git switch -c <分支名>
```

分支必须从最新 main 开出。分支命名收敛为 `feat/<功能>` / `fix/<缺陷>` / `chore/<事项>`（杂事）+ 小写短横线描述（如 `feat/model-picker`）。一个分支只做一件事、只对应一个 Issue。**用户说「切分支 / 新建分支」但未说明用途时，默认创建名为 `Test` 的分支**（用户 2026-09-06 立——快速试验场景不想每次起名，不追问用途；已存在未合并的 Test 分支时报告并让用户选择复用还是换名）。

**worktree 的价值**：多个功能（多个开发会话）并行时，同一目录里的改动、`git status`、测试运行会互相污染，分不清哪份改动属于哪个功能。每个功能独占一个 worktree 目录 + 分支，天然隔离。要点：

- worktree 目录放主仓库**同级**（`~/Developer/<仓库名>-<功能名>`），不要嵌套在主仓库内（会被视为未跟踪内容，容易误提交）；
- 每个 worktree 首次进入装依赖（`bun install --frozen-lockfile` / `npm ci`），node_modules 不共享；
- 写全局共享目标的命令（如安装到系统位置的 sync 类脚本）不要在多个 worktree 并行跑；
- 一个分支同一时刻只能存在于一个 worktree。

## 第 3 步：测试先行——测试 Agent 出测试（先红）

分支建好后，**开发的开工条件是「分支上有测试 Agent 产出、且自跑见过红的测试」**——没有测试不开工（阻塞，请用户叫测试 Agent）。角色与流程见 `references/test-cases.md`（本步前读一次）：

1. 开发 Agent 向用户报告：请在测试 Agent 会话（Hopper）出测试——给它 worktree 路径 + Issue 链接（`#N`）。无测试 Agent 环境时由独立会话代行（新开会话、只喂 Issue 与 worktree 路径——测试先行的分支上实现尚不存在，出题上下文天然无实现可见，这正是先行的结构优势）。
2. 测试 Agent 读 Issue → 用项目现有测试框架在**项目正式测试位置**写测试（带 `# TEST_CASES_WRITE_OK` 标记写入，hook 对无标记的写操作照拦）→ **自跑确认红**（实现还不存在，断言必红——这一跑验证的是「断言真的在测东西」，防止永真断言）→ 交付自检全过后报告用户（列明应 `git add` 的路径与改动摘要），commit 由用户亲自执行（自行 `git add` + `/commit`，2026-09-22 用户定，见「git / gh 授权边界」）。
3. 测试就位后开发 Agent 接手同一分支。**测试文件从这一刻起对开发只读 + 可运行**（见第 4 步纪律 1）。

**为什么测试先于实现**：写测试时实现不存在，只能按 Issue 的预期行为出题（防「照实现现状写断言」）；先红后绿验证断言有效性；需求被迫前置澄清（测试写不下去 = Issue 没写清，回第 1 步澄清而不是硬写）。

## 第 4 步：开发中的纪律

1. **测试文件全量只读 + 可运行，禁止增删改**：一切测试文件（测试目录 `test/` `tests/` `__tests__/` `spec/` `e2e/`、`*.test.*` `*.spec.*` `test_*.py` `*_test.go` `conftest.py` 等，含存量 `test-cases/`）只能读和执行，不能新建、修改、删除、移动——包括补测试也不行（测试归测试 Agent，防「写完实现补快照式测试把当前行为连 bug 固化进断言」）。本条已配套工具强制：跨端 hook（CC / ZCode / CodeBuddy / Trae 四端共用 `~/.claude/hooks/test-cases-guard.py`，pi 端 `~/.pi/agent/extensions/test-cases-guard.ts`）直接拦截指向测试目标的写操作（被 deny 时按提示走合规通道，不要绕过），见 `references/test-cases.md`。
2. **碰到测试或需求有问题 → 终止开发，向用户汇报**：具体问题（测试跑不起来、断言疑似与 Issue 预期不符、Issue 含糊不清）+ 建议，请用户对齐：改 Issue（编辑 / 评论澄清）→ 测试 Agent 按新 Issue 改测试 → 开发继续。绝不通过改测试来绕过问题——这是 LLM 的著名失败模式（改不动代码就放宽断言），本流程从结构上禁掉它。
3. **版本号不在功能分支 bump**：多个并行分支各自 bump 必然冲突，正式版本号递增由发版流程统一处理（`/bump` 经 bump 分支 + PR 改齐后进 main）。预发布 tag 的后缀版本号（`-rc.N` / `-beta.N`）只存在于 tag 与 Release 层面，不写进版本文件——同样不违反本条。
4. **CHANGELOG 条目写在自己的段落**：记录「为什么改 + 改了什么」；不同分支写的条目落在不同位置，git 能自动合并。避免和别的分支同时新建同一个版本标题。

## 第 5 步：对齐 origin/main + 检查 Issue 与测试变更

功能开发完成后，把远端 main 合进当前分支：

```bash
git fetch origin && git merge origin/main
```

注意基准是 `origin/main` 而非本地 main——远端是权威（本地 main 可能落后，且合并动作发生在远端 PR）。merge 后**必查两件事**：

1. **Issue 有没有变**：`gh issue view <N>` 对比开发期间 Issue 有没有编辑 / 评论补充（需求变了实现要跟上——开发期间需求悄悄变了而实现还照旧，是隐性返工的最大来源）；
2. **分支上的测试有没有变**：测试 Agent 有没有更新测试 commit（变了先重新对齐理解，再进下一步）。

有冲突照常解决，解决结果会被本地全量测试 + 远端 CI 双重覆盖验证。

## 第 6 步：本地全量测试（机器门禁·预检）

在分支上本地跑项目全量测试：**项目全部测试（含测试 Agent 先行写的新测试）+ 类型检查**（如 `bun test` / `npm test` + `tsc --noEmit`，按项目技术栈）。口径就一条：**全绿**——新测试从红转绿（本次目标）+ 既有测试保持绿（回归防护）。

本地预检的价值是**快速反馈**：红灯本地修，省「push → CI 红 → 拉日志 → 修复 → 再 push」的往返。**权威裁决在第 7 步的远端 CI**——本地绿不豁免 CI（同一口径双跑，环境差异由 CI 的干净环境兜底）。红灯是分支上的正常工作状态（不是事故——main 红才是事故），修到绿再 push。注意：红灯若是**测试本身的问题**（断言与 Issue 预期不符），走第 4 步纪律 2 的终止上报通道，不是改实现迁就测试、更不是改测试。

## 第 7 步：push + 建 PR（fixes #N）+ enable auto-merge

本地全绿后：

```bash
git push -u origin <分支名>
gh pr create --base main --title "<标题>" --body "fixes #<N>

<摘要>"
gh pr merge <分支名> --squash --auto --delete-branch    # enable auto-merge
```

- PR 描述带 `fixes #<N>`——**合并时 GitHub 自动关闭对应 Issue**（测试与实现同 PR 进 main，Issue 状态机随之闭环，无需任何归档动作）。
- PR 建立即触发远端 CI（`pull_request` 触发），在 GitHub 干净环境跑第 6 步同一套全量；**CI 绿后 GitHub 自动 squash 合并进 main、删除远端分支**——合并的唯一门禁是 CI（不等人工验收）。复杂项目 CI 可能较慢，这个等待窗口正好先走第 9 步的预发布（rc.1），让用户开始试用。
- CI 红 → 拉日志定位（`gh pr checks --watch` / `gh run view --log-failed`）→ 本地修复 → 用户自行 `git add` + `/commit`（commit + push 一条龙，AI 不代行 commit）→ CI 对新 head 自动重跑（auto-merge 在最终绿掉的那次 head 上执行）。
- squash 合并后 main 新 commit 的树 == PR head 的树（squash 只压缩提交历史、不改文件内容）——「合并进 main 的内容 == CI 测过的内容」的物理基础（完整论证见 `references/merge-discipline.md`）。
- 合并后 main 上的 CI（`push` 触发）再跑一遍全量——最终确认 + 回归防护网持续生效（新测试从此常驻防护网）。
- 开发过程的 push 属本 skill 流程内授权；**commit 不论分支 / worktree / 流程一律由用户亲自执行**（自行 `git add` + `/commit`，AI 不申请授权、不代行——2026-09-22 用户定，见「git / gh 授权边界」）；杂事 / bump 分支的提交推送走 `/commit`（push 后顺手建 PR + enable auto-merge）。

## 第 8 步：合并后收尾

CI 绿、auto-merge 完成后（Issue 已由 `fixes #N` 自动关闭；配了 auto-rc 的项目：合并后的 main push CI 再跑一遍全量、绿后自动发新 rc 供试用，见第 9 步）：

1. **清理 worktree**：`cd <主仓库目录> && git worktree remove ../<仓库名>-<功能名>`（测试包产物放 worktree 的 tmp/ 下，随 worktree 一起清）；远端分支已随 `--delete-branch` 删除，本地分支确认已合并后 `git branch -d <分支名>`。
2. **同步其它活着的 worktree**：本次功能合并进 main 后，在各 worktree 目录 `git fetch origin && git merge origin/main`——早对齐，冲突小；分支活得越短，冲突窗口越小。

## 第 9 步：使用验收（过程，不是瞬时门禁）

用户以**实际使用**验收：安装预发布版本用一段时间（小时到天级），按 Issue 正文（复现步骤 / 预期行为）逐条核对 + 体验界面、手感、文案这些难以用例化的维度。**验收是过程**：CI 与合并不等它（机器门禁独裁合并），正式发版等它（用户试用满意才发）。开发 Agent 在此阶段待命接反馈、执行修复循环、按用户指示发新预发布。

- **预发布（主通道）**：走真实发布链路验收（`--prerelease` 标记的 GitHub Release，用户从 Release 页安装），兼供早期尝鲜；预发布一律不 bump 版本文件。两条供料通道：
  - **自动（配了 auto-rc workflow 的项目，推荐）**：合并进 main 的 CI 全绿后自动打 `v<目标版本>-rc.N` tag 发 Release——验收对象随每次合并自动就位，修复循环的递增预发布号（rc.2、rc.3…）也自动随之而来，AI 与用户都无需手动发。合并前想更早开始试用（CI 慢的窗口期）可手动从功能分支发（见下条）。
  - **手动（未配 auto-rc，或合并前提前试用）**：从功能分支（合并前）或 main（合并后、带修复）打 `v<目标版本>-rc.N` / `-beta.N` 的 prerelease tag，产物从对应分支构建；操作规范见 release skill 预发布通道。
  - 完整规矩（版本号推导、notes、试用处置）见 `references/acceptance.md`（进本步前读一次）。
- **发现问题 → 修复循环**：开新 Issue（或复用原 Issue 评论跟进）→ 测试 Agent 先写失败测试（复现新问题，先红）→ fix 分支实现到绿 → push + PR + enable auto-merge（CI 绿合并）→ 递增预发布号（rc.2）再试用。修复期间 main 持续前进是正常的——CI 保证每一步都绿，用户验收的对象是「试用中的预发布版本 + 持续演进的现实」，不是某个冻结时点。
- **本地测试包（轻量选项）**：快速冒烟（构建验证 + 即时装）用本地构建的测试包装 worktree 的 tmp/ 即可，规矩见 `references/acceptance.md`；完整验收以预发布为主。
- **需求本身要变**（用户用完想改主意）→ 更新 Issue（编辑 / 评论写清新需求与新验收标准）→ 测试 Agent 按新 Issue 重出 / 改测试（出题上下文不能见过实现——测试 Agent 的会话天然满足）→ 迭代走新一轮分支循环。需求变更不经这条通道、开发 Agent 自己揣摩着改，会做成「没人定义过的需求」。

## 第 10 步：正式发版（人工门禁的落点）

用户试用满意、决定正式发版：**`/bump`**（建 bump 分支改齐版本号 → `git add` → `/commit`（push + 建 PR + auto-merge）→ CI 绿合并进 main）→ **`/release`**（在 main 上打正式 tag + 发 Release）。两者都由用户主动触发，**触发本身就是验收通过的表达**——人工门禁从「合并前」移到「发版前」（2026-09-21 用户定）：CI 管客观回归、独裁合并；人管主观满意、把关发版。**正式发布的版本 = 用户使用验收过的 main 快照**——合并进 main 不等于发布，中间隔着试用与发版决定。

## git / gh 授权边界（与全局纪律衔接）

**触发本 skill（用户要求开发核心功能）= 授权流程内的本地与远端编排操作**：`git worktree add` / `git switch -c` / `git merge origin/main`（对齐）/ `git push`（功能分支）/ `gh pr create` / `gh pr merge --squash --auto --delete-branch`（enable auto-merge 是标准动作——合并由 CI 门禁独裁，无需用户逐次点头）/ `gh issue create`（代为执行，内容以用户口径为准）/ `git worktree remove`，以及本地测试与构建、预发布 tag + `gh release create --prerelease`（第 9 步验收来源）。**`git commit` 不在授权清单内——AI 一律不代为执行 commit**（2026-09-22 用户定：commit 动作由用户亲自完成——自行 `git add` 后触发 `/commit`（commit + push + PR auto-merge 一条龙）；AI 不向用户申请 commit 授权、不代行 commit，职责是在交付报告中列明应 `git add` 的路径与改动摘要，并确保所需 commit 功能在 `/commit` skill 覆盖范围内——发现缺口先补 skill 而不是申请代行。含测试 Agent 出题后的 commit 与 CI 红修复循环的 commit，同走此通道；2026-09-21 版「须用户明确授权后 AI 执行」表述随之收敛为常态只走用户 `/commit`）。**不改写 main 历史、不 force push、不触碰暂存区**（全局纪律不变；用户 `/commit` 前自行 `git add`，暂存区由用户亲自把关，skill 只提交暂存区内容）。杂事 / bump 分支的 commit + push 走 `/commit`（用户自行 `git add` 后触发，push 后顺手建 PR + enable auto-merge）；正式发版走 `/bump` + `/release`（用户主动触发即授权）。

## references（按需加载）

- `references/test-cases.md` — 测试体系全貌：测试 Agent 出题（主通道 / 独立会话代行）、测试先行时序、测试文件位置与权限（hook 强制）、Issue 作为需求端、CI 集成规范、存量 test-cases/ 迁移。**第 3 步测试先行前读。**
- `references/acceptance.md` — 预发布试用与发版验收的完整规矩（验收作为过程、修复循环、本地测试包选项）。**第 9 步进验收前读。**
- `references/merge-discipline.md` — PR 合并纪律：角色与门禁分工、分支保护配置与首次启用顺序、并行 PR、squash 树等价、修复循环。**第 7 步遇 CI 红 / 合并被挡、第 9 步修复循环时读。**
