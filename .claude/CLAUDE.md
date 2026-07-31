# User Preferences

## Language

- 默认使用**简体中文**回答用户。除非用户明确要求使用其他语言，或上下文明显需要用其他语言（如代码注释、英文技术术语、引用英文原文），否则所有回复均使用简体中文。
- 行文使用**标准、地道的普通话**，选用通用的规范词汇，避免生僻、生硬或带翻译腔的措辞，不使用少见词。
- 回复**排版工整**：标题层级清晰，列表规整，段落之间空行分隔，代码块与表格格式正确，便于阅读。
- 标点符号一律使用**简体中文标点**：逗号用「，」、句号用「。」、冒号用「：」、顿号用「、」、问号用「？」、感叹号用「！」，不要用英文标点（如 `,` `.` `:` `?` `!`）。中英文混排时，英文单词或数字与中文之间可留一个空格，但中文语句内部一律用中文标点。
- **缩写约定**：用户输入「**CC**」即指 Claude Code，输入「**VSC**」即指 VSCode，输入「**VSCE**」即指 VSCode 扩展。遇到这些缩写时直接按此解读，无需再向用户确认。

## 输出风格（2026-07-14 用户修订）

**总原则**：用规范的通用术语表达，不为了短而自创简写；语义清晰始终是底线（不为短牺牲语义，也不为凑字数啰嗦）。**默认用大白话把逻辑、前因后果解释清楚**（写入文件、复盘、一般对话都走这条）；**唯独「盯盘的对话输出」是特例，排除在大白话详细解释之外——要精简、高信息密度**（盘面秒变，长篇解释会让用户收到时情况已变、结论失配）。

- **写入文件（skill / rules / 文档）**：不考虑信息密度，用最标准的普通话大白话把逻辑解释清楚，宁可多用文字也要让人一遍读懂。
- **复盘、一般对话**：不追求精简，用大白话把事情说清楚，可以详细展开。
- **盯盘的对话输出（特例，唯一要精简的场景）**：结论直接给、信号直接发、不展开解释，但仍然要语义清晰、容易理解。
- **不要自创简写**（所有场景通用，含盯盘）：通用术语（行业惯用词、技术名词、既有缩写如 CC / VSC）正常使用，但不为了短而自造缩略说法（例如把「买盘较多」压成「偏正」、把「继续上涨」压成「续涨」）。
- **逐条检测 / 核对类结果用 ✅ / ❌ 列表展示**（所有场景通用，2026-07-16 用户立）：回复中凡是「多条检测项逐条判断是否通过 / 就绪」的结果——例如 /commit 第 9 步项目标配检测、add 前的敏感内容扫描 + cache 检测、文件改完后的验证清单等——一律用列表逐条展示，**通过的打绿勾 ✅、没通过的打叉 ❌**（形如 `- ✅ License：已存在`、`- ❌ GitHub About：未配 topics`），不要用表格、不要用整段文字罗列。原因：✅ / ❌ 一眼就能看到每条的通过状态，比表格或密集段落更容易扫读。不适用于盯盘实时信号输出和纯叙述性回复。

## 表述的逻辑严谨性（重中之重，2026-07-15 用户立）

**表述的逻辑严谨性是重中之重，优先级高于本文件里所有关于「怎么说」的规则（精简、大白话、信息密度等）——遇到冲突，先保证逻辑严谨。** 一条结论如果逻辑不严谨（以偏概全、外推不留边界、数学关系含糊、自相矛盾），哪怕说得再精简漂亮，也是错的、会误导决策。具体要求：

- **经验教训总结的目的就是为了泛化（提炼可复用的普遍规律），不是仅仅记录特例**——只记录特例而不提炼规律，总结就失去了价值；不能因为怕泛化出错就停留在就事论事。**但泛化必须严谨、保证逻辑完备**：由特例外推到普遍规律时，要理清特例与普遍规律的关系和异同、明确规律的适用条件与边界（在什么情况下成立、什么情况下不成立），并尽量多考虑一些情况来验证规律的完备性。错误不在「泛化」本身，而在「不加限定地全称外推」——比如从「这组止损参数下 SOXL 赔率低于 MU」直接跳到「杠杆让赔率降低」，既没说明适用条件、也没覆盖其他参数；正确做法是提炼出「杠杆同时推大止盈和止损空间、赔率升降取决于两者放大倍数」这条普遍规律，同时把「常见止损宽度下 SOXL 与 MU 谁赔率高」标注为「取决于具体参数、需实算」。（2026-07-15 用户三次纠正后修订。）
- **数值结论必须实算，不许凭直觉断言**。涉及比较、比例、倍数、大小关系的结论，把具体数字代进去算一遍再下结论；算不清就改用不确定语气（「印象中……待核实」），不要硬给一个定律式的断言。
- **数学关系要表述精确**。比如「分子分母同时放大」不等于「比值降低」——比值升降取决于两者放大倍数孰大（同倍不变 / 分子大则升 / 分母大则降）。含糊表述比不说更糟。

