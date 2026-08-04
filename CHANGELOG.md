# Changelog

本项目（CapabilityManagerAgent）是 Claude Code 智能体舰队通用能力底座的**开源镜像仓库**：`claude/`（2026-08-03 起从 `.claude/` 迁入）下的 `skills` / `rules` / `CLAUDE.md` 三部分与全局权威源 `~/.claude/` 逐字节一致（2026-08-04 起权威方向反转：全局为权威、本项目 `claude/` 为镜像）。本 CHANGELOG 记录**通用能力底座的变更**——即 `claude/` 三部分的增删改，以及全局 ↔ 本项目镜像的同步动作。

> 按全局 CLAUDE.md「同步动作只记权威源的 CHANGELOG」规矩：通用能力的同步只记本文件，**不记到各业务 agent 项目**（如 DayTradingAgent 等）的 CHANGELOG，避免污染那些项目自己的变更记录。

## 2026-08-04

### 新增（capability-manager skill：把 Prometheus 的通用能力维护流程固化成可执行 skill，消除 README 历史死链）

- **为什么改**：capability-manager skill 此前只是双语 README 里的一句引用文字（链接 + 激活段说明），从未作为 skill 实体存在——README 链接是死链，2026-08-03「遗留问题收尾」条目当时把英文版链接改指向 `claude/CLAUDE.md`、中文版仍指向不存在的 skill。用户要求新建该 skill，把 Prometheus（通用能力管家）的通用能力维护 / 跨项目同步 / fleet 注册表流程固化成可执行 skill，让 README 引用真正有效。
- **改了什么**：
  - **新建 capability-manager skill**（权威源 `claude/skills/capability-manager/`）：`SKILL.md` + 3 个 references（`sync-flow.md` 三层同步与一致性核对、`content-lifecycle.md` 改通用能力内容全链路、`registry-and-scaffolding.md` fleet 注册表与新项目脚手架）。定位为 Prometheus 的**轻量操作手册**——与 CLAUDE.md 分工：CLAUDE.md 管规则（S 级、始终在场），本 skill 管「按场景的 step-by-step 流程 + 护栏 checklist + 命令模板」，**引用 CLAUDE.md 规则、不重复**。覆盖 3 场景：改通用能力内容 / 三层同步与一致性核对 / fleet 扩展。按 skill-creator 方法论写（pushy description、Progressive Disclosure、SKILL.md <500 行、详情拆 references）。
  - **同步全局**：`cp -R` 到 `~/.claude/skills/capability-manager/`，`diff -r` 验证权威源与全局逐字节一致。capability-manager 是 Prometheus 专属 skill，不分发到各业务 agent 项目。
  - **修正双语 README 死链**：`README.md` 与 `README_cn.md` 的 skill 链接从 `.claude/skills/capability-manager/SKILL.md`（带点、不存在）改为 `claude/skills/capability-manager/SKILL.md`（不带点、权威源真实位置），死链消除。

### 变更（英文版 README 按中文版暂存区基准同步）

- **为什么改**：中文版 `README_cn.md` 已在暂存区做过精简（删「不是传统软件项目」引用块、删「经中枢同步」要点、精简核心工作流段等），英文版需对齐到同一基准。
- **改了什么**：英文版 `README.md` 删「This is not a traditional software project...」引用块、删「Sync through the hub」要点、精简 Core workflow 段（删大段说明 + anysearch/find-skill 详细规则）、激活段删「sync a common skill across agent projects」、第一条要点按基准改为「Global is authoritative」。
- **已知矛盾（留待用户定夺，非本次回归）**：中文版基准的「全局为权威」与 2026-08-03 架构调整（本项目 `claude/` 为唯一权威源、全局为镜像）字面冲突——会话中已提醒用户，用户选择照中文版基准同步。日后若要统一权威方向表述，需同步修订双语 README「Who is Prometheus」段的第一条要点。
  > **2026-08-04 后续（见下一条）**：本条所述矛盾已由「架构反转」消除——权威方向反转后「全局为权威」成为正确表述，README 不再需要改。

### 变更（架构反转：全局为权威源、本项目 `claude/` 为镜像；同步范围收为三部分、去掉 commands/）

- **为什么改（用户 2026-08-04 立）**：2026-08-03 把权威源定在本项目 `claude/`（全局为镜像），但同文件的 anysearch / find-skill 同步节一直写「全局为权威副本」，两边内部矛盾；且全局 `~/.claude/` 才是所有项目运行时实际加载的「活」源头，以它为权威更贴合使用。用户决定反转：**全局 `~/.claude/` 为唯一权威源，本项目 `claude/` 为开源镜像**；同时把同步范围从四部分（含 `commands/`）收为**三部分**（skills / rules / CLAUDE.md），`commands/` 各处自行管理、不进同步。
- **改了什么**：
  - **CLAUDE.md 元规范**（`claude/CLAUDE.md` + 全局镜像）：「底层通用能力开源」节整节重写——标题改「全局权威 ↔ 本项目镜像，三部分时刻一致」；权威方向段反转（全局权威、`claude/` 镜像、先落全局再镜像 `claude/`）；范围段收为三部分（不含 `commands/`、不含项目级专属 skill、不含 `settings.json`）；目录布局 / 为什么 / 怎么验证 / 同步关系 / 自动同步 / CHANGELOG 各段配套反转。另改 3 处配套表述（anysearch / find-skill 同步节的「权威源层级」→「三部分镜像之一」、注册表 Prometheus 行的「权威源 `claude/`」→「全局为权威源、`claude/` 为镜像」）。同步全局，diff 验证逐字节一致。
  - **capability-manager skill 挪位 + 内容反转**：从 `claude/skills/capability-manager/`（原通用权威位置）挪到 `.claude/skills/capability-manager/`（**项目级专属**，不进通用同步体系）；清理 `claude/skills/` 与全局 `~/.claude/skills/` 里的 capability-manager 副本。SKILL.md + 3 个 references（sync-flow / content-lifecycle / registry-and-scaffolding）内容全部按新架构反转（全局权威、`claude/` 镜像、三部分、去 `commands/`）。
  - **项目根 `CLAUDE.md`**：开头段改——「四部分」→「三部分」、「通用能力底座权威源」→「全局权威源的开源镜像」、补 capability-manager 在 `.claude/` 的说明。
  - **`CHANGELOG.md` 头部说明**：「四部分」→「三部分」、「权威源」→「开源镜像仓库」、补权威方向反转注明。
  - **双语 README 链接**：capability-manager skill 链接从 `claude/skills/...`（原权威位置）改为 `.claude/skills/capability-manager/SKILL.md`（项目级新位置）。README 权威表述（「全局为权威」）经反转后正好符合新架构，无需改动——上一条「英文 README 同步」遗留的权威方向矛盾就此消除。
- **顺带消除的内部矛盾**：2026-08-03「`claude/` 权威」与 anysearch / find-skill 节「全局权威」的打架，反转后统一为「全局权威」，自洽。

### 移除（英文版 README 删除 Domain 徽章）

- **为什么改（用户 2026-08-04 立）**：用户认为英文版 `README.md` 顶部的 Domain 徽章不需要——它标注的「claude」域信息对读者价值有限，且中文版 `README_cn.md` 本就没有 Domain 徽章，删后双语 README 的徽章行也更一致。
- **改了什么**：`README.md` 删除原第 10 行的 `[![Domain](https://img.shields.io/badge/Domain-claude-F97316.svg)](#)`，徽章行剩 License / Last Commit / Type 三个。

## 2026-08-03

### 变更（commit skill 缓存载体独立：从项目级 `CLAUDE.md` 迁到专用文件 `.commit-skill-cache.md`）

- **为什么改（用户 2026-08-03 立）**：用户要求 commit skill 的检测缓存标记**不再寄生在项目级 `CLAUDE.md` 里**，改由一个**专用文件**承载——`CLAUDE.md` 应只放项目说明，缓存是 commit skill 的运行状态、性质不同，混在一起既污染项目说明、也让 `CLAUDE.md` 因缓存频繁变动。机制上 commit skill 第 9 步后检测时**专门找这个文件、不存在就新建**。
- **改了什么**：
  - **commit skill（权威源 `claude/skills/commit/SKILL.md` + 全局镜像）**：把缓存载体从「项目级 `<项目根>/CLAUDE.md`」整体换成「项目根 `.commit-skill-cache.md`」——① `description` 与「核心定位」概述的「齐全则在项目级 `CLAUDE.md` 标记」改为「在项目根 `.commit-skill-cache.md` 标记」；② 第 9 步开头「先读项目级 `CLAUDE.md`」改为「先读项目根 `.commit-skill-cache.md`（不存在则视为无缓存、稍后新建）」；③ `xhqing` Profile 例外段的「与 CLAUDE.md 缓存读写」同步改；④ 9e/9j/9k 三处「项目级 CLAUDE.md 缓存段不写 `automemory`/`version-staleness`/`version-consistency` 标记」改为「`.commit-skill-cache.md` 不写……」；⑤ 「CLAUDE.md 检测缓存」整段重写为「`.commit-skill-cache.md` 检测缓存」——明确它是**专用载体文件**（不存在→新建、只含缓存内容、**不碰项目 `CLAUDE.md`**），commit skill **不再在项目 `CLAUDE.md` 里写缓存**；缓存模板顶部加文件头说明（这文件由 commit skill 自动维护、勿手改）+ 标题从二级 `##` 升为文件级一级 `#`；⑥ 「例外仅七类」编辑授权清单两处（核心定位段 + 注意段）的②「项目级 `CLAUDE.md` 追加缓存段」改为「项目根 `.commit-skill-cache.md` 写入缓存标记（不存在则新建）」；⑦ 末尾说明「该 `CLAUDE.md` 与本次补全的……」改为「该 `.commit-skill-cache.md` 与本次补全的……」。
  - **本项目落地**：新建项目根 `.commit-skill-cache.md`，把原寄生在根 `CLAUDE.md` 的九条标记（readme-standard / license / github-about / agent-persona / attribution-name / readme-link-text / repo-sponsors / readme-no-stars-badge / changelog-version）原样迁入；根 `CLAUDE.md` 删除整个「commit skill 检测缓存」段，仅保留项目简要说明，并加一句指向新缓存文件。
  - **文件命名与入库**：专用文件定名 `.commit-skill-cache.md`、放项目根、**进 git**（与原寄生在 `CLAUDE.md` 里同属被跟踪、多机 / clone 者共享检测状态）；点开头表明是工具自动维护的缓存、不与 `CLAUDE.md`/`README.md` 等正式文档并列，`.md` 保留可读性。
  - **同步全局**：`claude/skills/commit/SKILL.md` 覆盖全局 `~/.claude/skills/commit/SKILL.md`，`diff` 验证逐字节一致。