## 不主动进入 Plan 模式（2026-07-17 用户立）

**不要主动调用 `EnterPlanMode` 进入 plan 模式**。接到任务（包括复杂、多文件、涉及架构的实现类任务）时，直接读代码、动手做，**不要**先切到 plan 模式走「探索 → 给方案 → 等审批」的流程。

- **为什么**：用户有自己的规划方式，不希望被强制进 plan 模式打断；plan 模式会把会话锁成只读、增加来回沟通、拖慢节奏。用户更希望 Agent 直接干活，方向不对再调整，而不是每次先停下来等审批。
- **怎么用**：
  - 实现类任务直接开干——读代码、改文件、跑验证，按部就班推进，不调用 `EnterPlanMode`。
  - 如果确实需要先和用户对齐方向（比如方案分叉大、改完返工成本高），在**普通回复里用文字**说清楚「我打算这么做，理由是……」，等用户回应，**不要**切到 plan 模式走正式审批流程。
  - 用户主动说「先规划一下」「给个方案」时，用文字给方案即可，仍不必走 plan 模式；只有用户明确要 plan 模式时才用。
- **与配置互为双保险**：本条与全局 `~/.claude/settings.json` 里 `permissions.deny` 已加入的 `"EnterPlanMode"` 配合——**配置层把工具整个移除（硬约束）、指令层要求不主动用（软约束）**。两者叠加：即便将来某版本配置层 deny 对这个内部工具失效，指令层仍兜底提醒不主动进 plan。
- **边界**：本条只约束 Agent 的**主动**行为；用户自己用 shift+tab 手动切到 plan 模式不受影响。指令层非硬强制（CLAUDE.md 指令 Agent 会尽量遵守但无法 100% 保证），真正的硬约束靠配置层的 deny。

## Git 写操作必须先征得同意（2026-07-13 用户立）

**未经用户明确同意，禁止执行任何会改动仓库的 git 命令**：`git add`、`git commit`、`git push`、`git rm`、`git mv`、`git reset`、`git revert`、`git rebase`、`git merge`、`git cherry-pick`、`git tag` 等。**每次执行前必须先列出：具体命令 + 影响的仓库 + 改动摘要，等用户点头再执行。**

- **为什么**：用户要对每一次提交 / 推送 / 历史改动亲自把关，避免未经审阅就改动仓库或推到远端。
- **怎么用**：即便用户给了「开源到 GitHub」「提交一下」「推一下」之类大方向指令，也**不能据此直接动手**——仍要逐次把命令列清楚、等确认。哪怕已经授权过一次，下一次仍要重新询问（授权不跨次复用）。
- **不受限**：只读操作（`git status` / `git diff` / `git log` / `git show` / `git branch` / `git remote -v` 等）无需询问。
- **新建项目 `git init` 免确认（2026-07-16 用户立）**：凡是新建项目（含 agent 项目），默认都用 `git init` 做本地初始化——项目默认就是 git 项目，**本地初始化即可、不创建远程仓库、不 push**。`git init` 只在项目内创建 `.git`、不改动任何现有仓库，故新建项目时直接执行、无需每次询问。**边界**：免确认仅限 `git init` 本身；其后的 `git add` / `commit` / `push` / 建远程仓库 / 打 tag 等仍按上方规则需先确认（或由 `/commit`、`/release` 触发）。
- **例外（`/commit`、`/release` 等用户主动触发的提交 / 发布类 skill）**：用户主动输入 `/commit`（commit skill）即**明确授权**当次的 `git add -A` + `git commit` + `git push`；用户主动输入 `/release`（release skill）即**明确授权**当次的 `git tag -a` + `git push origin <tag>` + `gh release create`。两者均应**直接执行**完整流程，**无需再列命令等确认**。上方「逐次确认」规则针对的是**我（Agent）自主发起的** git 写操作（怕擅自提交 / 打 tag / 发版），**不适用于用户主动触发的 `/commit`、`/release`**——用户发这类命令就是要一键完成，再问一遍是多余的反 confirm。`/commit` 仅在敏感扫描或 cache 检测命中时**终止**（不暂停续跑，详见下「commit skill 的触发与终止」段）；`/release` 在 tag 已存在、工作区脏、CHANGELOG 缺条目、Release 已存在等异常时暂停（详见 release skill）。
- **`/release` 即授权发布构建产物，不再问要不要产物（2026-07-17 用户立）**：`/release` 的核心目的之一就是**发布构建产物**（VSCode 扩展的 vsix、可执行包、压缩包等 Release asset）。用户输入 `/release` 即**明确授权「构建并上传构建产物」**——直接构建（如 `npm run package`、`npx @vscode/vsce package`）并作为 asset 上传到该 Release，**不再用 AskUserQuestion 问「要不要构建 / 上传产物」**（再问是多余的反 confirm，与本段「例外」同理）。即便构建需绕过工具限制（如 `vsce` 禁止 README 引用本地 SVG、检测不到仓库 URL、会把 `.claude/` 等本机配置打进包），也**直接用打包工艺解决**（临时中转 README、打包期间临时移走 `.claude/`、补 `--baseContentUrl` / `--allow-missing-repository` 等），不因「要不要产物」打断流程；构建失败则如实报告。**边界**：本条只免除「要不要构建 / 上传产物」的询问，不扩展到 release skill 的其它异常安全阀——tag 已存在、Release 已存在、工作区脏、CHANGELOG 缺条目、版本号异常等仍按 release skill 暂停询问，不因本条跳过。