- **落地说明（各 agent 项目）**：commit skill 改读 `.commit-skill-cache.md` 后，各 agent 项目（DayTradingAgent 等）根 `CLAUDE.md` 里**原有的「commit skill 检测缓存」段不再被读取**——属冗余死文字（无害，不影响功能），各项目下次 `/commit` 时会因 `.commit-skill-cache.md` 不存在而全量重检测一次、并新建该文件；旧 `CLAUDE.md` 缓存段可由各项目择机手动删除（不删也无妨）。

### 变更（目录布局迁移：通用能力权威源从 `.claude/` 迁到 `claude/`，`.claude/` 保留为本项目独有的项目级能力目录）

- **为什么改（用户 2026-08-03 立）**：用户决定把开源出去的通用能力底座从 `.claude/` 迁到 `claude/` 目录（不带点）——`claude/` 不会被 Claude Code 自动加载（不是标准配置目录名），它纯粹是本项目「开源给全世界的通用能力」的权威源副本；`.claude/` 目录保留为本项目**独有的项目级能力目录**，放本项目特有、不随通用能力同步的内容。两者分工清晰：`claude/` 管「开源通用能力」、`.claude/` 管「本项目自己的项目级能力」。本项目运行时实际依赖的能力由全局 `~/.claude/` 镜像提供（逐字节一致），不受本次迁移影响。
- **改了什么**：
  - **迁移**：`.claude/CLAUDE.md`、`.claude/rules/`、`.claude/skills/`（含 find-skill 的 `.env` 与 `cache/` 本机数据）整体迁到 `claude/` 对应位置；`.claude/` 目录保留为空，新增 `.claude/README.md` 说明其「项目独有能力目录」定位（目录不空、clone 后可见）。
  - **`claude/CLAUDE.md`（权威源，随后镜像全局）**：① 所有「本项目 `.claude/`」表述改为「本项目 `claude/`」（「底层通用能力开源」节的权威方向、范围、diff 验证命令、自动同步段）；② 该节新增「目录布局」段，说明 `claude/`（开源副本、不被自动加载）与 `.claude/`（项目独有能力目录）的分工；③ anysearch / find-skill 同步节的「所有项目下的副本」限定为「所有 agent 项目下的副本」并注明本项目自身副本在 `claude/`（属权威源层级、由「底层通用能力开源」节管理）；④ 删除 anysearch 节残留的「`runtime.conf` 路径例外」句——该例外在 2026-07-31「runtime.conf 不再特殊对待、逐字节一致」新规后已失效（实际 runtime.conf 就是绝对路径逐字节一致），属当时漏删，本次一并删掉、核心内容清单补入 `runtime.conf`；⑤ 「skill 项目副本的存在原因」节明确本项目副本在 `claude/skills/`、其它 agent 项目仍在各自 `.claude/skills/`（Claude Code 只从那里加载）；⑥ 智能体注册表 Prometheus 行的职责描述补「权威源 `claude/` ↔ 全局 ↔ 各 agent 项目副本」。
  - **项目根文档**：根 `CLAUDE.md` 开头段与 `CHANGELOG.md` 头部说明改为 `claude/`，并注明 `.claude/` 保留为项目独有能力目录；`.gitignore` 的 find-skill 忽略路径从 `.claude/skills/find-skill/` 改为 `claude/skills/find-skill/`（`.claude/settings.local.json` 条目保留，`.claude/` 目录仍在使用）；`README.md` / `README_cn.md` 同步修订（见下一条目）。
  - **同步全局**：`claude/CLAUDE.md` 覆盖全局 `~/.claude/CLAUDE.md`，`diff -r` 验证 CLAUDE.md / rules / skills 三部分逐字节一致（find-skill `.env` / `cache/` 为被 `.gitignore` 隔离的唯一允许差异）。
- **其它 agent 项目不受影响**：各 agent 项目的 `.claude/` 仍是 Claude Code 标准加载目录，同步分发照旧（全局 → 各 agent 项目副本）。

### 变更（README 双语：权威源与目录布局描述随迁移更新）

- **为什么改**：README 的「全局为权威」表述停留在迁移前旧架构（2026-07-31 已改为本项目为权威源，README 滞后未更新）；本次目录迁移后，README 里「仓库行为由 `.claude/` 塑造」「项目副本」等描述也与新布局不符，需一并对齐。
- **改了什么**：`README.md` 与 `README_cn.md` 双语同步——①「仓库即 agent、行为由 `.claude/` 下的 skills/rules 塑造」改为 `claude/`；②「Global is authoritative / 全局为权威」改为「仓库 `claude/` 是权威源，全局 `~/.claude/` 是镜像，各 agent 项目 `.claude/` 取副本」；③ 核心工作流段的「权威副本在 `~/.claude/`」改为「权威副本在仓库 `claude/`，镜像到全局、再复制进各 agent 项目 `.claude/`」；④ anysearch 同步规则描述同步删除 `runtime.conf` 路径例外（与权威源 CLAUDE.md 一致）；⑤ 文末 skill 链接前缀 `.claude/` 改为 `claude/`。

### 变更（遗留问题收尾：README 去 stars 徽章 + 修死链 + 新建 VERSION + 补缓存标记）

- **为什么改（用户 2026-08-03 指示「这几个问题主动修改一下」）**：上一轮目录迁移汇报时指出的三个历史遗留问题——① README 顶部仍挂 GitHub Stars 数量徽章（commit skill 第 9l 步规范禁止，本应等下次 `/commit` 清理）；② 项目根缺 `VERSION` 文件（commit skill 第 9m 步规范「任何项目必须有」）；③ README 文末引用的 `claude/skills/capability-manager/SKILL.md` 实际不存在（历史遗留死链，capability-manager skill 从未建立）。用户指示主动修掉，不等 `/commit`。
- **改了什么**：
  - **README 去 stars 徽章（第 9l 步落地）**：`README.md` 与 `README_cn.md` 顶部徽章行各删掉 `github/stars/` 徽章整行（`?style=social` 变体），保留 License / Last Commit / Type 三枚（符合 9a 徽章组合）+ 自定义 Domain 徽章。**顺带更新 Domain 徽章文字**：`Domain-~%2F.claude` → `Domain-claude`——徽章显示的管辖域随目录迁移从 `~/.claude` 改为权威源 `claude/`，避免读者误解。
  - **修死链**：① `README.md` / `README_cn.md` 文末「完整操作步骤、护栏、fleet 注册表维护」句子的链接从不存在的 `claude/skills/capability-manager/SKILL.md` 改为真实的 `claude/CLAUDE.md`（这些内容实际都写在「底层通用能力开源」「anysearch/find-skill 同步」「智能体命名注册表」等节里），措辞同步微调；② 双语 README「How it's activated」段的「激活后加载 `capability-manager` skill」也一并改为「执行写在 `claude/CLAUDE.md` 里的护栏」——同属对不存在 skill 的引用，全仓库清理干净。
  - **新建 `VERSION`**：按 commit skill 第 9m 步取值顺序——无 `package.json`、无主 manifest、CHANGELOG 顶部无版本号标题 → 取 `1.0.0`。项目内其余文件（README / CHANGELOG）无版本号标注，与 VERSION 无冲突（版本信息一致性检查通过）。
  - **补缓存标记**：项目级 `CLAUDE.md` 检测缓存段追加 `readme-no-stars-badge`（9l）与 `changelog-version`（9m）两条标记——下次 `/commit` 不再重复检测这两项。
- **验证**：README 双语徽章行已无 `github/stars/` 字样；仓库内无 capability-manager 引用残留；VERSION 内容为 `1.0.0`。

### 变更（CLAUDE.md 两条规则边界修订：CHANGELOG 记录纪律与版本信息一致性从「有文件才生效」改为「文件为标配、无条件生效」）

把权威源 `.claude/CLAUDE.md` 与全局 `~/.claude/CLAUDE.md` 同步更新；两边现已逐字节一致。