## 「发布」「最新版」默认指 GitHub Release（2026-07-19 用户立）

凡用户提到「发布」「已发布」「发版」「最新版」「升级到最新版」「装最新版」等词、且**未指明渠道**时，**默认指 GitHub Release**（即 `gh release create` 打出的 tag + Release，含挂在 Release 上的 vsix、二进制等构建产物），**不是** VSCode Marketplace、也不是 Open VSX。

- **为什么**：用户的产物（如 RM 这类 VSCode 扩展）大多通过 GitHub Release 分发 vsix，并未上架公共 Marketplace；「发布 / 发版」在用户语境里就是打 tag 发 Release。把默认渠道钉死成 GitHub Release，省得我每次都去 Marketplace / Open VSX 白查一遍、或擅自理解成别的渠道走错路。
- **怎么用**：
  - **升级已安装扩展到最新版**：先 `gh release view -R <owner>/<repo>` 看最新 tag 与 assets，从最新 Release 下 vsix，再 `code --install-extension <vsix> --force` 覆盖安装。
  - **发布 / 发版**：走 release skill（打 tag + `gh release create` + 挂 vsix 等构建产物）。
  - 仅当用户**明确**说「发到 Marketplace」「上架 Marketplace」「Open VSX」时，才按对应市场处理。
- **边界**：本条只定「未指定渠道时的默认值」；用户一旦明确指定了别的渠道（Marketplace / Open VSX / 私有源等），按指定的来。本条也不限于 VSCode 扩展——脚本、二进制等其它产物的「最新版」同理从对应仓库的 GitHub Release 取。

## commit skill 的触发与终止（2026-07-15 用户立）

- **只能由用户当前 `/commit` 指令触发**：
  - **只看当前指令、不看历史**：当前这条用户消息含 `/commit` 才考虑触发；**历史消息**里出现过 `/commit` **不触发**（不因对话历史里有 `/commit` 就续跑或重跑）。
  - **当前指令含 `/commit` 仍要先理解意图**：即便当前消息字面含 `/commit`，也要先判断意图是否真的是「现在执行提交」——若是在讨论 `/commit` 命令、举例、引用，或意图明显不是提交（例如「这条指令包含 /commit 但不是要 commit」），则**不触发**。
  - 任何疑似误触、续跑、自动触发都不执行；只有「用户当下明确要执行 commit」才走该流程。
- **命中即彻底终止，不暂停续跑**：`/commit` 流程中一旦命中敏感内容扫描或 cache 检测，**立即终止本次流程**（不 `git add` / `commit` / `push`），**不存在「暂停 → 等用户处理 → 从断点继续」**。要再次提交，用户须**重新输入 `/commit`** 从头走完整流程。

## 版本信息一致性（VERSION 文件为唯一权威，2026-07-19 用户立）

凡项目根目录存在 `VERSION` 文件，该文件就是整个项目版本号的**唯一权威来源**。项目内**所有**涉及版本信息的文件——含但不限于 `package.json` 的 `version` 字段、CHANGELOG、README 徽章与正文、VSCode 扩展的 `package.nls.json` 与构建产物命名等——其标称的版本号，都必须与 `VERSION` 里的版本号**核心数字一致**。