- **为什么改（用户 2026-08-03 立，承接 commit skill 第 9m 步）**：commit skill 新增第 9m 步规定「任何项目都必须有 `CHANGELOG.md` 与 `VERSION` 两个文件」（缺失自动新建）后，原两条规则的边界「仅在项目根有该文件时生效；没有该文件的项目不受本条约束」与它矛盾——既然文件是标配必建，就不存在「没有文件」的情形，边界里的缺省豁免句成了死文字，且语义上与「标配必建」冲突。遂删掉豁免句、改为「文件为项目标配、规则无条件生效」。
- **改了什么**：
  - **「版本信息一致性」边界**：删掉「仅在项目根有 `VERSION` 文件时生效；没有 `VERSION` 的项目不受本条约束，按各文件原有规则」，改为「`VERSION` 文件为项目标配（2026-08-03 用户立：任何项目都必须有 `CHANGELOG.md` 与 `VERSION` 两个文件，缺失由 commit skill 第 9m 步自动新建）——本规则对任何项目都生效，不存在『没有 `VERSION` 就不受约束』的情况」。后缀差异的判断边界保留不动。
  - **「CHANGELOG 记录纪律」边界**：同样删掉「仅在项目根有 `CHANGELOG.md` 时生效；没有 CHANGELOG 的项目不受本条约束」，改为「`CHANGELOG.md` 为项目标配（……缺失由 commit skill 第 9m 步自动新建）——本规则对任何项目都生效，不存在『没有 CHANGELOG 就不受约束』的情况」。「查」操作免记、盯盘信号记录两条边界保留不动。
  - **commit skill 9m 措辞微调**：原「它们是『CHANGELOG 记录纪律』『版本信息一致性』规则生效的前提」改为「落地载体（这两条规则现无条件生效、无缺省豁免）」——边界修订后规则无条件生效，原「生效的前提」表述与新规则一致性不足。
  - **同步全局**：`~/.claude/CLAUDE.md` 与 `~/.claude/skills/commit/SKILL.md` 均 `cp` 覆盖，`diff` 验证两份逐字节一致。
- **落地说明**：各业务项目（如 DayTradingAgent 等）的 `CLAUDE.md` 若复制过旧版这两条边界，下次改动时可顺带对齐（属各项目自己的落地动作，不记入本 CHANGELOG）。

### 变更（commit skill：规定任何项目必须有 CHANGELOG.md 与 VERSION——新增第 9m 检测项，缺失则自动新建）

把权威源 `.claude/skills/commit/SKILL.md` 与全局 `~/.claude/skills/commit/SKILL.md` 同步更新；两边现已逐字节一致。

- **为什么改（用户 2026-08-03 立）**：用户规定**任何项目都必须有 `CHANGELOG.md` 与 `VERSION` 两个文件**，并要求把它加入 commit skill 第 9 步「项目标配检测」清单——检测到缺失就自动新建。此前这两个文件是「有才生效」的前提（CHANGELOG 记录纪律、版本信息一致性、9j 版本滞后检测、9k 版本号一致性检测都挂「项目根有该文件才查」），现在从「可选」升级为「标配必建」，补齐后 9j/9k 才有对象可查。
- **改了什么**：
  - **新增第 9m 步「CHANGELOG.md 与 VERSION 文件」**（缓存标记 `changelog-version`）：所有项目（`xhqing` Profile 仓库随第 9 步开头例外跳过）检测项目根是否有这两个文件，缺失则自动新建。`VERSION` 新建时版本号取值顺序：① `package.json` 顶层 `version`；② 主 manifest（`manifest.json`/`pyproject.toml`/`Cargo.toml`/`*.csproj`）；③ 已有 `CHANGELOG.md` 顶部最新实际版本标题（仅建 `VERSION` 时可用）；④ 皆无 → `1.0.0`。`CHANGELOG.md` 新建时顶部写 `## [<当前版本号>] - <今天日期 YYYY-MM-DD>`（**不写 `[Unreleased]` 占位**，与 9k「最新实际版本标题须与 VERSION 一致」天然对齐）。本步排在 9j/9k 之后：首次 `/commit` 缺 VERSION 时 9j/9k 按「无 VERSION」跳过、由 9m 创建，自下次 `/commit` 起 9j/9k 正常执行。
  - **同步各处引用，保持 skill 内部自洽**：`description` 与「核心定位」概述、第 9 步开头的「本地检测 / 例外跳过」编号清单（`9a/9b/9d/9g/9h/9k/9l` 与 `9a–9l` 两处）补入 9m；「例外仅六类」编辑授权清单两处（核心定位段 + 注意段）改为「例外仅七类」、补 ⑦「新建 CHANGELOG.md 与 VERSION 文件」；「CLAUDE.md 检测缓存」段的标记计数从「八类」改为「九类」、缓存模板补 `changelog-version` 块、标记说明补一行；汇报段补「CHANGELOG.md 与 VERSION 文件（第 9m 步）的新建结果（缺哪个建哪个 + 版本号取值来源）或已存在确认」。
  - **同步全局**：权威源改动完成后 `cp` 覆盖全局 `~/.claude/skills/commit/SKILL.md`，`diff` 验证两份逐字节一致。
- **落地说明**：各 agent 项目下次 `/commit` 时若缺 `CHANGELOG.md` / `VERSION`，第 9m 步会自动新建（首次运行因缺 `changelog-version` 标记而必查）。

### 变更（commit skill：README 徽章不再展示 GitHub Stars 数量徽章——新增第 9l 检测项 + 9a 徽章组合去掉 stars）

把权威源 `.claude/skills/commit/SKILL.md` 与全局 `~/.claude/skills/commit/SKILL.md` 同步更新；两边现已逐字节一致。

- **为什么改（用户 2026-08-03 立）**：
  - 用户要求 README 的徽章里**不再显示 GitHub Stars 数量徽章**（`img.shields.io/github/stars/<user>/<repo>` 那枚），并让 commit skill 在项目标配检测里兜底保证这条。
  - **必须两处同改、否则 skill 自相矛盾**：commit skill 原第 9a 步的「徽章组合」规则规定「有 remote 用 4 枚徽章」，其中第 2 枚正是 `github/stars/<user>/<repo>?style=social`。如果只新增一个「检测并删除 stars 徽章」的检测项、却不改这条组合规则，每次 `/commit` 会先由 9a 把 stars 徽章补回去、再由新检测项删掉，反复横跳。所以必须同时：① 改 9a 的徽章组合，让它以后不再添加 stars；② 新增检测项，清理已存在（用户手加或历史遗留）的 stars 徽章。
- **改了什么**：
  - **9a「徽章组合」去掉 stars**：有 remote 时从原来的 4 枚（License + stars + last-commit + Type）改为 3 枚（License + last-commit + Type）；并显式注明「不使用 GitHub Stars 数量徽章，已存在的 stars 徽章由第 9l 步清理」。无 remote 情形不变（2 枚：License + Type）。
  - **新增第 9l 步「README 不含 GitHub Stars 数量徽章」**（缓存标记 `readme-no-stars-badge`）：扫描 `README.md` 与 `README_cn.md` 的徽章行，凡 URL 路径含 `github/stars/` 的徽章 → 删除该整行 markdown；其余徽章 / LOGO / 正文一律保留。本步明确**突破 9a「只补不删」原则，仅针对 stars 徽章删除**（不删其它徽章、不动 LOGO 与正文）。两版均无 stars 徽章（或某份文件不存在）→ 写 `readme-no-stars-badge` 缓存标记。与 9a 互补：9a 管「该有的徽章是否齐全」（且不再加 stars），9l 管「清理已存在的 stars」。
  - **同步各处引用，保持 skill 内部自洽**：第 9 步开头的「本地检测 / 例外跳过」编号清单（原 `9a/9b/9d/9g/9h/9k` 与 `9a–9k` 两处）补入 9l；「CLAUDE.md 检测缓存」段的标记计数从「七类」改为「八类」、缓存模板补 `readme-no-stars-badge` 块、标记说明补一行；`description` 在「徽章」处加括注「(不含 GitHub Stars 数量徽章)」；「例外仅六类」编辑授权清单两处（核心定位段 + 注意段）补「移除 GitHub Stars 数量徽章（第 9l 步）」；汇报段补「徽章清单（含移除 GitHub Stars 数量徽章，如有）」。
  - **同步全局**：权威源改动完成后 `cp` 覆盖全局 `~/.claude/skills/commit/SKILL.md`，`diff` 验证两份逐字节一致（均 49033 字节）。
- **落地说明**：各 agent 项目（如本次触发场景 PersonalAssistantAgent）的 README 若仍有 stars 徽章，下次 `/commit` 时第 9l 步会自动检测并删除（首次运行因缺 `readme-no-stars-badge` 标记而必查）。本次 PersonalAssistantAgent 的 `README.md` / `README_cn.md` 已手动删除 stars 徽章（该项目无 CHANGELOG.md，故该处改动不另记）。

## 2026-08-02

### 变更（CLAUDE.md 规矩修订：待办从「todos/ 目录」改为「项目根 TODO.md 单文件」+ 已完成待办打 ✅ 保留不删）

把全局 `~/.claude/CLAUDE.md` 与本项目权威源 `.claude/CLAUDE.md` 的「待办（todo）」一节整体修订，两边现已逐字节一致。

- **为什么改（用户 2026-08-02 立）**：
  - **不再用 `todos/` 目录**：单文件 `TODO.md` 就够用，少一层目录更简单；`TODO.md` 内部按主题分节（`##` 二级标题）即可分类，不必拆成多文件。
  - **已完成待办打 ✅ 保留、不删除**：原来「做完改动就把待办从清单删除」，改成「打 ✅ 标记完成、原条目保留不删」——保留完整的待办记录（当初打算做什么、做没做、什么时候做的），方便日后出问题时回溯排查。