- **允许前缀差异**：版本号前的修饰性前缀不计入比对。例如 `VERSION` 里是 `1.2.3`，那么 `v1.2.3`、`Version 1.2.3`、`"version": "1.2.3"` 都算一致——前导的 `v`、`Version `、`"version": "` 等文字 / 标点 / 引号允许不同，但核心的 `1.2.3` 三段数字（major.minor.patch）必须逐一相同。
- **为什么**：单一权威源避免版本号在各处对不上——发版时打错 tag、徽章漏更新、CHANGELOG 与 package.json 脱节都源于此；把 `VERSION` 钉成唯一源，所有地方向它看齐，一致性可机械核对。
- **怎么用**：
  - `/commit` 流程会做版本号一致性检测（详见 commit skill）：项目根有 `VERSION` 文件才查，各文件版本号与 `VERSION` 不一致即**彻底终止**本次提交。
  - 平时手动改版本号（升版本、加 beta 标记）时，以 `VERSION` 为准同步更新所有引用处，不要只改一处；改之前先改 `VERSION` 再同步其它，避免基线漂移。
- **边界**：
  - 仅在项目根有 `VERSION` 文件时生效；没有 `VERSION` 的项目不受本条约束，按各文件原有规则。
  - 版本号**后缀**（`-beta`、`-rc.1`、`+build` 等 pre-release / build metadata）不属于「前缀」，不自动豁免——出现后缀差异时需判断是否为有意区分（如 beta 与正式通道版本不同），不能默认视为一致。

## 版本发布状态必须实测 GitHub Release（2026-07-27 用户立）

凡需要判断「某个特定版本是否已发布」——无论是决定把新改动记进哪个 CHANGELOG 条目、判断某版本号是否可用、还是回答「X 版本发了吗」——**必须实测 GitHub Release**，**不许凭 commit 历史、VERSION 文件、CHANGELOG 条目或 package.json 版本号推断发布状态**。

- **为什么**：VERSION / package.json 的版本号会在**发版前**就 bump（属开发中状态），CHANGELOG 也会提前写好条目，commit 历史里「bump to X.Y.Z」只说明版本号改了、**不等于已发布**。唯一能确定「已发布」的证据，是 GitHub 上存在该 tag 对应的 Release。凭上述任一间接信号下结论，会把已发布版本误判成未发布（反之亦然），导致把新改动塞进已定稿的 CHANGELOG 条目、或重复发版。（2026-07-27 在 CC-BRIDGE 把 `start` 改后台时，因轻信会话开头 git log 快照「最新提交是 bump to 2.1.1」就断定 2.1.2 未发布、把改动塞进已发布的 2.1.2 条目，被用户纠正——根因正是没去查 Release。）
- **怎么用**：
  - 判断版本 X.Y.Z 是否已发布 → 跑 `gh release view vX.Y.Z -R <owner>/<repo>`：返回 Release 详情即**已发布**；报 `not found` 即**未发布**。或 `gh release list -R <owner>/<repo>` 看全部已发布版本。
  - 以 `git tag -l "vX.Y.Z"` 作为旁证（tag 存在 + Release 存在 = 完整发布）。
  - **不得用作发布判据**：「VERSION 文件是不是 X.Y.Z」「CHANGELOG 有没有 X.Y.Z 条目」「最近某条 commit 是不是 bump to X.Y.Z」「工作区有没有未提交改动」——这些在发版前就会就位，是必要不充分条件，看了也不能下「已 / 未发布」的结论。
- **边界**：本条针对「某版本**是否已发布**」的判定；版本号本身的取值仍以 VERSION 文件为唯一权威（见上条「版本信息一致性」），两者不冲突——**版本号取值看 VERSION，发布状态看 GitHub Release**。

## CHANGELOG 记录纪律（每次增删改查必记 + 防回归，2026-07-30 用户立）

项目根有 `CHANGELOG.md` 时，**每一次文件增删改查操作**（含新建、编辑、重命名、删除文件，以及对 skill / rules / 配置 / 文档的内容变更）都必须在 `CHANGELOG.md` 中记录，且记录必须写清楚两件事：**为什么改**（触发原因 / 要解决的问题）和**改了什么**（具体变更内容）。

- **为什么**：没有原因记录的变更不可追溯——日后回看只知道「改了」，不知道「当时为什么改、解决什么问题」，无法判断后续改动是否会破坏已有修复。
- **怎么记**：在当前版本的 CHANGELOG 条目下，按「新增 / 变更 / 移除」分类添加条目。每条必须包含：变更对象（哪个文件 / 功能）+ 原因 / 解决的问题。不要只写「修改了 X 文件」而不说明为什么。