- **改了什么**：
  - 标题从「待办（todo）统一存项目根 todos/ 目录（2026-08-01 用户立）」改为「待办（todo）统一存项目根 TODO.md（2026-08-01 用户立，2026-08-02 修订）」。
  - 存放位置：`项目根的 todos/ 目录` → `项目根的 TODO.md 文件`；「为什么」段补「不再用 todos/ 目录」的理由；「怎么用」段去掉「按主题拆多个文件」、改为「TODO.md 内部按主题分节」。
  - 「前后矛盾的待办以最新时间戳为准」：旧条处理从「要么删除、要么标注被取代」改为「不删除、标注被取代并打 ✅」（与新的「不删除」基调一致）。
  - 「做完改动要闭环」：从「查 todos/ → 删待办 → 记 CHANGELOG」改为「查 TODO.md → 标 ✅ 保留 → 记 CHANGELOG」，明确「不要删除已完成待办条目，保留方便回溯排查」，并建议补完成时间戳 `（完成：YYYY-MM-DD HH:MM）`。
  - 注：各业务项目里现有的 `todos/TODO.md` 需自行迁移到项目根 `TODO.md`、并清理 `todos/` 目录（属各项目自己的落地动作，不记入本 CHANGELOG）。

### 变更（CLAUDE.md 待办规矩补充：已完成 / 已更新双状态标记格式）

把全局 `~/.claude/CLAUDE.md` 与本项目权威源 `.claude/CLAUDE.md` 的「待办（todo）」节里「做完改动要闭环」「前后矛盾的待办以最新时间戳为准」两条，补充**双状态标记格式**；两边现已逐字节一致。

- **为什么改（用户 2026-08-02 立）**：原来待办处理只有「完成」一种状态（`[ ]` 改 `✅` + 完成时间戳）。但实际还有「表述被新决定取代、事还没做完」的情况（如决定从「放弃 signal 改纯 auto」变为「两者共存」，旧待办表述过时但事项未完成）——这种情况用「完成」标记会误标（事没做完），用删除又丢失可追溯。遂引入「更新」状态，与「完成」区分。
- **改了什么**：
  - **标记格式**：「已完成」「已更新」三个字**加粗**以一眼区分两种状态；两种都原条目保留不删（可追溯）。
  - **完成（事情真做完）**：原条目开头 `[ ]` 换成 `✅**已完成**`、补 `（完成：YYYY-MM-DD HH:MM）`，原条目内容不动。
  - **更新（表述 / 决定被新决定取代、事还没做完）**：**原条目内容一字不动**，只在开头把 `[ ]` 换成 `✅**已更新**` + `（更新：YYYY-MM-DD HH:MM）`（标记挂在原条目前面，原标题 / 记录时间戳 / 正文都不改、不塞注释）；然后在下方**另起一段新增一条** `[ ]` 待办写最新决定（带新记录时间戳）。「已被取代」关系靠旧条目标记 + 相邻新条目 + 新时间戳表达。
  - **执行语义（看到 ✅ 即跳过）**：两种状态都使条目退出活跃待办——凡 `✅` 开头的条目（无论 `✅**已完成**` 还是 `✅**已更新**`）都视为已处理、看到即跳过、不再执行；活跃待办只有 `[ ]` 开头的条目（「更新」情况下要执行的是另起一段新增的那条 `[ ]`，不是挂标记的旧条目）。
  - 「前后矛盾以最新为准」条里旧条处理「打 ✅」同步为「打 `✅**已更新**`、原条目内容不动、另起一段新增」（旧条被取代属「更新」状态）。
- **落地**：各业务项目自己的 `TODO.md` 里，已处理待办的标记格式按此新规（如 DayTradingAgent 本次更新模式决定过期待办时已采用 `✅**已更新**`）。

### 新增（CLAUDE.md 硬性规定：Git 暂存区禁止 AI 自主增删改）

在全局 `~/.claude/CLAUDE.md` 与本项目权威源 `.claude/CLAUDE.md` 新增独立一节「Git 暂存区禁止 AI 自主增删改（2026-08-02 用户立，硬性规定）」，紧跟「Git 写操作必须先征得同意」节之后；两边现已逐字节一致。按「能否自主做」把 AI 对暂存区的操作分三层：

1. **AI 能自主做的：只有只读查询**（status / diff / log / show / ls-files / branch 等），无需授权。
2. **需用户明确授权才能做：`git commit`**——授权形式 = 用户主动发起 `/commit`（口头说「提交」、对 AI 列出的 commit 命令点头，都不算）；commit 提交用户已 `git add` 的内容。
3. **禁止（授权也不行）：对暂存区的增、删、改（含移动）**——`git add` / `git stage`（增）、`git rm --cached` / `git reset HEAD <file>` / `git restore --staged` / 影响暂存区的 reset（删）、`git mv` 等（改 / 移动）。

- **为什么新增（用户 2026-08-02 立）**：AI 此前用 `git mv` 移动文件时同步改了暂存区，篡改了用户亲自 `git add` 把关的暂存区内容。立这条硬规，把暂存区钉成「AI 自主只能只读、commit 需用户用 `/commit` 明确授权、增删改含移动一律禁止」，确保暂存区放什么、何时提交都由用户亲自决定，AI 永不替用户改动暂存区、也不擅自提交。
- **回溯修订「Git 写操作必须先征得同意」节**：核心禁令的命令列表里给 `git commit` 加注「仅限 `/commit` 触发、不走本节先征得同意」，指向本节，消除新老规矩的表面冲突。
- **边界**：工作区普通文件操作（不经 git 的 mv / rm / 编辑）不受限；只读不受限；`git commit` 仅限 `/commit` 触发；`git reset --soft`（只移 HEAD、不动暂存区）不在本节禁列（但仍属改仓库历史、受「先征得同意」约束）。

## 2026-08-01

### 新增
- **新建本 `CHANGELOG.md`**：本项目此前无 CHANGELOG。因「同步动作记权威源 CHANGELOG」规矩落地，建立本文件，首条即记本次同步。

### 变更（CLAUDE.md 规矩补充：全局领先 → 同步覆盖权威源）
本次把全局 `~/.claude/CLAUDE.md` 的三处规矩更新同步覆盖到本项目权威源 `.claude/CLAUDE.md`（全局此前已领先，本次一次性对齐，两边现已逐字节一致；`skills` / `rules` / `commands` 本就无 drift）：

- **「发布『最新版』默认指 GitHub Release」补充适用范围限定**：该默认只适用于用户自己的项目；别人的项目按其实际发布渠道（官方 Marketplace、Open VSX、官网等）判断，不默认往 GitHub Release 上靠。
- **「待办统一存 todos/」补充两条**：
  - 每条待办必须附带记录时间戳，格式 `（记录：YYYY-MM-DD HH:MM）`，**至少精确到分钟**（不能只到天）；时间戳记的是「这条待办当前内容的写下 / 更新时间」（不是待办涉及事件的发生时间），改主意重写正文后同步更新为重写那一刻。
  - 前后矛盾的待办以**最新时间戳**为准（旧条删除，或标注「已被 YYYY-MM-DD HH:MM 的条目取代、弃用」）；精确到分钟是为了同一天内多次改主意也能分先后。
- **「底层通用能力开源」补充两条**：
  - 全局与权威源出现分叉时**自动同步对齐**，不再每次询问用户（同步方向仍权威源优先；若全局领先则覆盖回权威源一次性对齐后继续走权威源优先）。
  - 同步动作本身的变更记录**只记本 CHANGELOG**，不记各业务项目 CHANGELOG。

### 变更（中英双语规定：从「纯英文/纯中文」改为「以某语言为主、特殊场景可用任何语言」）

把 GitHub About description、英文版 README、中文版 README 的语言基调规定，从原本硬性的「英文部分纯英文、中文部分简体中文」改为更实用、更严谨的弹性表述：**英文部分以美式英文为主（特殊场景可用任何语言），中文部分以简体中文为主（特殊场景可用任何语言）**。

- **为什么改**：原规定追求「逐字纯净」，commit skill 第 9a 步用「扫描 `README.md` 是否含中文字符、唯一允许跳转链接文字含中文」机械判定，会误伤正文里合理保留的中文专有名词、人名、机构名、产品名、引用原文、代码示例、注音等——这些是必要的内容元素、不是违规。一刀切「纯英文」既不实用（真实 README 常需混入少量其它语言字词）、也不严谨（把合理的特殊场景当成错误）。改为「以某语言为主、特殊场景可用任何语言」后，既保持「英文版主体是英文、中文版主体是中文」的基调，又给必要的中外混排留出合法出口。
- **改了什么**：
  - **`.claude/CLAUDE.md` + 全局镜像**「开源到 GitHub」段：description 的中英双语表述从「英文部分纯英文、中文部分简体中文」改为「英文部分以美式英文为主（特殊场景可用任何语言）、中文部分以简体中文为主（特殊场景可用任何语言）」。
  - **`.claude/skills/commit/SKILL.md` + 全局镜像**：① 第 9a 步把「语言纯度」（机械扫描中文字符、见中文即违规）整体改为「语言基调」（逐处语义判断：属特殊场景的中文保留不动、属「本该用英文却写成中文」的正文才改为英文），并明确 LOGO / 徽章默认用英文（项目名是中文等特殊场景可保留中文）、`README_cn.md` 反向同理（以简体中文为主、必要英文术语保留）；② 第 9c 步 GitHub About description 的中英双语判定与补全同步改为新基调；③ 「只补不删」「例外清单①」「缓存段说明」里的「语言纯度修正」「纯英文」「中文为主」等表述统一更新为「语言基调修正」「以美式英文为主」「以简体中文为主」。
  - **项目根 `CLAUDE.md`** commit skill 检测缓存注释：同步更新 GitHub About 条目里的中英双语规范表述。
- **影响**：commit skill 下次 `/commit` 检测 README 语言时，不再机械地「见中文即改英文」，而是逐处判断是否属特殊场景；属特殊场景的中文（专有名词、人名、引用原文等）保留不动，只有「本该用英文却写成中文」的正文才改为英文。本次改动已同步覆盖全局镜像，`CLAUDE.md` / `skills` / `rules` 三部分核对逐字节一致。