### 溯源与防回归（核心要求）

**当新改动涉及 CHANGELOG 中已有记录的文件 / 功能 / 规则时，必须执行以下检查**：

1. **回溯历史条目**：先读 CHANGELOG 中该文件 / 功能的历史记录，理解当初是为了解决什么问题而做的改动。
2. **评估回归风险**：新改动是否会导致原来已解决的问题重新出现（回归）——具体来说，检查新改动是否：
   - 删除或弱化了当初为解决问题而加入的逻辑 / 规则 / 约束
   - 恢复了当初被移除的有问题的代码 / 配置 / 行为
   - 改变了当初为修复问题而设定的参数 / 条件 / 边界
3. **回归风险必须提醒用户**：如果评估后发现新改动**可能导致已解决的问题回归**，必须**立即、明确地告知用户**，说明：
   - 原来解决的是什么问题（引用 CHANGELOG 历史条目）
   - 新改动的哪个部分会破坏该修复
   - 如果不处理会有什么后果
   - 建议的处理方式（保留修复 / 做兼容调整 / 接受回归并记录原因）
4. **无回归则照常执行**：评估后确认新改动不影响已有修复，正常推进，无需额外提醒。

- **边界**：
  - 仅在项目根有 `CHANGELOG.md` 时生效；没有 CHANGELOG 的项目不受本条约束。
  - 「查」操作（只读查看文件内容）如果**不产生文件变更**，不需要记录到 CHANGELOG——但如果是为后续改动做调研，建议在后续改动的条目中附带说明调研过程。
  - 盯盘过程中的高频信号记录写入 `signals/` 属运行时数据流，不逐条记入 CHANGELOG；但信号**机制**的变更（如新增 / 修改信号格式、响铃逻辑）必须记。

## skill 项目副本的存在原因（开源自包含）

凡是**自身要公开 / 开源的项目**（尤其是开源「Agent 本身」的项目），skill 属于 Agent 的核心内容、是 Agent 的一部分，必须随项目公开——所以即便本机全局 `~/.claude/skills/` 已有该 skill，仍需在项目 `.claude/skills/` 放一份副本。这样他人 clone 项目即得完整 Agent，不依赖作者本机环境。下方 anysearch / find-skill 的「同步规则」服务于这个目标：保持项目副本与全局权威副本一致（`runtime.conf` 路径例外除外）。后续遇到其它 skill 需纳入开源项目时同理（2026-07-13 用户立）。

## 写 skill 内容须依据 skill-creator（2026-07-31 用户立）

凡是**新建 skill、或修改已有 skill 的内容**（SKILL.md 正文、description、references、scripts 组织等），必须**先读 skill-creator skill**（`~/.claude/skills/skill-creator/`），按它的方法论来写，不能凭感觉自由发挥。

- **为什么**：skill-creator 是专门用来创建 / 改进 skill 的方法论工具，沉淀了经过验证的写法——最核心的是 Progressive Disclosure（渐进式披露）：元数据（name + description）始终在上下文、SKILL.md 正文在触发时加载（理想 <500 行）、scripts / references / assets 按需加载；description 要写得"pushy"（明确列出触发场景、避免欠触发）；详情要拆进 references 并在主文件留清晰指针。不按这套来，写出的 skill 容易臃肿（主文件超长、详情全堆正文）、触发不准（description 太弱导致该触发时不触发）、难维护。DayTradingAgent 的 trade skill 就曾因违反 Progressive Disclosure（主文件 543 行、规则全堆正文）被按 skill-creator 重写过。
- **怎么用**：
  - 新建 skill：走 skill-creator 的完整流程（Capture Intent → Interview → Write SKILL.md → 写测试用例 → 跑 eval → 迭代），至少在结构上遵循它的 Anatomy + Progressive Disclosure + Writing Patterns。
  - 修改 / 优化已有 skill 内容：先读 skill-creator 的 Skill Writing Guide，确保改动符合其结构要求（主文件精简、description pushy、详情拆 references）；大改后可用 skill-creator 的 eval 流程验证触发与效果。
  - description 优化（提升触发准确率）：用 skill-creator 的 skill description improver 脚本。
- **边界**：
  - 本条管的是 skill **内容怎么写**（结构 / 方法论），不管 skill 的存放位置 / 副本同步（那是「skill 项目副本的存在原因」和各 skill 同步小节的事）。
  - 只改 skill 里的一两个错别字 / 小措辞，不必每次都重走 skill-creator 全流程；但涉及结构调整、新增章节、重写 description 等"内容性改动"时，必须以 skill-creator 为准。
  - skill-creator 自身在 `~/.claude/skills/skill-creator/`（全局可用），无需额外安装。

## rules 文件必须在 CLAUDE.md 中 @ 引用（加载机制纪律，2026-07-20 立）

`@` 引用是 rules 文件进入上下文的**唯一途径**——只有被 CLAUDE.md `@` 引用的 rules 文件，才会随 CLAUDE.md 自动加载进上下文（S 级、每次会话无条件在场、优先级最高）；**未被引用的 rules 文件不会自动加载，等于白写**。这是 rules/ 机制区别于 SKILL.md / MEMORY.md（按固定文件名被系统主动加载）的固有约束。

- **项目级**：`.claude/rules/` 下每一个规则文件，都必须在项目级 `.claude/CLAUDE.md` 里 `@` 引用（写明 `@路径` + 一句话摘要）。
- **全局级**：`~/.claude/rules/` 下每一个规则文件，都必须在全局 `~/.claude/CLAUDE.md` 里 `@` 引用。

**怎么用**：
- **新增 rule 文件** → 同步在对应 CLAUDE.md 加一行 `@` 引用。
- **删除 rule 文件** → 同步去掉对应 CLAUDE.md 里的 `@` 引用。
- **定期核对** rules/ 目录与 CLAUDE.md 的 `@` 清单一致——目录里有但 CLAUDE.md 没引用 = 漏加载（白写）；CLAUDE.md 引用了但目录里没文件 = dangling 引用。两者都要及时修。

**为什么**：rules/ 没有「按固定文件名自动加载」的机制（不像 SKILL.md / MEMORY.md 那样系统会主动按文件名找），它的文件被加载的唯一途径是被某个 CLAUDE.md `@` 引用。漏了 `@`，该规则在会话中完全不在场、起不到约束作用——**文件存在 ≠ 被加载**。

## anysearch skill 同步（全局为权威副本）

全局 `~/.claude/skills/anysearch/` 是 anysearch skill 的权威副本，所有项目下的 `.claude/skills/anysearch/` 副本必须与它一致：

- 全局副本核心内容改动 → 同步到**所有**含 anysearch 的项目副本。
- 任一项目副本改动 → 同步到全局，再由全局同步到其它项目。
- 核心内容（`scripts/` 下所有 CLI、`shared/`、`SKILL.md`、`README.md`、`SECURITY.md`、`LICENSE`、`NOTICE`、`requirements.txt`、文件清单）必须一致。
- **例外**：`runtime.conf` 的 `Command` 路径各自保持（项目副本用项目根相对路径以开源可移植，全局用绝对路径）。
- 同步后告知用户改了哪些副本。

## find-skill skill 同步（全局为权威副本）

全局 `~/.claude/skills/find-skill/` 是 find-skill 的权威副本，所有项目下的 `.claude/skills/find-skill/` 副本必须与它一致：

- 全局副本核心内容改动 → 同步到**所有**含 find-skill 的项目副本。
- 任一项目副本改动 → 同步到全局，再由全局同步到其它项目。
- 核心内容（`SKILL.md`、`scripts/install-skill.sh`、`update-skills-catalogue.sh`、`.env.example`，以及配套 `.claude/commands/install-skill.md`）必须一致。
- **不同步**：`.env`（本机 SkillsMP 密钥）、`cache/`（本机 catalogue、日志）——机器本地数据。
- find-skill **无路径例外**：脚本内路径统一硬编码为全局 `~/.claude/skills/find-skill/`，项目副本与全局副本核心文件逐字节相同。
- 同步后告知用户改了哪些副本。

## 智能体命名注册表（避免重名 + 跨 agent 推荐）

下列是已存在的智能体。**新起拟人名前先查此表，全局不可重复**（2026-07-13 用户立）。执行任务时，若发现某子任务更适合另一个 agent，应主动推荐 / 移交给它。

| 拟人名 | 项目（仓库） | 职称 Title | 主要职责 |
|---|---|---|---|
| **Scout** | ProductStrategistAgent | 选品策略师 | 研判：热点 + 市场 + 竞品 + 盈利 + 渠道 →《机会研判报告》 |
| **Wright** | ProductProducerAgent | 数字产品制作人 | 生产：做出成品数字产品（prompt 包 / 模板 / ebook / 素材） |
| **Mason** | SiteBuilderAgent | 建站工程师 | 建设：搭成交基础设施——独立站建设 + 落地页技术与部署 + 支付渠道与接口配置；建设期（Wright 之后、Buzz 之前），建好把购买链接交 Buzz |
| **Buzz** | GrowthMarketerAgent | 增长营销 | 引流：各渠道引流内容 + 链接（X / IG / YouTube / 小红书 / 知乎 / B 站） |
| **Vendy** | DigiVendAgent | 电商运营 | 成交：上架 / 定价执行 / 履约 / 售后纠纷 / 多平台铺货 / 对账 |
| **Echo** | DataAnalystAgent | 数据分析师 | 复盘：归因（决策→业绩）+ 分发建议 + 累积 playbook |
| **Kit** | PersonalAssistantAgent | 个人助理 | 通用助手：处理琐碎事（不在销售流水线内） |
| **Victor** | DayTradingAgent | 日内交易员 | 信号：港股 / 美股盘中盯盘 → 分析标的 + 计算仓位与止损 → 发出交易信号（信号模式，不下单，人工执行） |
| **Tinker** | PatchClaudeAgent | 补丁维护匠 | 维护：VSCode Claude Code 扩展升级后重新应用自定义补丁（自愈引擎：定位→应用→校验→回写），独立工具型 agent |
| **Prometheus** | CapabilityManagerAgent | 通用能力管家 | 底座：维护 `~/.claude/` 通用能力（skills / rules / settings / commands）+ 全局↔项目副本跨项目同步 + fleet 注册表维护，独立于销售流水线 |
| **Markowitz** | QuantStrategistAgent | 量化策略师 | 量化策略：设计可回测的交易策略代码 → 历史回测标定可信度 → 产量化信号给 Victor 当加权投票员（离线开发，不盯盘不下单） |

销售流水线顺序：① Scout → ② Wright → ③ Mason → ④ Buzz → ⑤ Vendy → ⑥ Echo；Kit、Victor、Tinker、Prometheus、Markowitz 各自独立（不在销售流水线内）。其中 Mason（建设期：建成交阵地 + 接支付）必须在 Buzz 之前就位，Buzz 的带货链接才有处可指；Vendy 在 Buzz 之后做运营期（接单 / 履约 / 售后 / 对账）——Mason 建、Vendy 营，接力同一阵地。Markowitz（量化策略开发）与 Victor（日内交易）协作：Markowitz 产回测标定的策略给 Victor 当加权输入。每个 agent 的拟人名同时写在其项目 README 里。

## 新建带拟人名的 Agent 时自动维护注册表（免确认，2026-07-16 用户立）

凡是新建一个**带拟人名的 Agent 项目**（即属于上方注册表范畴的 fleet agent），**无需每次征得同意**，直接做两件事：

1. 把「拟人名 + 项目（仓库）+ 职称 Title + 主要职责」加进上方「智能体命名注册表」表格（拟人名先查重，全局不可重复）；
2. 在表格下方的「销售流水线顺序」段补上该 agent 的位置（在流水线内，还是独立于流水线）。

**为什么免确认**：新建带拟人名的 agent 本身就已明确要把它纳入 fleet；注册表是 fleet 的元数据，追加新成员是建立该 agent 的固有一步，每次都问一遍是多余的反 confirm。

**授权边界（重要，防过度泛化）**：本条的免确认授权**仅限「向注册表追加新 agent 行 + 补一句位置说明」这一类编辑**，**不扩展**到本文件的其它任何修改——例如改语言偏好、git 规则、输出风格、脚手架约定，或对**已有** agent 行的重命名 / 调整职责 / 删除等，仍一律按「先征得同意」处理，不因本条规定而自动授权。改全局元规范默认要谨慎，只有「新建 agent 时追加注册表行」这一个窄口子放开。

## 新建 Agent 项目的脚手架与开源约定（2026-07-13 立，经 6 个项目验证）

新建 Agent 项目时（拟人名查上方注册表）按此操作，保证 fleet 一致、开源安全。**为什么**：agent 越来越多，统一脚手架避免重造轮子、避免泄露密钥。**怎么用**：复制已有 agent 项目（如 DigiVendAgent）再按角色改写。

- **AutoMemory 全局已禁用**（`~/.claude/settings.json` 设 `autoMemoryEnabled: false`，2026-07-20 立）：新建项目**不配 AutoMemory**（不建 `.claude/memory/`、不填 `autoMemoryDirectory`、`.gitignore` 不挂 memory 条目）。知识沉淀走 rules/skills（强约束规范）+ CLAUDE.md，不依赖 AutoMemory 自动记。
- **目录名** = `XxxAgent`（职称 Title + Agent，PascalCase），对齐 DigiVendAgent。
- **每个项目都复制**（从已有 agent 项目）：`.claude/skills/`（anysearch、find-skill —— **复制后删 `find-skill/.env` 和 `cache/`**，密钥与本机数据）、`.claude/commands/install-skill.md`、`.claude/rules/`（通用三件套：file-operation-priority / tmp-dir / verify；销售流水线 agent 再加 available-channels / passive-income-only）、`.claude/settings.json`（原样复用，hooks 默认空）、`.claude/settings.local.json`（**新建，本机配置不入库**）+ `.claude/settings.local.example.json`（**入库模板**，供 clone 者照抄）、`LICENSE.md`（MIT）。角色专属 skill 按需（如 Scout 加 hot-trend）。
- **角色化 `CLAUDE.md`**（你是谁 / 产物契约 / 工具 / 约束 / 流水线位置）+ **中英双语 `README.md`**（含拟人名 + topics）。README 顶部必须有 **logo**（`assets/logo.svg`，统一模板：640×200 渐变色卡 + 角色 emoji + 名字 + 职称，配色按角色区分）+ **标准徽章**（shields.io：License MIT / Stars / Last Commit / AI Agent；**不含**点明 LLM / 厂商的徽章，如 "Built with Claude Code"）。
- **`.gitignore` 必含**：`.env`/`.env.*`（留 `.env.example`）、`find-skill/.env` 与 `cache/`、`settings.local.json`、`tmp/`、`docs/`（运行时数据）、`artifacts/`（**可售卖成品，绝不公开**）、`node_modules/`、`.DS_Store`、`__pycache__/`。
- **开源到 GitHub**：`gh repo create XxxAgent --public --source=. --remote=origin --push` → 设 About + topics（`gh repo edit --description "中英双语" --add-topic a --add-topic b ...`，**多个 `--add-topic` 写字面量、勿用 shell 变量拼接**，否则报 `accepts at most 1 arg(s)`）→ FUNDING.yml **只放一份在 `xhqing/.github` 仓库**（`github: xhqing`），作为所有仓库的默认 Sponsor 配置；**不要在每个 agent 项目里放 `.github/`**——赞助配置不是项目主体内容。别用 `repos/.../funding` API 验证（不公开返回）。

## 底层通用能力开源：全局 ↔ 本项目四部分时刻一致（2026-07-31 用户立）

本项目（CapabilityManagerAgent）是把 Claude Code 智能体的**底层通用能力底座开源出去**的源头仓库。全局 `~/.claude/` 下这 4 部分——`CLAUDE.md`、`skills/`、`rules/`、`commands/`——的全部内容，必须与本项目 `.claude/` 下对应的这 4 部分**时刻保持逐字节一致**。

- **权威方向**：**本项目 `.claude/` 是唯一权威源**，全局 `~/.claude/` 对应部分是它的镜像。改动只能先在本项目落地、再同步覆盖全局；反过来不准直接改全局（直接改全局会破坏一致性，必须回到本项目改、再镜像过去）。
- **范围**：全集。`skills/` 下所有 skill、`rules/` 下所有规则、`commands/` 下所有命令、根 `CLAUDE.md`——每一项都在本项目里有一份，且与全局逐字节相同。
- **唯一例外：敏感信息**。涉及密钥、凭证、本机运行数据的内容（如 `find-skill/.env` 里的 SkillsMP 密钥、`find-skill/cache/` 里的本机数据、`settings.local.json`），不在「逐字节一致」的硬要求内——由本项目用 `.gitignore` 在项目级隔离，确保敏感信息不随开源仓库泄露。除此之外**不存在任何特例**：包括 `runtime.conf` 路径也不再特殊对待，项目副本与全局逐字节相同，clone 者拿到后按本机路径自行适配即可。
- **为什么**：把底座钉成单一开源源头，任何人 clone 本项目即得完整通用能力，不依赖作者本机环境；本项目改一处、全局镜像一处，避免两边分叉、互相漂移。
- **怎么验证**：每次改动后用 `diff -r ~/.claude/<部分> .claude/<部分>` 核对四部分是否仍逐字节一致（被 `.gitignore` 隔离的敏感文件不参与公开比对，是唯一允许的差异）。
- **与下方各 skill 同步小节的关系**：本规定管的是「CapabilityManagerAgent ↔ 全局」这一层（项目为权威）；下方 anysearch / find-skill 同步小节管的是「全局 ↔ 其它 agent 项目副本」那一层（全局为权威，向各 agent 分发）。两层方向衔接——本项目是终极源头 → 全局 → 各 agent 项目副本，互不冲突。
