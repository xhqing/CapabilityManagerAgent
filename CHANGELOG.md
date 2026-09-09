# Changelog

本项目（CapabilityManagerAgent）是 Claude Code 智能体舰队通用能力底座的**开源镜像仓库**：`claude/`（2026-08-03 起从 `.claude/` 迁入）下的 `skills` / `rules` / `CLAUDE.md` 三部分与全局权威源 `~/.claude/` 逐字节一致（2026-08-04 起权威方向反转：全局为权威、本项目 `claude/` 为镜像）。本 CHANGELOG 记录**通用能力底座的变更**——即 `claude/` 三部分的增删改，以及全局 ↔ 本项目镜像的同步动作。

> 按全局 CLAUDE.md「同步动作只记权威源的 CHANGELOG」规矩：通用能力的同步只记本文件，**不记到各业务 agent 项目**（如 DayTradingAgent 等）的 CHANGELOG，避免污染那些项目自己的变更记录。

## 2026-09-08

### 变更（项目迁移收尾：capability-manager skill 内路径更新）

- **为什么改**：本项目现址在 `~/Developer/CapabilityManagerAgent`（`~/Documents/Projects/` 旧址已弃用，2026-09-08 迁移收尾时发现 skill 的 `$AUTH` 定义、diff / 循环脚本里仍指旧路径），避免按 skill 操作时访问不存在的位置。
- **改了什么**：`.claude/skills/capability-manager/` 下 SKILL.md + references 三篇（sync-flow.md、registry-and-scaffolding.md、content-lifecycle.md）共 17 处 `~/Documents/Projects` / `$AUTH` 路径更新为 `~/Developer`；skill 为本项目专属（不入全局 ↔ 镜像同步体系），不涉及 `claude/` 三部分镜像。

### 变更（注册表：Kit 定位多面手，找单找岗整体移交 Hopkins）

- **为什么改**：用户 2026-09-08 口径调整——Kit（总经理助理）定位为第一助理、团队多面手，不再强调找单找岗；找单接活找工作整体移交 Hopkins 专门负责。
- **改了什么**：全局 `~/.claude/CLAUDE.md`（即 `~/.zcode/AGENTS.md` 软链接源）三处——注册表 Kit 行职责改为多面手（附 2026-09-08 移交注记）、Hopkins 行职责扩为「工作接单全链路（找单找岗、投递、转化一条龙，原由 Kit 发起的找单找岗动作并入）」、销售流水线段落 Kit 分工描述同步；本项目 `claude/CLAUDE.md` 镜像同步（diff 一致）。Kit 项目侧同步见 ExecutiveAssistantAgent CHANGELOG。

### 变更（超集映射表：Kit 新增子项目 CyberRipple）

- **为什么改**：用户 2026-09-08 把 CyberRipple 仓库（组织总览 README 中英双语）交由 Kit 负责，按超集规则须在全局映射表登记。
- **改了什么**：全局 `~/.claude/CLAUDE.md`（即 `~/.zcode/AGENTS.md` 软链接源）超集关系映射表新增一行「ExecutiveAssistantAgent（Kit） → CyberRipple（组织总览仓库；远程仓库待建）」；本项目 `claude/CLAUDE.md` 镜像同步（diff 一致）。子项目侧落地与标配补齐记 ExecutiveAssistantAgent CHANGELOG。

### 变更（团队注册表：Justin 定位纯法务直属——「财务与法务」残留括注清理）

- **为什么改**：用户 2026-09-08 二次明确口径——Justin 现在的定位是纯法务（职称「法务Agent」、项目名 `LegalAgent`、直属用户不属任何小组），财务职能暂时空缺；注册表 Justin 行行尾「（财务与法务，跨组服务全部小组）」括注与新口径矛盾，属前次精简三小组时的中间态残留。
- **改了什么**：全局 `~/.claude/CLAUDE.md`（即 `~/.zcode/AGENTS.md` 软链接源）Justin 行括注改为「（纯法务，跨组服务全部小组；财务职能暂时空缺）」；本项目 `claude/CLAUDE.md` 镜像同步（diff 一致）。同轮连带（Hopkins 会话）：xhqing README 双语 Justin 两处括注同步清理、CyberRipple org README 双语链接统一为 `LegalAgent`（GitHub 仓库尚未创建，立项待办见 ApplyOptimizerAgent TODO T12）。

### 变更（release / bump skill：安装链接固定 tag 形式，禁用 latest/download）

- **为什么改**：用户发现已发布 Release 的 notes 与 zcode-cli 三版 README 里安装命令用 `releases/latest/download/<带版本号资产名>.tgz` 形式——latest 指针随每次发布移动、资产名带版本号，版本一更新历史链接必然 404（zcode-cli 曾以「发版前预对齐」勉强维持，CHANGELOG 记录过两轮忘记执行导致 README 链接长期 404）。用户 2026-09-08 裁定弃用 latest 形式，改固定 tag URL（`releases/download/<tag>/<asset>`，永指该版本资产、历史链接不失效）。
- **改了什么**：① release skill（`~/.claude/skills/release/SKILL.md`）新增「安装链接：固定 tag 形式，禁用 latest/download」规范节——notes / README 安装链接一律固定 tag 形式、翻译改写 notes 时遇到存量 latest 链接顺手改、发布中发现项目 README 存量 latest 链接在汇报中列出建议随下次 bump 修（不当场改文件，保持发布原子性）；「注意」段未动（规范节自足）。② bump skill（`~/.claude/skills/bump/SKILL.md`）版本对齐范围调整——README 对齐项原排除「安装命令示例」，现改为：固定 tag URL 的安装命令版本号（tag 段与资产名）一并同步、遇到 latest/download 存量顺手改为固定 tag 形式（与 release skill 规范互指）。③ 本项目 `claude/skills/release/`、`claude/skills/bump/` 镜像同步（diff 验证逐字节一致）。zcode-cli 侧配套（README 9 处 + RELEASING.md 口径 + Release notes 存量）记 zcode-cli 自己的 CHANGELOG。

### 变更（团队注册表：投资与交易小组联动口径更新——删除 Markowitz→Victor 信号供给关系）

- **为什么改**：用户 2026-09-08 明确「量化策略师和日内交易员之间没有『标定信号』联系，这个定位过时了」——注册表与小组段里的「产量化信号给 Victor 当加权投票员 / 当加权输入」为旧口径，须删；两人在小组内的职责改为并列陈述（Markowitz 量化策略研发与回测标定，Victor 日内盯盘发信号）。
- **改了什么**：全局 `~/.claude/CLAUDE.md`（即 `~/.zcode/AGENTS.md` 软链接源）两处——注册表 Markowitz 行职责描述去掉「→ 产量化信号给 Victor 当加权投票员」、五小组段「投资与交易小组」括注改为并列职责表述；本项目 `claude/CLAUDE.md` 镜像同步（diff 验证与全局逐字节一致）。触发场景：CyberRipple org README 架构图绘制时用户纠正（Hopkins 会话执行）。

### 变更（dev-workflow 大转向重写为本地门禁版：镜像同步 + CodeBuddy 分发补齐）

- **为什么改**：2026-09-07 晚用户对开发工作流大转向定稿并拍板两轮口径（7 项 + 4 项）——远端 GitHub PR / CI 门禁整体取消（各仓库存量 `ci.yml` 保留不动、不再新增），裁决全部本地化：开工门禁（main 上须有 pending 需求组）+ 机器门禁（本地全量测试：passed 全绿 + 本次组全绿、其它组不阻塞）+ 人工门禁（用户装测试版安装包按 requirement.md 验收）+ 超集硬校验快进合并 + Hopper 归档验收。ZCode 侧 `~/.zcode/skills/dev-workflow/` 当晚整篇重写（SKILL.md 130 行九步骨架 + 三个 references：test-cases / merge-discipline / acceptance；旧 `references/ci-templates.md` 删除）；配套「测试用例目录只读」四端 hook（`~/.claude/hooks/test-cases-guard.py`，CC / ZCode / CodeBuddy / Trae 挂载，授权标记 `# TEST_CASES_WRITE_OK`）。全局权威源 `~/.claude/skills/dev-workflow/` 已是新版（与 ZCode 逐字节一致），但本项目 `claude/` 镜像仍停留在 2026-09-07 白天的 PR + CI 纪律制版本、CodeBuddy 端缺失——本轮补齐。
- **改了什么**：① `claude/skills/dev-workflow/` 从全局权威源 rsync 同步（含删除旧版 `references/ci-templates.md`），diff 逐字节验证一致；② `~/.codebuddy/skills/dev-workflow` 按该端软链惯例（既有 9 个 skill 同模式）建软链指向权威源；③ TestEngineerAgent（Hopper）角色文件 `CLAUDE.md` 同步对齐新流程（用例生产线 + 本地门禁裁决权 + hook 授权标记写入通道），变更记录记该项目自己的 CHANGELOG。
- **分发格局澄清（用户两次指正后实测定稿）**：权威源唯一在 `~/.claude/skills/dev-workflow`。ZCode（09-06 起即软链）与 CodeBuddy 为**条目级软链**指向权威源；**Trae CN 为 skills 目录级软链**（`~/.trae-cn/skills` → `~/.claude/skills`，inode 实证同一目录）——2026-09-07 晚经 ZCode 路径的重写实际直接落在权威源上，CC / ZCode / CodeBuddy / Trae 四端全部零维护、改权威源即生效。**唯一需要改动后手动同步的实体副本是本项目 `claude/` 开源镜像**（镜像实体进 git，体系使然）。

## 2026-09-07

### 变更（新增全局 skill：scroll-reverser——Mac 滚动方向工具 Scroll Reverser 的使用、配置与失灵修复）

- **为什么改**：用户 2026-09-07 交办——本机长期用 Scroll Reverser（Pilotmoon，开源）反转触控板滚动方向，偶发失灵（方向变回系统默认），要求把使用 / 配置 / 排障方法沉淀为全局 skill 供全部 agent 掌握，失灵时直接排查修复、无需现查。
- **改了什么**：
  - 新建 `~/.claude/skills/scroll-reverser/`（权威源）：`SKILL.md`（116 行，失灵六步分级修复流程 + 配置键速查 + 常见坑；description 229 字符，远低于 ZCode 1024 上限）；`references/guide.md`（完整参考：CGEventTap 工作原理、权限与官方重授权流程、安装 / 升级 / 卸载、全部偏好键与默认值、已知问题表——唤醒失灵自愈机制（ReleaseNotes v1.7.3）、外接屏需彻底重启（issue #132）、macOS 26 时好时坏（issue #200）、手势界面不可反转（#184）、AppleScript enabled 接口）；`local/`（本机数据，config.md 存本机应然配置快照与一键恢复命令块，按「Skill 内容纯净性」不进镜像，仅 README.md 入库）。
  - `~/.zcode/skills/scroll-reverser` 软链至权威源（ZCode 全局可用，与既有 20 个 skill 同模式）。
  - 镜像 `claude/skills/scroll-reverser/` 同步（SKILL.md + references/ + local/README.md，diff 逐字节验证一致；local/config.md 排除）；`.gitignore` 补 `claude/skills/scroll-reverser/local/*` + `!README.md` 排除规则。
  - **调研依据**：官方站点（版本 / 系统要求 / FAQ 重授权流程 / brew cask 安装）+ 源码键名实证（clone 仓库读 `AppDelegate.m` registerDefaults 与 `MouseTap.m` 反转逻辑链、sdef AppleScript 词典）+ GitHub issues（#132 / #195 / #200 / #92 / #184 / #38 / #165）+ 本机实测（AppleScript get enabled 通道打通、plist / 登录项 / 安装位置核查；发现本机装在桌面 iCloud 目录，已作为迁移建议记入 local/config.md）。

### 变更（main push 政策放宽：dev-workflow / commit / bump / release 四 skill 修订 + 镜像同步）

- **为什么改**：用户 2026-09-07 裁定三项——① **main push 不做限制**：受保护 main 挡住了一切直接 push（本地 main 领先想直推被拒、合并后本地 main 需绕路 reset 对齐），代价大于收益；② **普通文件处理修改不走 dev-workflow**：文档、版本号 bump、配置等不新增测试用例、不碰核心功能的杂事，直接在 main 上改 + commit + push；③ **只有存在测试用例的软件开发项目才走 dev-workflow**（feature 分支 + PR + CI）。推翻 2026-09-06 的「全团队统一无豁免配分支保护」与「main 仅本地提交」两项政策。
- **改了什么**：
  - **GitHub 远端**：撤除 zcode-cli 与 CapabilityManagerAgent 两个仓库的 main 分支保护（required checks `validate` + enforce_admins——全团队唯二挂保护的仓库，实测其余仓库均未保护）。撤除依据：GitHub 的 required checks 一旦配置就同时挡 merge 和直接 push、无法只挡其一；官方文档确认 auto-merge 仅对「有不满足合并要求的 PR」提供，无 required checks 的仓库 auto-merge 选项根本不出现。
  - **`skills/dev-workflow/`**：适用范围收窄为「存在测试用例的软件开发项目」（原：每个仓库必须配门禁、全团队统一无豁免）；main 不设分支保护、不限制直接 push，「CI 绿才合并」改由流程纪律保证；第 0 步门禁自检四项瘦身为两项（fork 检测 + CI workflow 存在；删分支保护配置与 auto-merge 开关检查）；第 4 步 `git publish` 别名从 `--auto`（auto-merge）改为 `gh pr checks --watch && gh pr merge --squash --delete-branch`（等 CI 完成、全绿退出码 0 才合并，红灯链自动中断）；第 5 步 strict 绿灯过期条目改为纪律建议（无强制）。`references/ci-templates.md`：job 名 `validate` 不再关联分支保护；删「纯文档仓库极简 CI 模板」段（纯文档仓库不走 dev-workflow、不配 CI），YAML 引号坑移入调整原则。
  - **`skills/commit/`**：main 分支感知从「仅本地提交模式」（2026-09-06 立）恢复为直推——`git commit && git push` 直推远程 main（普通文件修改、杂事、main 对齐走这条通道）；功能分支 PR 链第 3 步从设 auto-merge 改为 `gh pr checks --watch` 等 CI 完成绿灯 squash 合并（红灯不合并、报失败 job 与日志指引；会话不便久等时报 PR 号由用户手动收尾）；9j 版本滞后指引同步 bump 新流程；description 828 字符（< ZCode 客户端 1024 上限，实测安全）。
  - **`skills/bump/`**：流程简化为 main 直改——对齐 main → 在 main 上直接改齐版本号 → 指引 `git add` + `/commit` 直推（原：建 `chore/bump-<版本>` 分支走 PR；bump 属普通文件处理修改、不走 dev-workflow）；功能分支不碰版本号纪律不变；新增「改动只限版本号载体文件」边界。
  - **`skills/release/`**：对齐校验措辞同步（bump 走 `/commit` 直推、功能分支等 PR 合并）；删「不受 main 分支保护限制」的过时说明。
  - **镜像同步**：`claude/skills/` 补齐缺失的 dev-workflow（SKILL.md + references/）与 bump（SKILL.md），更新 commit / release 两份 SKILL.md，`diff -rq` 逐字节验证通过；`backup/endpoints/endpoints.json`（本机敏感数据）按规则不同步。
  - **待处理**：镜像 `claude/skills/win-ai-monitor/scripts/` 在全局无对应、且两侧 SKILL.md 有差异——本次未动的既有分叉，待判断方向后处理。
  - 关联：TestEngineerAgent `CLAUDE.md` 工作原则同步修订（记其自己的 CHANGELOG）。

## 2026-09-06

### 变更（commit skill description 压缩至 1024 字符以内：修复 ZCode 客户端发现不了该 skill）

- **为什么改**：2026-09-06 在 zcode-cli 会话实测定位——ZCode 官方 runtime 对 skill 的 frontmatter description 有 1024 字符硬上限（vendor/zcode.cjs 中 `desc.length > 1024` 即丢弃、错误码 `skill_description_too_long`；官方 zcode-guide 插件的 diagnosing-skills 指南明文同口径），commit skill 的 description 1126 字符超限，整个 skill 被 ZCode 加载器丢弃、Skill 工具报 `Skill not found: commit`。CC 侧不受影响（该上限是 ZCode runtime 行为）。同病待修：ef-communication（1465 字符）同样超限被丢。
- **改了什么**：`skills/commit/SKILL.md` frontmatter description 从 1126 压缩至 751 字符——保留全部语义骨架（触发词、只提交暂存区不执行 git add、main 分支仅本地提交模式、敏感扫描 + cache 检测命中即彻底终止、功能分支 PR 链 + auto-merge、push 后项目标配补齐与 `.commit-cache.md` 缓存、版本滞后与版本号一致性两个每次必查检测），去掉正文已详述的枚举细节；顺手把过期的「gh pr create --fill」表述改为「创建（标题须具体达意）」，与正文第 8 步 2026-09-06 的 PR 标题规范对齐。镜像同步：`~/.zcode/skills/commit` 为指向 `~/.claude/skills/commit` 的软链接（同一文件、天然同步）；`claude/skills/commit/SKILL.md` 已 cp 覆盖并逐字节核对，三处 description 实测均 751 < 1024。

### 变更（全局 CLAUDE.md 小组更名：任务池投标小组 → 工作接单小组）

- **为什么改**：用户 2026-09-06 拍板——小组名升级为「工作接单小组」，「任务池投标」降为小组下的接单策略之一（与招聘平台求职并列，同一条投递漏斗统一优化）；原小组名以「投标」命名整体，覆盖不了求职投递这条并行策略。
- **改了什么**：全局 `~/.claude/CLAUDE.md`（+镜像 `claude/CLAUDE.md`，diff 验证逐字节一致）三处：① 注册表 Hopkins 行——「任务池投标小组的漏斗上游」改「工作接单小组的漏斗上游」、职责补「任务池投标与招聘平台求职同为小组下的接单策略」、隶属改「工作接单小组」；② 「销售流水线顺序」段五小组列举——小组名改「工作接单小组」，注明「任务池投标与招聘平台求职为小组下并行的接单策略——小组原名任务池投标小组，2026-09-06 更名」；③ 同段 Kit 括号改「工作接单小组的找单找岗动作由 Kit 发起」。各项目文件同步记各自 CHANGELOG。

### 变更（全局 CLAUDE.md 注册表 Hopkins 行更名：BidOptimizerAgent → ApplyOptimizerAgent）

- **为什么改**：电鸭平台岗位多为全职岗、有详细 JD、沟通需发简历——与 BOSS直聘求职同构，「投单」与「找工作」合流为同一条投递漏斗（用户 2026-09-06 拍板），原名的 Bid（投标）覆盖不了投简历找岗位。项目更名 ApplyOptimizerAgent、Title 改「投递转化率优化师」，职责描述同步扩展；拟人名 Hopkins 保留（科学广告方法论——简历即自我广告、话术即文案、漏斗归因即本行——与投递优化同构，更名后更贴切）。
- **改了什么**：全局 `~/.claude/CLAUDE.md`（+镜像 `claude/CLAUDE.md`，diff 验证逐字节一致）注册表 Hopkins 行——项目名、Title、职责描述三处更新（投递材料工程、漏斗含沟通 / 面试 / offer 环节、渠道清单纳入电鸭 + BOSS直聘），注明更名背景与日期。项目本体与各项目引用同步细节记 ApplyOptimizerAgent / xhqing 等各自 CHANGELOG。

### 变更（全局 CLAUDE.md 注册表新增 Hopper / TestEngineerAgent 行）

- **为什么改**：用户新建软件测试 Agent TestEngineerAgent（Hopper，软件测试工程师，2026-09-06 立项）——因团队软件项目反复出现回归（「改 A 坏 B」），按「新建带拟人名的 Agent 时自动维护注册表（免确认）」规矩，注册表追加新成员行、基础设施小组成员清单同步更新。
- **改了什么**：全局 `~/.claude/CLAUDE.md`（+镜像 `claude/CLAUDE.md`，diff 验证逐字节一致）两处：① 注册表表格加 Hopper 行（职责：需求转验收用例 / 存量补网 / 用例库与 CI 维护 / 验收判定，三权分立设计，隶属基础设施小组）；② 「销售流水线顺序」段基础设施小组成员清单末尾补 Hopper 一句。项目本体与关联同步细节记 TestEngineerAgent / xhqing 各自的 CHANGELOG。

### 变更（backup skill 开源化重构：Skill 内容纯净性规则首次落地 + 全局 CLAUDE.md 新增该规则）

- **为什么改**：用户 2026-09-06 立规则——**skill 核心功能文件必须可开源**（不含对 clone 者来说莫名其妙或无用的内容），**私人信息一律像凭证一样存放在用户级目录下被忽略的子目录中**。backup skill 自查发现三类私人信息散布在功能文件：云端根文件夹标识与命名（references/feishu.md、scripts/backup.sh 硬编码常量）、本机代理细节（references/feishu.md）、个人规则署名出处与事件叙述（SKILL.md / feishu.md / backup.sh 注释多处「用户 2026-09-0X 立」）。
- **改了什么**：
  - **全局 `~/.claude/CLAUDE.md`**（+镜像 `claude/CLAUDE.md`）：skill-creator 节后新增「Skill 内容纯净性：核心可开源 + 私人信息用户级存放」节——功能文件可开源标准、私人信息定义（token / folder 标识、个人命名、机器环境细节、署名出处、事件叙述）、存放模式（与凭证同模式进 skill 的本机数据子目录）、配置值进注册表、通用坑保留、新建即遵守 + 既有顺手清理。
  - **`skills/backup/`**：
    - `endpoints/endpoints.json`（本机数据，不进镜像）：新增私有字段 `root_folder_name` / `root_folder_token`（云端根备份文件夹）、`notes`（本机网络环境细节）；
    - `scripts/backup.sh`：删除硬编码的根文件夹 token 常量，改为从注册表按端点类型读取（缺失时报错提示注册）；`upload_one_feishu` 对 `.md` 文件自动走 `docs +create` 转飞书文档（docx）上传（标题 = 文件名去扩展名），与端点落位约定一致；注释去个人署名；
    - `references/feishu.md`：重写为通用版——私有值改占位符并指向注册表，保留全部通用机制（目录布局、认证、四坑、MD→docx 转换流程与三坑、查看恢复）；
    - `SKILL.md`：description 与正文的个人配置当前值改为「见注册表」、个人署名出处与事件叙述删除、凭证纪律节扩展为「凭证 + 本机私有数据同纪律」；
    - `endpoints/README.md`：字段说明补私有字段（root_folder_* / notes），写明「功能文件纯净 + 私有值进本目录」设计原则。
  - **验证**：`bash -n` 语法通过；注册表 token 读取正常；功能文件（SKILL.md / references / scripts / README）私人信息扫描清零；临时项目端到端实测——脚本从注册表读 token 建云端文件夹、`.md` 实际转为 docx（type=docx、标题与内容抽验通过），测试产物已全部清理。
  - **镜像同步**：`claude/skills/backup/`（SKILL.md / README.md / references / scripts / endpoints/README.md）与 `claude/CLAUDE.md` 已 cp 覆盖，md5 逐一核对一致；`endpoints/endpoints.json` 为本机数据按 gitignore 规则不入镜像。

### 变更（新增 CI workflow + main 分支保护：dev-workflow 门禁引导）

- **为什么改**：新建分支触发 dev-workflow 门禁自检，发现仓库缺三项门禁——无 CI workflow、main 无分支保护、auto-merge 未开；「main 必须永远绿」需要 PR 触发的 CI + required check 把「改 A 坏 B」的红灯拦在合并进 main 之前。
- **改了什么**：① 新增 `.github/workflows/ci.yml`（纯文档仓库极简模板：push main / pull_request / workflow_dispatch 三触发，`validate` job 秒级空验证，checkout 不保留凭证）；② main 配分支保护——required check `validate`（strict 模式）+ enforce_admins + 禁 force push 与删除，改动一律经 PR 合并；③ 仓库打开 allow_auto_merge（`gh pr merge --auto` 自动合并链的前提）。全程经 GitHub API 配置（gh token 补 workflow scope 后写入 workflow 文件）。

### 变更（commit skill：main 分支由「彻底终止」修订为「仅本地提交」，镜像同步补齐欠账）

- **为什么改**：用户 2026-09-06 修订——当日上午立的「main 分支且有提交历史 → 彻底终止」把「在 main 上只做本地提交、暂不推送」的需求也堵死了（如本地攒批改动、后续再经功能分支 + PR 进远程 main）。改为：感知到当前在 main（或 master）且有提交历史 → 不终止，敏感扫描 / cache 检测与 `git commit` 照常执行，但跳过全部推送动作（不 `git push`、不创建远程仓库、不建 PR、不设 auto-merge）——远程 main 仍只能经 PR + CI 门禁进入，本地 main 提交不同步远程。全新仓库无提交历史的初始提交场景维持原样（push 直推 main，新仓库无分支保护）。
- **改了什么**：全局 `~/.claude/skills/commit/SKILL.md`（权威源）多处：① description——main 感知句由「即彻底终止」改为「降级为仅本地提交模式」；② 「触发与终止规则」——「main 分支终止」条目改为「main 分支降级为仅本地提交」，「命中即彻底终止」的列举去掉 main 分支检测；③ 执行流程第 0 步——main 有提交历史分支由「立即彻底终止」改为「进入 main 仅本地提交模式：继续第 1-7 步、跳过第 8 步全部推送」；④ 第 7 步——补 main 模式无 push 可串联、单独执行 `git commit`；⑤ 第 8 步——开头加总闸「main 仅本地提交模式跳过本步全部动作（含 `gh repo create`——其自带推送、与不推送矛盾）」；⑥ 第 9 步——补 main 模式同样进入本步：本地检测项照常、push 依赖项（9c / 9j）自然跳过；⑦ 9j 前置示例补「push 未成功（含 main 仅本地提交模式未推送）」；⑧ 「核心定位」与「注意」段的 && 串联条目各补 main 例外；⑨ 汇报段——删「因 main 分支检测终止」分支，加「main 仅本地提交模式加报：仅本地未推送 + 本地领先 origin/main 提交数 + 后续出路」。
- **镜像同步**：`claude/skills/commit/SKILL.md` 随本次 cp 对齐全局，diff 验证逐字节一致——该镜像此前已落后全局一轮（缺当日上午的 main 分支感知、PR 链、9j 提示制、`>> git status` 命令标记等改动），本次一并补齐；ZCode 客户端用户级路径 `~/.zcode/skills/commit/SKILL.md` 与全局为硬链接（同 inode），天然同步。

## 2026-09-05

### 变更（commit skill 汇报收尾新增 git status 原样输出）

- **为什么改**：用户 2026-09-05 要求——commit skill 处理完到最后汇报时，最后一件事应执行 `git status`，并把命令输出**原样**以代码块方式直接输出，让用户在每次 `/commit` 结束时直接看到工作区与暂存区的真实状态（尤其第 9 步补标配会产生新的未提交工作区改动、终止情形下暂存区还有待处理内容），不必再自己跑一遍命令。
- **改了什么**：`skills/commit/SKILL.md` 两处协同——① 「执行流程」在原第 9 步（项目标配检测）之后新增**第 10 步**：进入汇报时作为汇报的最后一件事执行一次 `git status`，输出原样以代码块直接输出（不加工、不总结、不截断、不做额外解读），并明确**无论流程完整走完还是中途终止（敏感内容扫描 / cache 检测命中），汇报都以该代码块收尾**；② 「汇报」节末尾追加对应的收尾要求，与第 10 步互相指代。三副本同步：全局 `~/.claude/skills/commit/`（权威，直接编辑）→ `~/.zcode/skills/commit/`（符号链接指向全局、自动一致）→ 本项目 `claude/skills/commit/` 镜像（cp 覆盖后 diff 核对，逐字节一致）。

## 2026-09-04

### 变更（公开文件脱敏整改：隐私类别词本身即敏感信息，全链路清零）

- **为什么改**：用户 2026-09-04 二次纠正——**隐私类别名（如具体个人事务类目词）本身就是私人敏感信息**：公开仓库读者看到类别词即可推断仓库主的私人情况。首版 TODO 分流条文与变更记录自己点名了类别，属「一边立规矩一边泄密」的同源泄露；顺藤排查发现同一条公开管线（全局 CLAUDE.md → CMA 镜像 → 各项目公开文件）的存量条目里也有类别词残留。
- **改了什么**（2026-09-04 21:18-22:00）：
  - **全局 `~/.claude/CLAUDE.md` + 镜像 `claude/CLAUDE.md`**：TODO 分流条文的类别举例改为中性表述「个人隐私类待办」，并新增「条文与指引本身一律中性、不点明具体隐私类别——类别名本身即敏感信息」的明文要求。
  - **本仓 CHANGELOG.md 存量 4 处**（backup / md2pdf 历史条目）与**当日新增条目**：类别词全部改为「个人文档 PDF」「含个人身份的敏感文件名」等中性表述。
  - **skills/md2pdf**（SKILL.md description 1 处 + references/pitfalls.md 2 处）：触发词清单与案例来源表述去类别词，全局权威副本与镜像同步（diff 一致）。
  - **skills/agent-reach**（SKILL.md description 1 处）：平台触发词清单去 1 个类别词、保留平台名（触发语义不受影响），镜像同步。
  - **关联项目同步整改**（各记其本地记录）：ProductStrategistAgent hot-trend skill 1 处痛点类目词改中性（该文件已进其 git 历史、历史清洗待用户决策）；BidOptimizerAgent TODO-archive 3 处（提案形态表述、盯盘时间约束、电量玩法表述）改中性（同已进历史）。
  - **验证**：本机全部仓库（Developer/ 下 16 个 + xhqing）公开文件扫描（已跟踪 + 未跟踪、排除 gitignore 目录）类别词清零；两仓 git 历史 `git log -S` 扫描确认敏感词均未进历史（CMA 的全部改动、ExecutiveAssistantAgent 的 TODO 均为未提交状态，改文件即彻底解决，无需重写历史）；已进历史的仅 PSA hot-trend 1 处与 BidOptimizerAgent TODO-archive 3 处（详见下条风险报告）。

### 变更（TODO 管理规则增补：个人隐私类待办分流 local 版文件）

- **为什么改**：用户 2026-09-04 指出，个人隐私类内容不得放在公开版 `TODO.md` / `TODO-archive.md`（会被 git 跟踪、随开源仓库公开），应放相应的 local 版文件（如 `TODO.local.md`）。当日 ExecutiveAssistantAgent 的公开版 TODO 里挂着一批个人隐私类全流程待办，属应分流存量——趁两文件尚 untracked（未进 git 历史）及时移走。同日用户二次纠正：**隐私类别名本身即敏感信息**（公开文件里出现类别词，读者即可推断仓库主的私人情况），首版条文与变更记录自己点名了类别、属同源泄露，本条目与全局条文均已改为中性表述。
- **改了什么**：全局 `~/.claude/CLAUDE.md` 「待办（TODO）管理」节三处修订并同步镜像 `claude/CLAUDE.md`（diff 一致）——① 标题日期补「2026-09-04 增补个人隐私类待办分流至 local 版文件」；② 「文件结构」新增「个人隐私类待办分流 local 版」条目：`TODO.local.md`（活跃）+ `TODO-archive.local.md`（归档）加入 `.gitignore`、格式与编号与公开版一致、编号共用同一套空间、公开版头部加分流指引（指引措辞与条文本身一律中性、不点明具体隐私类别——类别名本身即信息）；③ 「编号在项目内全局递增」补「取最大值时 local 版两文件同样要扫」；「边界」补隐私类待办整体分流的指路。存量分流落地（记 ExecutiveAssistantAgent 本地记录）：T1 / T1.5 / T2 / T3 四条移入该项目 `TODO.local.md` / `TODO-archive.local.md`，`.gitignore` 加两行忽略、公开版两文件清空并留中性指引。

### 变更（backup skill 增补备份目录准入纪律：只收用户点名文件 + 副本冗余不移动）

- **为什么改**：用户 2026-09-04 指出 `backup/` 目录存放内容的严格要求——① 只有用户主动点名要备份的文件才放进来：agent 不得自作主张放入，点名之外的文件进备份目录 = 被上传云端，等于替用户决定了什么该上云；② backup/ 里的文件必须是冗余副本、原文件留在原位置（完整多端模型 = 本地原文件 + backup/ 副本 + 云端各一份）——skill 原文写的「移动进去」会把原位置掏空、让 backup/ 持有孤本，与多端冗余的动机相悖。当日实盘教训：三份被点名「只备份到飞书」的文件被放在 backup/ 根下（= 会备份到全部端点）、一份从未被点名备份的工作手册被顺手放进 backup/，两处均不符合要求，随本条规则一并整改（两项目的 backup/ 整改明细各记其本地记录，不在本条展开）。
- **改了什么**：`SKILL.md`——① description 补「只收用户明确点名要备份的文件，复制副本进目录、原文件留原位置」；② 「备份范围」节重写三条 bullet：新增「只收用户明确点名的文件」「backup/ 里放副本，原文件留在原地」（复制不移动，原文件日后更新则重新复制覆盖副本），固定路径配置文件用符号链接的理由更新为「自动跟随原件更新、不像副本会过期，原件在场冗余天然成立」；③ 动作①「放入备份目录」第 2 步从「移动」改为「复制」，点名端点的文件明确「放进 `backup/<端点名>/`、不放根下——放根下 = 备份到全部端点」，第 4 步取消备份措辞同步（移出删除副本、原文件不受影响），步骤后补一行「没被点名过的文件不进 backup/，agent 认为值得备份时先建议」；④ 「通用纪律」新增第 5 条「放入前自检两问」（是否用户点名 / 本地原文件是否仍在原位置，发现孤本先补回原位置再放入）。`README.md`——「统一的备份范围」bullet 同步补「只收用户明确点名的文件——复制副本进目录、原文件留原位置，backup/ 永不持有孤本」。三副本同步：全局 `~/.claude/skills/backup/`（权威，直接编辑）→ `~/.zcode/skills/backup/`（符号链接指向全局、自动一致）→ 本项目 `claude/skills/backup/` 镜像（cp 覆盖后 diff 核对，唯一差异为机器本地的 `endpoints/endpoints.json`，属既定例外）。

## 2026-09-03

### 变更（脚手架规则修订：新建项目不建 `.claude/` 目录——`CLAUDE.md` 直接放项目根 + 项目根 `AGENTS.md` 软链接指向它）

- **为什么改**：用户 2026-09-03 修正全局脚手架规则——旧规定对 `CLAUDE.md` 的位置没有明说放项目根、容易被放进 `.claude/` 下，且要求新建项目照建 `.claude/settings.json` / `settings.local.json` / `settings.local.example.json` 等项目级配置；用户裁定这些一律不要，新建项目**不建 `.claude/` 目录**。同时新加一条：建项目根 `CLAUDE.md` 的同时，在项目根建一条 `AGENTS.md` 软链接指向 `CLAUDE.md`（兼容只认 `AGENTS.md` 的 agent 工具；当日已在 BidOptimizerAgent 按新制落地验证）。
- **改了什么**：全局 `~/.claude/CLAUDE.md` 三处修订并同步镜像 `claude/CLAUDE.md`（diff 一致）——①「新建 Agent 项目的脚手架与开源约定」：原「不复制通用能力」条改写为「不建 `.claude/` 目录」（旧规定要求照建的 `.claude/` 下文件一律不要，项目根只建 `LICENSE.md` 等根目录文件）；「角色化 `CLAUDE.md`」条明确「直接放项目根目录」，并新增「建项目根 `CLAUDE.md` 的同时在项目根建软链接 `AGENTS.md`（`ln -s CLAUDE.md AGENTS.md`，内容天然同步）」。②「通用能力开源单一出口」：开头句与「怎么用」条同步改为「新建项目一律不建 `.claude/` 目录」，既有仍带 `.claude/` 的项目照旧维护。

## 2026-09-02

### 变更（backup 飞书端点改原文件直传 + 格式白名单：mode / file_formats 端点级配置）

- **为什么改**：用户 2026-09-02 两步指示——先要求把三份个人文档 PDF「备份原文件、不要压缩」手动直传飞书（实测云端可直接预览、无需下载解压），随即立规：**以后备份到飞书都以用户指定的文件格式备份，维护一份格式白名单，目前只允许 `['*.pdf','*.md']`**。tar.gz 打包形态对飞书端点废除，改为原文件直传 + 白名单过滤。
- **改了什么**：
  - **注册表新字段（机制通用化）**：每端点可配 `mode`（`raw` 原文件直传 / `archive` 打包 tar.gz，缺省 archive）与 `file_formats`（glob 白名单数组，大小写敏感，raw 模式生效）——feishu 条目设 `mode: "raw"` + `file_formats: ["*.pdf", "*.md"]`；将来任何端点（含 rclone）都可用同字段配置，维护白名单 = 改注册表数组、即时生效。
  - **脚本双模式**：`run_raw_backup`（raw）逐文件直传、云端按 `backup/` 内相对路径镜像建文件夹（含端点专属子目录、归档子目录），白名单不匹配逐条 `[SKIP]` 并汇总（uploaded / skipped / failed），符号链接 `cp -L` 解引用后以链接名上传；`run_archive_backup`（archive）保留原打包逻辑。飞书云端文件夹逐级复用 / 创建（bash 3.2 无关联数组，用「最近路径 + token」缓存），`--list` 增加端点模式与白名单提示行。新坑沉淀：lark-cli list 的 size 字段上传后可能为空、验证完整性须实际下载对比字节数。
  - **文档**：SKILL.md（description 增「备份格式白名单」触发词与 raw/archive 机制、端点体系节新增「备份模式与格式白名单」、动作②打包规则改写）、references/feishu.md（云端布局改为镜像相对路径、恢复方式、白名单维护、size=0 坑）、references/new-endpoint.md（登记字段补 mode / file_formats）、README.md（端点级备份形态条目）同步更新；镜像同步（diff 一致）。
  - **实测**：`--list` 显示 mode=raw 与白名单提示 ✅；真实备份三份 PDF 原文件直传（`3 uploaded, 1 skipped, 0 failed`——临时 .txt 正确被 SKIP）✅；直传文件此前已实测下载逐字节一致（672,172 bytes）✅。

### 变更（backup 端点子目录：backup/ 下以端点同名子目录区分备份端点）

- **为什么改**：用户 2026-09-02 追加要求——项目根 `backup/` 下还要**通过目录区分不同的备份端点**，即「哪个文件备份到哪个端」也由目录表达，延续「目录即标签」哲学（放进 backup/ = 要备份；放进哪个端点子目录 = 备份到哪端）。不同端点由此可承载不同文件集——例如某文件只想存飞书、不想进其它端。
- **改了什么**：
  - **协议**：`backup/` 一级子目录与已注册端点同名（如 `backup/feishu/`）→ 内容**只备份到该端点**；根下散文件与非端点名的普通子目录（归档目录）→ **备份到全部端点**（共享）。无清单、无额外标记，目录名即端点归属；存量平铺文件自动兼容（视为共享，无需迁移）。
  - **脚本（backup.sh 重构）**：注册表端点加载提前（`--list` 分组也需端点名）；`--list` 按「shared（to ALL endpoints）/ 各端专属（ONLY to endpoint: X）」分组展示；打包从「一次打包传全端」改为「**每目标端独立打包**」——该端包 = 共享内容 + 本端同名子目录（`tar --exclude` 排除其它端点子目录），某端无内容自动跳过；文件列表改经临时文件传递（防文件名含 `$` 时被未引号 heredoc 展开的坑）；修复 bash 3.2 + `set -e` 下循环体 `&&` 短路返回非零触发 errexit 的隐患（统一改 if 形式）；临时目录统一 WORKROOT + trap 清理（中途失败也回收）。
  - **文档**：SKILL.md（description 增「只备份到」触发词与端点子目录机制、目录制节新增端点子目录条目、动作①②同步改写）、README.md（机制概述）、references/new-endpoint.md（注册完成后的汇报加「端点子目录用法」告知）同步更新；镜像 `claude/skills/backup/` 同步（diff 一致，唯一差异仍为本机 endpoints.json）。
  - **实测**：`--list` 分组正确（3 共享 PDF + 1 飞书专属测试文件）✅；双端 `tar --exclude` 模拟验证（feishu 包含 shared + feishu/、排除 webdav/，普通子目录随全端进包）✅；真实备份全链路（4 files = 3 共享 + 1 飞书专属 → 飞书云盘）✅；测试文件与目录已清理，backup/ 恢复原状。

### 变更（feishu-backup 升级为通用多端点备份 skill：backup——飞书云盘降级为首个可插拔端点）

- **为什么改**：用户 2026-09-02 指示——AI 已渗透线上工作的方方面面、Agent 手里的权限太大（能读写文件、操作云端账户、执行删除），单端存储下一次误操作或凭证泄露就可能让重要信息被彻底删除，须以**多端备份**把该风险降到最低；而原 feishu-backup 从 skill 名到脚本到正文都与飞书强耦合，无法承载「继续注册更多备份端点」的诉求，故升级为纯粹通用的 backup skill，飞书云盘成为首个备份端点。
- **改了什么**：
  - **更名重构**：`feishu-backup` → `backup`（英文命名按「简到删无可删」：backup 一词已完整表达核心功能，多端点能力由 description 承载，对齐 commit / release 等单词命名风格）。既有修复全部保留（防回归核查通过）：目录制（backup/ 目录即备份范围，2026-09-01 立）、整目录 gitignore 脚本强制检测（2026-09-01 立）、脚本纯 ASCII 纪律、不加密裁定（2026-08-31 立）。
  - **端点注册制（新机制）**：注册表 `endpoints/endpoints.json` 登记每个已授权端点的 name / display / type / credential（凭证位置+用法）/ reference / authorized_at；首次使用某端点走授权流程（向用户拿凭证 → 最小只读操作验证 → 保存凭证 → 写使用方法并登记），之后直接凭证登录备份、不再打扰用户。凭证纪律：注册表与文档只记「凭证在哪、怎么用」，凭证本体由工具自管（lark-cli auth / rclone config）或存 `endpoints/` 下独立文件——该目录为本机数据，镜像仓库 `.gitignore` 忽略整目录内容、仅 `endpoints/README.md` 入库（对齐 find-skill/.env 先例），初始注册表含 feishu 端点（authorized_at 2026-09-02，凭证 lark-cli 自管）。
  - **两种端点类型**：`builtin-*`（专用工具对接，如 feishu 走 lark-cli，上传逻辑为脚本内分支）与 `rclone`（rclone 支持的任意远端：WebDAV / S3 / Google Drive / Dropbox / OneDrive 等，`rclone config` 配好凭证即注册成功、脚本零改动）；后续注册新端点优先 rclone 类型，判定标准与四步授权流程沉淀在 `references/new-endpoint.md`。
  - **默认全端冗余**：用户说「备份」不指定端点 = 同一备份包上传全部已注册端点（打包一次、逐端上传，单端失败不影响其它端、退出码聚合）；`--endpoint <name>` 只传指定端点。多端冗余正是本次升级的动机。
  - **脚本与文档**：`scripts/backup-project.sh` → `scripts/backup.sh`（重写为多端点入口，macOS bash 3.2 兼容——不用 mapfile 等高版本特性）；按 skill-creator 渐进披露重构——飞书专属细节（认证 / NO_PROXY 代理坑 / 相对路径坑 / 云端目录布局 / 查看恢复删除命令）从 SKILL.md 移入 `references/feishu.md`；新增 `README.md` 记录动机（AI 权限大 → 多端冗余降彻底删除风险）与结构说明。
  - **同步与接入**：镜像 `claude/skills/feishu-backup/` 删除、`claude/skills/backup/` 同步（diff 校验唯一差异为本机 endpoints.json，属敏感例外条款）；ZCode 运行时 `~/.zcode/skills/backup` 软链接接入全局权威源（原 feishu-backup 从未接入 ZCode）。
  - **全链路实测**：`bash -n` 语法 ✅；`--list` 列出三份 PDF ✅；真实备份 ✅——ExecutiveAssistantAgent 三份个人文档 PDF（1.1M）上传飞书云盘 `AI项目私有备份/ExecutiveAssistantAgent/ExecutiveAssistantAgent-backup-2026-09-02.tar.gz`，云端 list 复核包在（与 2026-09-01 包并存，项目子文件夹复用逻辑验证通过）；顺带补上 2026-09-01 遗留欠账「三 PDF 移入 backup/ 后因当日 shell 故障未实际执行备份」。

## 2026-09-01

### 变更（feishu-backup 机制重构：标签清单制 → 目录制——目录即标签）

- **为什么改**：用户连续两步纠正当日早先的标签制方案。第一步指出「标签文件名直接写进 `.gitignore`」不对——**`.gitignore` 是被 git 跟踪的公开文件，写入含个人身份的敏感文件名本身就是信息泄露**（与「敏感信息禁止写入未被 .gitignore 忽略的文件」规矩同源，载体本身会公开）；第二步进一步简化——**建一个专用目录存放待备份文件，目录下所有文件即备份范围，`.backup-tags.json` 标签清单整个不再需要**：「加入备份」= 移进目录、「取消」= 移出，目录即标签，无清单可维护、无中间状态。
- **改了什么**：① `backup-project.sh` 重构——读 `.backup-tags.json` 清单的逻辑全部移除，改为打包项目根 `backup/` 目录下全部内容；`tar -h` 解引用符号链接（固定路径不能移动的文件如 `CLAUDE.local.md` 在 `backup/` 放符号链接指向原文件，打包的是实际内容）；policy 检测简化为整目录一条 `git check-ignore backup`（未忽略终止，提示**只写目录一行、绝不写成员文件名**）；包内带 `backup/` 路径前缀，解压即还原。② SKILL.md 重写为目录制（机制说明、符号链接模式、坑清单第 8 条改为整目录忽略 + 文件名泄露教训）。③ 镜像 `claude/skills/feishu-backup/` 同步。存量迁移：ExecutiveAssistantAgent 落地中（.gitignore 已加 `backup/`，三个 PDF 移入目录待 shell 恢复）；CommunityManagerAgent 需迁移（`.backup-tags.json` 改为 `backup/` 下两个符号链接）。注：脚本重构与目录迁移因当日 shell 故障（/bin/zsh ENOENT）暂未实测，待恢复后验证。（2026-09-01）

### 变更（feishu-backup 硬规矩落地：标签文件必须 gitignore——脚本强制检测）

- **为什么改**：用户 2026-09-01 立「凡要私有备份到飞书的文件都必须加入 `.gitignore`」——备份到飞书的文件即私有文件（隐私 / 本机配置 / 个人交付物），若同时被 git 跟踪会进公开仓库，与「私有」定性矛盾、构成泄露风险。按「规矩必须配套工具强制」元规则，把检测落进备份脚本（仅靠 SKILL.md 文本约束会忘）。
- **改了什么**：① `scripts/backup-project.sh` 打包前新增 policy 检测——项目是 git 仓库时逐文件 `git check-ignore`，任一标签文件未被忽略即 `[ERR] policy violation` 列出文件并终止（exit 1），提示补 `.gitignore` 后重跑；非 git 项目自动跳过；② SKILL.md「打标签」动作新增第 4 步（确认文件本身被 `.gitignore` 忽略，没有就补上），坑清单新增第 8 条（硬规矩 + 脚本强制说明）；③ 镜像 `claude/skills/feishu-backup/` 同步（SKILL.md 与脚本同步编辑）。存量项目核查：ExecutiveAssistantAgent 三个备份标签 PDF 补入 `.gitignore`；CommunityManagerAgent 两个标签文件（CLAUDE.local.md、settings.local.json）经核查已在 `.gitignore` 中，无需改动。注：脚本新增检测因当日 shell 环境故障（/bin/zsh ENOENT）暂未实测，待环境恢复后跑一次未忽略场景验证拒绝路径。（2026-09-01）

### 新增（通用 skill：md2pdf Markdown 转 PDF 一条龙 + 像素级排版验证）

- **新建 `skills/md2pdf/`（SKILL.md + assets/default.css + scripts/md2pdf.sh + scripts/verify_pdf.swift + references/pitfalls.md），全局 `~/.claude/skills/` 落地、同步镜像到本项目 `claude/skills/md2pdf/`（diff 校验一致）；ZCode 运行时 `~/.zcode/skills/md2pdf` 以软链接指向全局权威源（对齐既有机制：`~/.zcode/skills/` 下全部 skill 自 2026-08-22 起即为软链接指向 `~/.claude/skills/`）**。**为什么**：同日在 ExecutiveAssistantAgent 排查三份中文个人文档 PDF「内容只占 A4 左半边」事故（详见该项目本地日志），实战踩出一串 md→pdf 链路的坑，用户要求沉淀为全局 skill 共享。**改了什么**：① 工具链定型 pandoc → Chrome headless 打印 → 像素级验证；② default.css 内置 pandoc 默认样式显式覆盖（`body { margin:0; max-width:none; padding:0 }`）与 A4 中文紧凑排版；③ `md2pdf.sh` 一条龙转换（内置 `<style>` 包装注入——实测 `--include-in-header` 裸插 CSS 文件不包标签、整份 CSS 静默失效；`file://` 绝对路径防错误页 PDF；bash 变量名后紧跟全角括号会被并入变量名的坑已修）；④ `verify_pdf.swift` 零依赖定量验证（MediaBox 纸张判定 + 每页墨迹左右边界百分比 + 窄栏 / 不对称 / 空页报警，判据经三组样本实测：居中窄栏 14%/84% 正确报警、A4 满宽 6.7%/93.3% 不误报）；⑤ pitfalls.md 沉淀四大坑详解（pandoc 默认窄栏、Chrome 错误页、视觉模型验证不可靠、校验截图须互异）与 CSS 定制指南。端到端实测通过：测试 MD → A4 PDF（左 6%/右 93% 满宽对称）✅，空 CSS 对照组正确抓出 Letter + 居中窄栏 ⚠️。

### 新增（通用 skill：feishu-backup 飞书云盘文件级备份）

- **标签清单从全局集中制改为项目内分散制（用户 2026-09-01 裁定，同日落地）**：清单文件从 `~/.claude/backup-tags.json`（全局一份、按项目分组）改为**各项目根 `.backup-tags.json`**（格式 `{"files":[...]}`，仅含本项目）——打开项目即见备份状态，且随项目走。配套改动：① `scripts/backup-project.sh` 改读 `<项目根>/.backup-tags.json`（云盘根文件夹 token 移入脚本常量），并因脚本曾混入不可见 Unicode 字符导致 bash 报错而全量重写为**纯 ASCII**（注释与输出一律英文，此教训已写入 SKILL.md 坑清单）；② SKILL.md「打标签」动作增加「确认项目 `.gitignore` 忽略 `.backup-tags.json`」步骤（清单本身也是私有文件）；③ CommunityManagerAgent 落地新制：项目根建 `.backup-tags.json`（含 CLAUDE.local.md 与 settings.local.json 两标签）、`.gitignore` 补忽略（git check-ignore 验证生效）、全局旧清单 `~/.claude/backup-tags.json` 删除；④ 新制 `--list` 与真实备份均实测通过（2 标签文件 → 云盘 3.8KB 包），镜像 `claude/skills/feishu-backup/` 同步（diff 一致）。

- **新建 `skills/feishu-backup/`（SKILL.md + scripts/backup-project.sh），全局 `~/.claude/skills/` 落地、同步镜像到本项目 `claude/skills/`（diff 校验一致）**。**为什么**：用户裁定所有重要文件必须有远端备份，而私有文件（`CLAUDE.local.md`、`settings.local.json`、`docs/` 运行数据等）不进 git、无法用 GitHub 备份——飞书云盘 + 官方 CLI（lark-cli v1.0.92，`~/.local/bin/`）填补这个缺口；经用户讨论裁定**不加密**（风险模型：本地丢失为真风险、云端泄露为低概率低损失，加密反而引入密钥丢失风险）。**改了什么**：① 文件级标签制——清单 `~/.claude/backup-tags.json`（跨项目、本机文件）按项目记录需备份文件的相对路径，用户口头指定打标签、备份时只打包清单内文件；② 备份脚本打包（tar 相对路径）→ 上传飞书云盘「AI项目私有备份/<项目名>/」（时间戳命名），`--list` 参数查清单不上传；③ SKILL.md 沉淀本机特有的坑：lark-cli 认证（`auth login --recommend`）、飞书域名必须 NO_PROXY 直连（本机全局代理 127.0.0.1:1087 走飞书会 TLS 握手超时）、`+upload` 只接受相对路径、`+download` 用 `--file-token`、device code 几分钟过期等。全链路已实测验证：打标签 → 打包 → 上传 → 下载 → 逐字节校验一致。初始标签：CommunityManagerAgent 的 `CLAUDE.local.md` 与 `.claude/settings.local.json`（2026-09-01 已完成首次备份）。

## 2026-08-30

### 新增（全局新增元规则「规矩必须配套工具强制」+ PreToolUse 守卫钩子——镜像同步）

- **为什么改**：2026-08-30「连接远程禁止复用窗口」规矩立后几分钟，Agent 又用 `open vscode://` URI 复用了用户窗口——证明纯文本规则（rules / skills / CLAUDE.md）在长会话中必然被遗忘。用户裁定立元规则：任何规矩指定后都要尽可能用工具（hook / settings deny / 代码）强制辅助防止忘记，仅文本记录不够。
- **改了什么**：① 新建 `~/.claude/hooks/pre-tool-use-guard.sh`（PreToolUse 钩子）——硬拦截两类违规：未带 `# AI_AUTHORIZED_KILL_VSC` 授权标记的杀 VSCode 进程命令、`open vscode://vscode-remote` 复用窗口式远程连接触发（deny + 给出正确替代命令）；② 全局 `~/.claude/settings.json` 注册该钩子（matcher: Bash）；③ 全局 CLAUDE.md 新增「规矩必须配套工具强制（2026-08-30 用户立，元规则）」节，并在「杀 VSC 进程」「连接远程禁止复用窗口」两条规矩下补「工具强制」说明；④ 本项目 `claude/CLAUDE.md` 镜像同步（diff 验证逐字节一致）。
- **同步**：全局为权威源，先落全局再镜像到本项目 `claude/`。

### 新增（全局 CLAUDE.md 新增「连接远程 VSCode Server 禁止复用当前窗口」规则——镜像同步）

- **为什么改**：2026-08-30 Alfred 会话中用 `vscode://vscode-remote/...` URI 触发 Remote-SSH 连接 win-ai，VSCode 复用了用户正在其中工作的项目窗口，远程会话顶替了用户的本地工作现场，被用户指出。远程开发会话须与用户本地工作窗口严格隔离。
- **改了什么**：① 全局 `~/.claude/CLAUDE.md` 新增「连接远程 VSCode Server 禁止复用当前窗口（2026-08-30 用户立）」节——AI 触发远程连接必须强制新窗口（命令行 `--new-window`；禁用会复用现有窗口的 `vscode://` URI 方式）；② 本项目 `claude/CLAUDE.md` 镜像同步（diff 验证逐字节一致）。
- **同步**：全局为权威源，先落全局再镜像到本项目 `claude/`。

### 新增（全局 CLAUDE.md 新增「杀 VSC 进程前必须先问」规则——镜像同步）

- **为什么改**：2026-08-30 Alfred 会话中，Agent 在修复本地 VSCode 卡顿时准备直接杀 VSCode 进程、未先征询，被用户纠正——VSCode 可能挂着未保存的窗口状态、正在跑的任务、调试会话，擅自杀进程会造成用户工作现场丢失，用户要求把杀进程的决定权留在自己手里。
- **改了什么**：① 全局 `~/.claude/CLAUDE.md` 新增「杀 VSC 进程前必须先问（2026-08-30 用户立）」节——凡杀 VSCode 进程（`pkill` / `kill` / `killall` / `osascript quit` 强制结束等一切手段）必须先 AskUserQuestion 列明进程范围与原因、授权后才执行；查询类操作（`ps`）不受限；② 本项目 `claude/CLAUDE.md` 镜像同步（diff 验证逐字节一致）。
- **同步**：全局为权威源，先落全局再镜像到本项目 `claude/`。

### 新增（全局新增规则文件 runtime-dev-isolation.md——运行版本与开发版本隔离——镜像同步）

- **为什么改**：2026-08-30 在 CC-Bridge 发现全局命令被 `npm link` 指向开发目录、glm daemon 随之运行开发源码——运行版本不可控，开发中的改动实时污染实际环境（该项目自己的 `.claude/rules/cc-bridge-install.md` 本就明令禁止，属违规操作）。用户裁定把这条禁令上升为**全局规则、适用于所有项目**：任何项目的开发代码必须走完发布流程（GitHub Release）之后才可在实际环境使用，实际用的版本必须从 Release 安装 / 更新，运行版与开发版严格隔离。
- **改了什么**：① 新建全局 `~/.claude/rules/runtime-dev-isolation.md`——核心原则（禁 npm link 及一切等价手段、禁常驻服务直跑开发源码、须从 Release 安装）、怎么用（开发期验证方式、发布后安装、自检命令、代价须知）、边界（任何项目适用、项目细则为具体指引本规则为总纲、开发目录内自测不受限）；② 全局 `~/.claude/CLAUDE.md`「工作规则（全局 rules 显式引用）」节——「四个规则文件」改「五个」、追加 `@rules/runtime-dev-isolation.md` 引用；③ 本项目 `claude/` 镜像同步（rules 文件 + CLAUDE.md，diff 验证逐字节一致、rules 目录整体一致）。
- **同步**：全局为权威源，先落全局再镜像到本项目 `claude/`。

## 2026-08-29

### 变更（全局 CLAUDE.md 超集关系映射表追加 QuantStrategistAgent → gridtrader——镜像同步）

- **为什么改**：用户指定 gridtrader（网格交易策略开发及回测工具，Python / backtrader）由 QuantStrategistAgent（Markowitz）负责维护，成为其子项目，须登记进全局「超集关系映射（完整清单，权威）」表。
- **改了什么**：全局 `~/.claude/CLAUDE.md` 映射表追加「QuantStrategistAgent（Markowitz） | gridtrader | 网格交易策略开发及回测工具（Python / backtrader）」一行；`claude/CLAUDE.md` 镜像同步（diff 验证逐字节一致）。

## 2026-08-28

### 变更（全局 CLAUDE.md 注册表 Gatsby 行职责描述更新——社群定名并清退「互帮互助」表述——镜像同步）

- **为什么改**：CommunityManagerAgent（Gatsby）侧两轮定位校准（2026-08-27 / 08-28）——群主定名社群为「AI前沿跨界交流群」，并裁定「互帮互助」不在任何地方体现（多数群友为获取信息而来、无明确求助需求且不想被求助打扰，互助是群活跃后的自然副产品）。全局注册表 Gatsby 行的社群描述仍写「以 AI 为纽带的跨界互帮互助交流群」，与最新定位不符，每次会话加载都会把 Gatsby 的运营拉回互助框架，须同步更新。
- **改了什么**：全局 `~/.claude/CLAUDE.md` 注册表 Gatsby 行社群描述改为「运营用户的微信社群『AI前沿跨界交流群』」；`claude/CLAUDE.md` 镜像同步（diff 验证逐字节一致）。

## 2026-08-26

### 变更（全局 CLAUDE.md 登记新子项目 zcode-vsce——镜像同步）

- **为什么改**：用户新立项 zcode-vsce（非官方 ZCode VSCode 扩展客户端，与 zcode-cli 平行的姊妹项目、同归 Atlas / FullStackEngineerAgent 负责）。按「超集关系映射（完整清单，权威）须与各 Agent 项目子项目清单一致」规则，全局 CLAUDE.md 的映射表与 Atlas 注册表行需同步登记新子项目。
- **改了什么**：全局 `~/.claude/CLAUDE.md` 两处——① 「智能体命名注册表」Atlas 行的「主要职责」补 zcode-vsce（非官方 ZCode VSCode 扩展客户端）；② 「超集关系映射」表新增一行 `FullStackEngineerAgent（Atlas） | zcode-vsce | 非官方 ZCode VSCode 扩展客户端（与 zcode-cli 平行的姊妹项目：同一官方 runtime、app-server 协议、webview 前端）`。`claude/CLAUDE.md` 镜像 cp 同步（diff 验证逐字节一致）。同日 FullStackEngineerAgent 项目侧同步：其 `.claude/CLAUDE.md` 子项目清单与双版 README 补 zcode-vsce（源变更已记该项目 CHANGELOG）。

### 变更（全局 CLAUDE.md「敏感信息禁止写入」节增补财务状况类型——镜像同步）

- **为什么改**：2026-08-26 发现 ExecutiveAssistantAgent 的 CHANGELOG 条目写入了用户个人财务状况描述（收入目标、本金状况、财务紧迫程度、职业投入状态），随公开仓库进入 git 历史，被迫重写该仓库全部历史 + force push 才能清除。原「敏感信息禁止写入」节枚举的敏感类型（账户号、API key、token、密码、私钥、连接串等）全部是凭证类信息，没覆盖「财务状况描述」这一类型——它不是凭证、没有占位符可填，须明确「整体不写」的处理方式，堵住规则缺口（2026-08-26 用户立）。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「敏感信息禁止写入未被 .gitignore 忽略的文件」节三处——① 标题日期标注增补「2026-08-26 增补财务状况」；② 敏感信息枚举加入「个人 / 公司 / 组织的财务状况（收入目标与实际收入、本金、资产、负债、存款、财务紧迫程度、职业投入状态等描述性信息）」；③ 「为什么」补记 2026-08-26 事故，「怎么用」新增一条：财务状况类没有占位符可用，文档写动机时只陈述业务目标与方法论、不写财务背景，确需记录的写入 `.gitignore` 忽略的本机文档；「拿不准按敏感处理」条同步补充财务类口径。`claude/CLAUDE.md` 镜像 cp 同步（diff 验证逐字节一致）；`~/.zcode/AGENTS.md` 为软链接（2026-08-24 起）自动跟随，无需单独同步。

## 2026-08-24

### 变更（全局 CLAUDE.md「工作规则」节新增 rules 加载机制说明：`@` 引用仅 CC 解析，非 CC agent 须主动读文件——镜像与 ZCode 副本同步）

- **为什么改**：2026-08-24 调研确认 ZCode 无 `rules/` 目录机制且不解析 `@` 引用（官方文档明文：不展开 `@import` / `@include`）——全局 CLAUDE.md「工作规则」节的四行 `@rules/` 引用在 ZCode 里只是普通文本，四个规则文件全文不会进入 ZCode 上下文。为让规则在非 CC agent 也生效，经用户裁定采用方案 A：保留 `@` 引用（CC 自动加载不动），在节内加加载机制说明，要求非 CC agent 会话开始时主动读取四个规则文件全文。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「工作规则（全局 rules 显式引用）」节在四行 `@` 引用之前新增一段加载机制说明：`@` 引用只有 CC 自动解析展开；其它 agent（如 ZCode）不解析，须在会话开始时用读文件工具逐一读取 `~/.claude/rules/` 四文件全文。`claude/CLAUDE.md` 镜像同步；ZCode 全局指令副本 `~/.zcode/AGENTS.md` 一并 cp 对齐（diff 验证三处逐字节一致）。

### 变更（ZCode 全局指令副本 `~/.zcode/AGENTS.md` 由 cp 同步改为软链接指向 `~/.claude/CLAUDE.md`）

- **为什么改**：2026-08-24 方案 A 落地后 ZCode 副本仍靠手动 cp 对齐，每次全局 CLAUDE.md 变更都要记得同步、有漏同步风险；用户裁定改为软链接，全局改动即时反映到 ZCode、零维护。
- **改了什么**：删除 `~/.zcode/AGENTS.md` 普通文件（删前确认与全局逐字节一致、内容无丢失），`ln -s ~/.claude/CLAUDE.md ~/.zcode/AGENTS.md` 建立软链接，diff 验证读取内容一致。此后 ZCode 的全局指令 = 全局 CLAUDE.md 本体，不再单独同步该文件（Prometheus `claude/CLAUDE.md` 镜像的 cp 同步不变）。

## 2026-08-23

### 变更（CLAUDE.md 镜像随全局对齐：Kit 行更名 ExecutiveAssistantAgent + 补齐五小组 / Atlas / Hopkins / Justin / 查证规则滞后）

- **为什么改**：两个来源——① Kit 主项目由 PersonalAssistantAgent 更名为 ExecutiveAssistantAgent（Title「总经理助理」定名后的名字对齐，GitHub 仓库同步改名），全局 `~/.claude/CLAUDE.md` 注册表 Kit 行与「超集关系映射」表仓库名已更名，镜像须随权威源对齐；② 发现镜像落后于全局：同日早前全局的「五小组重组（Hopkins / Justin / Atlas 注册表行、流水线段、FullStackEngineerAgent 脚手架引用、zcode-cli 映射行）」与 2026-08-22 立的「查证外部行为先找官方文档」规则未同步进镜像，按「全局 ↔ 镜像时刻一致、发现分叉自动对齐」规则一并补齐。
- **改了什么**：`claude/CLAUDE.md` 以全局 `~/.claude/CLAUDE.md` 覆盖对齐（diff 校验逐字节一致）；顺带将 ZCode 全局指令副本 `~/.zcode/AGENTS.md`（同为全局 CLAUDE.md 的派生副本、同样滞后）一并 cp 对齐。


### 变更（commit skill 敏感内容扫描检测面扩充：新增「敏感行为记录」四类——IP 字面量 / 代理商标识 / 监管报文 / 地域规避叙述）

- **为什么改**：2026-08-21 DayTradingAgent 排查发现「代理交易的行为记录」类泄漏（节点 IP、订阅商名、监管拒单报文、境内规避实测故事线）全部走过了 /commit 扫描——旧扫描只拦凭证「值」类（账户号 / token / 净值），不拦「行为记录」类；DayTradingAgent 同日已做工作区中性化清理 + 规划 git 历史重写，扫描面扩充是防复发的配套（DayTradingAgent TODO T3）。
- **改了什么**：全局 `~/.claude/skills/commit/SKILL.md` 第 2 步敏感内容扫描新增「敏感行为记录」类别——① 公网 IPv4 字面量（回环 / 内网 / 文档示例网段 192.0.2.x / 198.51.100.x / 203.0.113.x 放行）；② 代理服务商标识（订阅商名 / 节点入口域名体系 / 节点代号）；③ 券商监管报文（错误码 + 报文原文引用）；④ 地域规避叙述（「境内拒境外受理」类把身份与绕行手段串成故事线的叙述；合规要求的中性表述不拦）。扫描方式同步升级为「全部暂存文件跑内容正则」（旧版只按文件名 + 抽样）。`claude/skills/commit/SKILL.md` 镜像同步（diff 验证逐字节一致）。
- **回归风险**：无既有保护被削弱——四类全是新增检测维度；误报风险（技术文档引用公网 IP）用「逐个判断 + 文档示例网段放行」缓解。

## 2026-08-22

### 变更（全局 CLAUDE.md 新增「查证外部行为先找官方文档」规则：立规并镜像到 `claude/`）

- **为什么改**：2026-08-22 在 CC-BRIDGE 判断「GLM 端点如何解读 CC 的 effort 档」时，先做本地 A/B 实验就下了结论，用户指出应先查官方文档——官方明文映射表本就存在，且顺带给出「默认档即 max」等实验没覆盖的关键信息。用户立规：「官方文档优先于本地实验」要记录到全局规则。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「表述的逻辑严谨性」节新增第四条「查证外部行为先找官方文档，本地实验只做补充验证（2026-08-22 用户立）」——外部系统行为规则（API 参数语义、档位映射、配置默认值等）第一步查官方文档（权威承诺），本地实验只是单点观察（n=1、有噪声、随版本变）；文档查不到才实验且结论须标注「本地实测」，文档与实验冲突以文档为准；边界：用户自己的代码 / 项目行为靠读源码与实测、不受本条约束。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致；rules / skills 两部分核对无分叉）。

### 变更（注册表新增 Atlas / FullStackEngineerAgent：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：2026-08-22 新建 FullStackEngineerAgent（Atlas，全栈开发工程师）——团队第 17 个 agent，负责横跨前后端的完整开发，zcode-cli 为其子项目。按「新建带拟人名的 Agent 时自动维护注册表（免确认）」规则，须把 Atlas 追加进全局注册表并补流水线位置说明。
- **改了什么**：全局 `~/.claude/CLAUDE.md`——注册表表格追加 Atlas 行（全栈开发工程师 / FullStackEngineerAgent / 横跨前后端的完整开发，目前在手 zcode-cli）；「销售流水线顺序」段独立清单补 Atlas、并补一句 Atlas（全栈）与 Anvil（后端）的分工（横跨前后端及偏前端 / TUI / 客户端侧归 Atlas，纯服务端归 Anvil）；「超集关系映射」表加「FullStackEngineerAgent（Atlas）→ zcode-cli」行；脚手架节参考项目示例从 DigiVendAgent 改为 FullStackEngineerAgent（对齐最新模板形态）。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。

## 2026-08-21

### 变更（缩写约定新增 DSH：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：2026-08-21 用户要求安装 DeepSeek Harness 时以缩写「DSH」指代（「帮我安装DSH」+ 补充「deepseek harness」），并指示把该缩写记入全局规则——一般情况下提到 DSH / dsh 就是指 DeepSeek Harness，避免以后每次都要用户解释。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「Language」节「缩写约定」条——新增「输入『DSH』即指 DeepSeek Harness（DeepSeek 开源的 agent harness，npm 包 `@deepseek-ai/dsh`，2026-08-21 立）」；大小写不敏感清单补 DSH / dsh 与示例「『dsh 安装』= 安装 DeepSeek Harness」；上下文辨别示例补「`dsh` 在分布式 shell 语境指 Dancer's shell / distributed shell，不按缩写解读」。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。
- **边界**：只加缩写解读规则；`dsh` 在明确谈论分布式 shell（Dancer's shell）的上下文中仍按上下文实际含义辨别，不强制解读为 DeepSeek Harness。

### 变更（TODO 待办编号规则新增：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户指令（2026-08-21）——待办 TODO 里的每条待办都要有待办编号，方便用户与 AI 针对性沟通（直接「T-12 处理了吗」指代，不必复述长正文）。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「待办（TODO）管理」节——标题时间线补「2026-08-21 增补待办编号」；「怎么用」新增「每条待办必须有唯一待办编号（2026-08-21 用户立）」条：格式 **T+序号**（前缀 `T` 直接连序号、不带连字符，如 `T11`）、置于 `[ ]` 之后正文之前；编号项目内全局递增、永不复用（新编号 = TODO.md 与 TODO-archive.md 两文件中出现过的最大编号 + 1，归档编号也算占用）；归档保留编号；MEMO.md 备忘条目同样编号、前缀 `M` 连写（如 `M11`）与 `T` 区分（MEMO.md 与 MEMO-archive.md 都要扫）；存量无编号条目接触一条补一条（补编号不改正文、时间戳不必更新）；编号只用于指代、不表达优先级或顺序。「备忘录 MEMO.md」小节「条目格式」同步补 `M` 前缀连写编号要求。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。
- **边界**：只改全局规则与镜像；各业务项目现有 `TODO.md` / `MEMO.md` 存量条目不一次性返工，按「接触一条补一条」口径由各项目后续顺手补编号。

### 变更（措辞统一 fleet → team / 舰队 → 团队：全局 CLAUDE.md + commit skill 修订，镜像到 `claude/`；本项目级文件与 README 同步改）

- **为什么改**：用户 2026-08-16 已把 xhqing 主页 README 的自称从「舰队 / fleet」改为「团队 / team」，但全局元规范、commit skill、各 agent 项目文档与两个 logo 仍是旧措辞——外部读者沿「主页 → agent 仓库 → 本项目 `claude/` 镜像」的浏览路径会看到两种自称并存，观感割裂；用户裁定全量统一为「团队 / team」（2026-08-21）。
- **改了什么**：
  - 全局 `~/.claude/CLAUDE.md`：7 处 fleet、1 处「全舰队」→ 团队 / 全团队（注册表 Prometheus 行、自动维护注册表节、脚手架节、Visitors 徽章节 ×2、超集关系节、销售流水线段）；GitHub secret 名 `FLEET_TRAFFIC_PAT` 是后台标识符、暂保留。
  - 全局 `~/.claude/skills/commit/SKILL.md`：14 处 fleet → 团队（Visitors 徽章例外段、9a/9l、缓存标记模板、汇报段）。
  - `claude/CLAUDE.md` + `claude/skills/commit/SKILL.md` 镜像同步（`diff` 验证逐字节一致；顺手清掉镜像里误嵌套的 `commit/commit/` 目录）。
  - 本项目级文件：`README.md` / `README_cn.md`（fleet → team、舰队 → 团队，含「fleet registry」→「team registry」）、`assets/logo.svg`（「Fleet-wide ~/.claude/ backbone」→「Team-wide」）、`.claude/skills/capability-manager/`（SKILL.md description 与正文、content-lifecycle / registry-and-scaffolding / sync-flow 三个 references，场景 C 标题「fleet 扩展」→「团队扩展」）。
- **边界**：各 CHANGELOG 的历史条目按纪律不改（记录的是当时事实）；`.claude/skills/find-skill/cache/` 已 gitignore 不公开，不动；`vendy-fleet-architecture.md` 是 AutoMemory 历史文件名引用（文件已不存在、checkpoint 未被 git 跟踪），不动。

### 变更（「CHANGELOG 记录不用问」规则新增：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：2026-08-21 用户在 DayTradingAgent 场景明确立规「记录 CHANGELOG 不用问」——凡有变更（增 / 删 / 改）都要记录 CHANGELOG 是**本分动作**，直接记录、不需要先问用户「要不要记 CHANGELOG」，问「要不要记录」是多余的反 confirm（当天 AI 改完 skill 规则后问「要我现在把这次变更记入 CHANGELOG 吗」，被用户纠正）。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「CHANGELOG 记录纪律」节「怎么记」段新增一条「**记录不用问（2026-08-21 用户立）**」。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。

## 2026-08-20

### 变更（「超集关系映射」表新增 DeviceStewardAgent（Alfred）→ ResourceMonitor：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：新建 DeviceStewardAgent（Alfred，电脑管家 Agent，2026-08-20 立项推上 GitHub），其子项目 ResourceMonitor（VSCode 扩展：整机资源监控 + AI 清理建议）随之入体系——按「Agent 项目与子项目的 `.claude/` 超集关系」规则（2026-08-10 立），映射表须登记新对（注册表内 Alfred 行此前已存在，仅缺映射行）。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「超集关系映射」表追加一行「DeviceStewardAgent（Alfred）| ResourceMonitor | 整机资源监控 + AI 清理建议的 VSCode 扩展（TypeScript）」。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。

## 2026-08-19

### 变更（TODO 体系增补备忘录 MEMO.md 与「放弃」归档口径：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户指令（2026-08-19，源于 DayTradingAgent 场景）——①TODO.md 功能定位收紧：待办清单只放「要尽可能尽快处理、要及时清空」的内容，**不设「长期备忘」分类**，比绿色紧急度还低的超低频需求（周期性 / 条件触发、无排期压力）专门放备忘录文档；②用户说「放弃、不处理」的待办 = 移除待办 + 归档留痕（不裸删）。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「待办（TODO）管理」节——标题补「+ 备忘录 MEMO.md」；正文新增「TODO.md 的功能定位」段（及时清空、不设长期备忘、备忘类进 `MEMO.md`）；文件结构补 `MEMO.md` 与 `✅**已放弃**` 状态；「怎么用」新增「放弃 = 移除 + 归档留痕」条；新增「备忘录 MEMO.md」小节（功能定位 / 条目格式【时间戳 + 下次触发锚点】/ 完成与归档【**2026-08-19 补：归档进专属 `MEMO-archive.md`、与 TODO-archive 平行互不混放】/ 触发时机【不设自动提醒、相关场景 AI 主动翻】/ 新建项目不强制预建）。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。

### 变更（缩写约定追加 GH / gh = GitHub + 全部缩写大小写不敏感：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户指令（2026-08-19，两条）——①新增缩写「GH / gh」一般情况下默认代表 GitHub，特殊情况根据上下文辨别；②此前约定的 CC / VSC / VSCE / CB 同样适用小写形式（cc / vsc / vsce / cb），特殊情况同样按上下文识别真正语义。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「Language」节「缩写约定」条目改写——缩写清单追加「GH」即指 GitHub；新增一句「缩写**大小写不敏感**」，大写「CC / VSC / VSCE / CB / GH」与对应小写「cc / vsc / vsce / cb / gh」同义（举例：「cc 会话」= Claude Code 会话、「gh 仓库」= GitHub 仓库）；「解读以不影响上下文理解为前提」的兜底从原来只针对 CB 推广到**全部缩写**，并给典型示例（小写 `gh` 出现在命令位置指 GitHub CLI 命令、`cc` 在编译器语境指 C 编译器，均不按缩写解读）。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。
- **边界**：只改全局 CLAUDE.md 的缩写约定条目与镜像；各业务项目自己的文档不受影响（本条是「读用户输入时怎么解读缩写」的会话级规则，不要求项目文档改写）。

### 新增（fleet 注册表登记新 agent：Alfred / DeviceStewardAgent 电脑管家）

- **为什么改**：用户指令——注册一个新智能体「电脑管家」，负责本地电脑 / 远程服务器 / 云电脑的资源管理与建议，让设备始终处于低负载的流畅工作状态；按「新建带拟人名的 Agent 时自动维护注册表（免确认）」规矩，向全局 CLAUDE.md 的智能体命名注册表追加新成员。
- **改了什么**：全局 `~/.claude/CLAUDE.md` 注册表追加一行——拟人名 **Alfred**（查重通过，与现有 14 个拟人名不重复）、项目 `DeviceStewardAgent`、职称「电脑管家」、职责「资源管理：本地电脑 / 远程服务器 / 云电脑的资源监控与管理建议（进程 / 内存 / 存储治理）→ 让设备始终处于低负载的流畅工作状态，独立于销售流水线」；「销售流水线顺序」段同步补 Alfred 位置（独立于流水线）与一句职责说明。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。
- **边界**：本轮只做注册表登记（全局 CLAUDE.md + 镜像同步）；DeviceStewardAgent 项目本体的脚手架（目录、CLAUDE.md、README、git init、开源到 GitHub 等）尚未创建，待用户指示后按「新建 Agent 项目的脚手架与开源约定」执行。

## 2026-08-17

### 变更（TODO 紧急度命名弃「灯」用「色」：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户 2026-08-17 指示——TODO 紧急度命名不用「灯」这个字，改用「色」，如「红色紧急度」；四级分级标准与排序不变，只改命名词形。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「待办（TODO）管理」节——四级名称「🔴 红灯 / 🟠 橙灯 / 🟡 黄灯 / 🟢 绿灯」改为「🔴 红色紧急度 / 🟠 橙色紧急度 / 🟡 黄色紧急度 / 🟢 绿色紧急度」；「文件结构」里 TODO.md 分节描述、「怎么标」的标题枚举同步换词；「TODO-archive.md」描述里「优先级标注」改「紧急度标注」；「怎么标」追加存量清理口径「既有分节标题还写红灯等的，接触一处改一处」。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致；改名说明里的历史词「弃『灯』用『色』」属必要保留）。
- **边界**：命名词形改动只落全局 CLAUDE.md 与镜像；各业务项目自己的 `TODO.md` / `TODO-archive.md` 分节标题由各项目随后自行更新（归档文件历史节名保留原词属历史事实）。各项目 TODO 的更新记录在各项目自己的 CHANGELOG，不记本文件。

### 变更（Visitors 徽章更名 Visits/day (14d)：alt 文本与 xhqing 集中统计新 label 对齐）

- **为什么改**：用户要求（2026-08-17）访问量徽章名需表达「最近半月日均访问量」口径——xhqing 集中统计侧的 badge JSON label 已从 `Visitors` 改为 `Visits/day (14d)`（`Visits/day` 是 shields.io 表达日均的惯例写法、`(14d)` 标注 14 天滚动窗口），各仓 README 的徽章 alt 文本同步对齐，避免 alt 与徽章实际显示文字脱节。
- **改了什么**：README 徽章区 `alt="Visitors"` → `alt="Visits/day (14d)"`，仅改 alt 文本，endpoint URL、数据源、徽章口径均不变（口径改动记 xhqing 仓库 CHANGELOG，本仓只改 alt）。

### 变更（TODO 标注方式修订：颜色只标分节标题、条目不标颜色 emoji——全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户 2026-08-17 指示——分级颜色只保留在四个分节标题上（🔴 红灯 / 🟠 橙灯 / 🟡 黄灯 / 🟢 绿灯），条目本身不再标注颜色 emoji，避免标题与条目两处颜色不一致或混乱；条目紧急度由所在分节表达，逐条标色属冗余。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「优先级分类」的「怎么标」条目改写——颜色只出现在 `##` 分节标题、条目不标颜色 emoji；判断拿不准往高靠保留；存量带色条目「接触一条删一条」顺手清理。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。
- **边界**：只改标注方式规矩，四级分级标准与排序本身不变；各项目 TODO 条目的 emoji 清理由各项目自己执行并记各自 CHANGELOG。

### 变更（TODO 优先级改四级紧急度「红灯 / 橙灯 / 黄灯 / 绿灯」：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户 2026-08-17 再次指示——三级紧急度扩为四级（红、橙、黄、绿，从最紧急到最不紧急），原「高危 / 中危 / 轻危」分别对应前三级（红 / 橙 / 黄），**计划类新功能实现独立放第四级绿灯**（上一轮曾把计划类并进绿灯=原轻危的定义域，本轮拆开：轻危类卫生 / 文档问题归黄灯、计划类新功能独占绿灯，两类性质不同不再混装）。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「待办（TODO）管理」节——「文件结构」分节描述改四级排序；「优先级分类」小节改四级：🔴 红灯（原高危标准）/ 🟠 橙灯（原中危标准）/ 🟡 黄灯（原轻危标准：文档措辞 / 格式漂移 / 卫生问题 / 不影响正确性的优化）/ 🟢 绿灯（计划类新功能实现：新能力立项、改造方案落地，改期无实际损失），条目署期改「2026-08-17 用户改为四级紧急度」；「怎么标」的 emoji 枚举更新为 🔴/🟠/🟡/🟢。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。同日早前的「三级改名」条目（见下）为本次四级的中间态，一并保留可追溯。
- **边界**：分级规则改动只落全局 CLAUDE.md 与镜像；各业务项目自己的 `TODO.md` 分节标题由各项目随后自行更新（归档文件历史节名保留原词）。各项目 TODO 的更新记录在各项目自己的 CHANGELOG，不记本文件。

### 变更（TODO 优先级三级命名改「红灯 / 黄灯 / 绿灯」三级紧急度：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户 2026-08-17 指示——待办分级此前的「高危 / 中危 / 轻危」命名改为三级紧急度「红灯 / 黄灯 / 绿灯」（从最紧急到最不紧急），语义不变、命名更直观；同时绿灯的定义域放宽，把「计划类新功能实现（改期无实际损失）」也纳入绿灯（原三级里这类待办没有明确归属——它不是缺陷修复、不落在任何一级的标准里）。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「待办（TODO）管理」节——「文件结构」里 TODO.md 的分节描述改为「红灯最紧急在前、黄灯居中、绿灯最不紧急在后」；「优先级分类」小节三条改名（🔴 高危→🔴 红灯【最紧急】/ 🟡 中危→🟡 黄灯【次紧急】/ 🟢 轻危→🟢 绿灯【最不紧急，定义域追加计划类新功能实现】），条目署期改为「2026-08-16 用户立；2026-08-17 用户改三级紧急度命名」；emoji 标记（`[ ] 🔴/🟡/🟢`）与判断标准本身不变。`claude/CLAUDE.md` 镜像同步（`diff` 验证逐字节一致）。
- **边界**：改名只动全局 CLAUDE.md 与镜像；各业务项目自己的 `TODO.md` / `TODO-archive.md` 分节标题由各项目随后自行更新（归档文件里的历史节名保留原词、属历史事实不改）。各项目 TODO 的更新记录在各项目自己的 CHANGELOG，不记本文件。

### 新增（keep-awake skill——Mac 合盖防睡眠全局通用化）

- **为什么改**：用户指令——Mac 合盖防睡眠此前只在 DayTradingAgent 有实现（盯盘场景专用、已并入 trade 盯盘流程），现提炼为全局 skill 供任意场景使用。同时按用户要求，启用后必须提示「已启用」并**重点提醒接入电源**——`caffeinate -s` 的合盖防睡眠（`PreventSystemSleep` assertion）只在接电源（AC）时有效（`man caffeinate` 明确），电池下合盖是硬件强制睡眠、软件防不住；DayTradingAgent 版因盯盘开盖场景曾去掉电池警告，全局通用版恢复并强化该提醒。
- **改了什么**：新增 `skills/keep-awake/`（全局权威源 `~/.claude/skills/keep-awake/` 落地后镜像同步）——
  - **SKILL.md**：description 覆盖「合盖防睡眠」「防止 Mac 睡眠」「keep awake」等触发场景，启用后回复必须含「已启用提示 + 电源重点提醒」；正文含机制与前提（AC-only 硬约束）、启用 / 停用 / 状态查询、根因背景（源自 2026-07-24 DayTradingAgent 盯盘复盘，与 trade 盯盘链路不冲突的说明）。
  - **scripts/on.sh**：幂等启用（`pgrep` 查重→`pmset -g batt` 检测电源→`nohup caffeinate -s` 后台启动 + `disown`→复检确认），按电源状态输出差异化提醒——AC 打 ✅、电池打 ⚠️⚠️「请立即接入电源」、检测失败打 ⚠️ 请确认接电源；脚本层面保证电源提醒不依赖 AI 转述。
  - **scripts/off.sh**：`pkill -f "caffeinate -s"` 停用，无进程时幂等返回不报错。
  - **实跑验证通过**：启用（AC 检测正确、`pmset -g assertions` 确认 `PreventSystemSleep` 生效）→ 停用 → 幂等再停用 → 重新启用全链路正常。
- **与 DayTradingAgent 的关系**：实现逻辑源自其 keep-awake skill；该项目的防睡眠已并入 trade 盯盘流程（preflight 无条件启用、停盯自动解除），继续独立运行，不受本次全局化影响。
- **同步镜像**：`claude/skills/keep-awake/` 随全局逐字节一致（`diff -r` 验证通过）。

### 变更（新增「中英双语 README 内容自动同步」规定：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：2026-08-17 在 xhqing 改赞助段措辞时只改了中文版 README、随后停下来问用户「英文版要不要同步」，被用户纠正——英文版必须与中文版内容同步，这不需要问，每次改动都应自动同步。据此立规写入全局。
- **改了什么**：**全局 `~/.claude/CLAUDE.md`** 新增「中英双语 README 内容自动同步（2026-08-17 用户立）」节——凡项目同时存在中英双版 README（英文 `README.md` + 中文 `README_cn.md`，以项目实际双版文件名为准），每次改动任何一版的内容都必须在同一轮改动里自动同步另一版，不需要问用户；中文版为权威方向（用户用中文打磨措辞，英文跟随）；英文按英文习惯表达、不必逐字直译，但语义内容（信息点、列举项、口径、数字）必须对齐；语言固有差异允许（如中文「如……等」的非穷尽语义，英文 "such as" 已含，不必再叠 "etc."）；边界——语言特有的内容（如语言切换链接）不算内容差异、单语 README 项目不适用。
- **同步镜像**：`claude/CLAUDE.md` 随全局逐字节一致（`diff` 验证通过）。

## 2026-08-16

### 变更（Visitors 徽章命名全局统一为首字母大写：全局 CLAUDE.md 与 commit skill 规格措辞修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户指令（2026-08-16）「Visitors 徽章全局统一，首字母大写」——前一条「英文首字母必须大写」规定落地后，全局规则与 commit skill 正文里描述这枚徽章的措辞仍有小写 `visitors`（如「visitors 访问量徽章」「`alt="visitors"`」），规格本身与自己的规定不一致，需一并收口。
- **改了什么**：**全局 `~/.claude/CLAUDE.md`「访问量徽章」条目**——条目名与正文的小写 `visitors` 统一为 `Visitors`，并补注 badge JSON 的 `label` 字段实为 `Visits/day`（徽章展示日均访问量，`alt` 与 label 是两个不同的显示位）；**全局 `~/.claude/skills/commit/SKILL.md`**——description、9a「Visitors 访问量徽章」段、9l、例外清单、缓存标记说明、汇报段共 10 处小写 `visitors` 措辞改为 `Visitors`，9a 段的 `alt="visitors"` 规格改为 `alt="Visitors"` 并同样补注 label=`Visits/day`。
- **同步镜像**：`claude/CLAUDE.md`、`claude/skills/commit/SKILL.md` 随全局逐字节一致（`diff` 验证通过）。
- **关联**：各 fleet 仓库 README 的 `alt="visitors"` → `alt="Visitors"` 存量修正由各仓库自行记录，不在此重复。

### 变更（徽章规矩新增「英文首字母必须大写」规定：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户立规（2026-08-16）——README 徽章上的英文小写首字母（`license-MIT`、`visits/day`、`mode-signal` 等）在徽章墙上观感不一致、显得随意，与 fleet 统一的专业视觉风格不符；首字母大写是英文标识词的标准书写规范。
- **改了什么**：**全局 `~/.claude/CLAUDE.md`「新建 Agent 项目的脚手架与开源约定」节**新增「徽章英文首字母必须大写（2026-08-16 用户立）」条目——README 里所有徽章上的英文文字（静态 badge 的 label 与 message、endpoint 徽章 JSON 的 `label` 字段、`<img>` 的 `alt` 文本）凡英文首字母一律大写（如 `License-MIT`、`Visits/day`、`Mode-Signal`）；新写徽章直接按大写书写，既有小写存量接触一处改一处；边界：URL 路径等非显示内容不管，单词内部字母（`AI`、`iOS`）按该词本身规范书写。同时「访问量徽章」条目里的徽章名示例从 `visitors` 更新为 `Visitors`（与「日均口径」改动同批落地）。
- **同步镜像**：`claude/CLAUDE.md` 随全局逐字节一致（`diff` 验证通过）。
- **关联**：本规定的存量落地修正分散在各仓库（xhqing 的 badge JSON 与采集脚本、三个 agent 仓库的 README），各仓库侧的变更记各自 CHANGELOG，不在此重复。

### 变更（待办 TODO 管理新增「优先级分类」规定：全局 CLAUDE.md 修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户在 DayTradingAgent 全项目审计后立规——待办不分轻重混排，紧急的（会亏钱的 bug）和不要紧的（改个措辞）排在一起，容易先做了轻的、漏了重的；按严重度分层后「什么必须马上修」一眼可见，处理顺序有依据。
- **改了什么**：**全局 `~/.claude/CLAUDE.md`「待办（TODO）管理」节**新增「优先级分类（2026-08-16 用户立，每次写入 TODO 必须判断）」条目——① 每条待办写入 `TODO.md` 时必须判断严重度并标注类别，**至少分三类**：🔴 高危（不修会直接亏钱 / 下错单 / 安全事故 / 数据统计结论错误 / 核心功能不可用，须优先处理）、🟡 中危（边界情况出错 / 防护缺口 / 口径不一致可能演化为实际损失，排在高危之后）、🟢 轻危（文档措辞 / 格式漂移 / 卫生问题 / 不影响正确性的优化，有空再处理）；② 标注格式「`[ ] 🔴` / `[ ] 🟡` / `[ ] 🟢`」放条目开头；③ 判断拿不准往高靠（宁高勿低）；④ `TODO.md` 文件结构同步改为按优先级分节（高危在前、中危居中、轻危在后，同优先级内可再按主题分三级节），`TODO-archive.md` 归档时保留优先级标注；⑤ 既有无类别的存量条目接触一条补一条（顺手补标、不专门返工）。
- **同步镜像**：`claude/CLAUDE.md` 随全局逐字节一致（`diff` 验证通过）。
- **关联**：本规定的首次落地应用在 DayTradingAgent（当日全项目审计发现落入 TODO.md、按三类分级），该项目侧的 TODO 重构记其自己仓库的 CHANGELOG，不在此重复。

### 变更（徽章规矩新增 fleet visitors 访问量徽章例外：全局 CLAUDE.md + commit skill 同步修订，随自动同步规矩镜像到 `claude/`）

- **为什么改**：2026-08-16 全舰队上线集中式「真去重」访问统计（部署在 xhqing 仓库：`scripts/update_traffic.py` + 每日 GitHub Action 拉官方 Traffic API，各 fleet 仓库 README 挂 visitors 徽章、URL 指向 `xhqing/xhqing` 的 `traffic/badges/<repo>.json`）。而既有徽章规矩（全局 CLAUDE.md「脚手架」节 + commit skill 9a/9l）规定「标准三枚 License / Version / Type、不含动态徽章」——新徽章若不修规矩，会被 commit skill 第 9l 步当违规徽章删掉。故立例外条款：这枚 visitors 徽章属「指向本仓库静态 JSON 的 endpoint 徽章」，不是 shields.io 实时抓取 GitHub 的动态数值徽章，与原规矩的立法本意（避免随仓库变动的动态数值 / 时间徽章）不冲突。
- **改了什么**：
  - **全局 `~/.claude/CLAUDE.md`「新建 Agent 项目的脚手架与开源约定」节**：标准徽章条目后新增「访问量徽章（visitors，2026-08-16 立，fleet 仓库专用例外）」条目——fleet 各仓库在标准三枚之外另挂一枚 visitors 徽章（shields.io endpoint 指向 `xhqing/xhqing` 的 `traffic/badges/<repo>.json`）；说明允许理由（静态 JSON endpoint、非实时动态徽章、fleet 统一部署的有意例外）与边界（只豁免这一种 URL 形态，komarev / seeyoufarm 等第三方计数图片及其它动态徽章仍不挂）。
  - **全局 `~/.claude/skills/commit/SKILL.md`** 六处：① description——项目标配徽章项补「fleet 仓库可另挂指向 xhqing traffic/badges/ 的 visitors 访问量徽章，属允许例外」；② 9a 新增「visitors 访问量徽章」专段（URL 形态、允许理由、**9a 不主动补挂**——挂徽章是 fleet 部署动作而非标配缺失、数据源 JSON 由 xhqing 采集流程生成非本仓库可自行补造；已挂的不动，9l 对该 URL 形态豁免；边界同上）；③ 9l 检测逻辑——检测时先排除 URL 含 `xhqing/xhqing/main/traffic/badges/` 的 endpoint 徽章（不算三类违规）、修正段的「其余徽章」清单明确含 visitors 访问量徽章；④ 底线原则两处「移除动态徽章」措辞补「fleet 仓库的 visitors 访问量徽章属允许例外、不删」（第 20、272 行）；⑤ 缓存段 `readme-badges` 标记说明与缓存模板行补例外表述；⑥ 汇报段徽章清单项补「fleet 仓库已挂的 visitors 访问量徽章属允许例外、如实报告『保留未动』」。
  - **同步镜像**：`claude/CLAUDE.md` 与 `claude/skills/commit/SKILL.md` 随全局逐字节一致；`diff -r` 验证三部分（skills / rules / CLAUDE.md）全部一致。
- **关联**：本次修订与 xhqing 仓库的集中式统计部署是同一件事的两面（统计基础设施在 xhqing、规矩层在全局 CLAUDE.md + commit skill）；xhqing 侧的变更记录在其自己仓库的 CHANGELOG，不在此重复。

## 2026-08-12

### 新增（README 访问量徽章——舰队集中式访问统计）

- **为什么改**：全舰队上线集中式「真去重」访问统计（图片徽章方案无法去重，走官方 Traffic API 路线）：统计集中部署在 xhqing 仓库（`scripts/update_traffic.py` + 每日 GitHub Action），各 fleet 仓库只需在 README 挂徽章、零运行负担。
- **改了什么**：README（EN/CN）徽章区新增 visitors 徽章（shields.io endpoint 指向 `xhqing/xhqing` 仓库 `traffic/badges/<repo>.json`，由每日采集的官方 Traffic API 数据更新）。徽章数字含义：按日去重访客的累计（GitHub 只提供每日 uniques，跨天不去重），自 2026-08-16 起累计。

### 变更（全局 CLAUDE.md「脚手架与开源约定」节徽章规定修订：标准徽章改为 License / Version / Type 三枚，去掉 Forks 及 Stars / Last Commit，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户立新规矩——README 徽章**不要** Forks 徽章，**必须含有**的三枚分别是 License / Version / Type。原规定是「License MIT / Stars / Last Commit / AI Agent」四枚；用户决定把 Stars（GitHub 星标数）与 Last Commit（最近提交时间）一并去掉——它们与 Forks 同属「随仓库变动的动态数值 / 时间徽章」，徽章集合只保留静态描述类（许可证、版本号、项目类型），逻辑统一。其中 `Type` 即原 `AI Agent` 那枚「标项目类型」的徽章，只是归类名改为 Type。
- **改了什么**（全局 `~/.claude/CLAUDE.md`，已镜像到 `claude/`）：
  - 「新建 Agent 项目的脚手架与开源约定」节的**标准徽章**规定从「shields.io：License MIT / Stars / Last Commit / AI Agent」改为「shields.io：**License / Version / Type** 三枚是必须含有的底线——License 标开源许可证（如 MIT）、Version 标项目版本号（取自 VERSION 文件）、Type 标项目类型（如 AI Agent）；**不含** Forks，也不含 Stars / Last Commit 等 GitHub 动态数值 / 时间徽章；另**不含**点明 LLM / 厂商的徽章（如 "Built with Claude Code"）」。
  - **同步镜像**：`claude/CLAUDE.md` 随全局逐字节一致；diff 验证通过。
- **待跟进（回归风险提醒）**：全局 commit skill（`~/.claude/skills/commit/`）第 9 步项目标配检测会查 README 徽章——其检测项与措辞仍按旧规定（「不含 GitHub Stars 数量徽章」等），与新规矩的「License / Version / Type 三枚必须含有、不含 Forks / Stars / Last Commit」不一致。本次只改 CLAUDE.md 规定，**未动 commit skill 检测逻辑**，留待用户决定是否同步更新 commit skill。

### 变更（落实上一条「待跟进」：commit skill 第 9 步徽章检测同步新规矩，随自动同步规矩镜像到 `claude/`）

- **为什么改**：落实上一条「待跟进」——commit skill 的徽章检测逻辑（9a「徽章组合」补哪些徽章、9l 清理哪些违规徽章、description / 底线原则段 / 缓存标记 / 报告模板里的徽章表述）仍按旧规矩（License + last-commit + Type / 只删 Stars），与刚修订的全局 CLAUDE.md 新规矩（License / Version / Type 三枚必须、不含 Forks / Stars / Last Commit）不一致，须同步更新，否则 `/commit` 检测与规定打架。
- **改了什么**（全局 `~/.claude/skills/commit/SKILL.md`，已镜像到 `claude/`）：
  - **description**：项目标配里的徽章项从「徽章(不含 GitHub Stars 数量徽章)」改为「标准徽章(License/Version/Type 三枚必须含有，不含 Forks/Stars/Last Commit)」。
  - **9a「徽章组合」**：从「有 remote 用 License + `github/last-commit/<user>/<repo>` + Type 三枚、无 remote 用 License + Type 两枚、不用 Stars」改为「**固定三枚 License / Version / Type**，不按 remote 区分数量」——新增 **Version 徽章**（版本号取 `VERSION` 文件，VERSION 尚不存在时按 9m「版本号取值顺序」兜底：`package.json` version → 主 manifest → 已有 CHANGELOG 顶部版本 → `1.0.0`；URL 形如 `img.shields.io/badge/Version-v1.2.3-blue`），移除 `last-commit` 徽章；明确三枚统一用静态 `badge` 端点、**不使用** `github/stars/`、`github/forks/`、`github/last-commit/` 等动态徽章（已存在的由 9l 清理）；Version 徽章的版本号后续随 9j（版本滞后 bump）/ 9k（版本号一致性同步）一起更新。
  - **9l**：从「README 不含 GitHub Stars 数量徽章」（只删 stars 一类）升级为「**README 徽章组合合规**」——标准三枚（License / Version / Type）齐全且**不得包含 Forks / Stars / Last Commit 三类动态徽章**（URL 路径含 `github/forks/`、`github/stars/`、`github/last-commit/` 之一即违规）；检测、修正、突破「只补不删」原则的措辞相应扩展到三类。
  - **缓存标记**：`readme-no-stars-badge` 改名为 `readme-badges`（语义从「不含 stars」升级为「徽章组合合规」）；缓存模板行、缓存标记说明（第 257 行）、报告模板（第 276 行）联动更新。
  - **底线原则段两处例外表述**（第 20、271 行）：「移除 GitHub Stars 数量徽章（第 9l 步）」改为「移除 Forks/Stars/Last Commit 等动态徽章（第 9l 步）」。
  - **报告模板**（第 276 行）：「徽章清单（含移除 GitHub Stars 数量徽章，如有）」改为「徽章清单（License / Version / Type 三枚补全情况，含移除 Forks / Stars / Last Commit 等动态徽章，如有）」。
  - **同步镜像**：`claude/skills/commit/SKILL.md` 随全局逐字节一致；diff 验证通过；旧表述（`readme-no-stars-badge`、「GitHub Stars 数量徽章」）已全量扫描确认无残留。

## 2026-08-10

### 变更（commit skill 缓存文件名简化 + 全局 CLAUDE.md 新增「文件命名规范」节，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户立「文件命名规范」——文件名必须用英文命名、且用尽可能简单的名字（去掉冗余修饰词）；commit skill 检测缓存文件名 `.commit-skill-cache.md` 中 `skill` 是冗余修饰，简化为 `.commit-cache.md`。
- **改了什么**（全局 `~/.claude/`，已镜像到 `claude/`）：
  - 全局 `~/.claude/CLAUDE.md` 新增「## 文件命名规范（2026-08-10 用户立）」节：英文命名 + 尽可能简单（删冗余修饰词，示例 `.commit-skill-cache.md` → `.commit-cache.md`）；边界——不牺牲语义清晰（压到语义不明即过度简化）；存量文件改名须同步更新所有引用处。
  - 全局 commit skill `SKILL.md`：全部 9 处 `.commit-skill-cache.md` 引用改为 `.commit-cache.md`（description、核心定位、第 9 步、xhqing 例外段、9e/9j/9k 不写标记段、缓存专用载体文件段等）。
  - **同步镜像**：`claude/CLAUDE.md`、`claude/skills/commit/SKILL.md` 随全局逐字节一致；diff 验证通过。

### 变更（全局 CLAUDE.md「超集关系」节再修订：CLAUDE.md 内容是「新增」而非「覆盖」，冲突以子项目为准，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户于 2026-08-10 同日再次纠正——Agent 项目 `CLAUDE.md` 内容进子项目不是「覆盖」，而是「**新增**」：子项目原有的 `CLAUDE.md` 内容**保持不变**，Agent 的内容加进去；两者放一起后**不能有逻辑冲突**（身份矛盾、规则打架、职责冲突等），**若有冲突以子项目原有的内容为准，且必须向用户汇报冲突内容**（冲突双方各是什么、怎么处理的）。原「覆盖到子项目」表述会误导为覆盖掉子项目原有内容。
- **改了什么**（全局 `~/.claude/CLAUDE.md`，已镜像到 `claude/`）：
  - 超集关系节总述：`CLAUDE.md` 的**内容**同样「覆盖到子项目」改为「**新增到子项目**」；「子项目独有内容保留不动」括注补「子项目原有的 `CLAUDE.md` 内容」。
  - 「`CLAUDE.md` 内容同样超集」条：明确**做法是「新增」而不是「覆盖」**——子项目原有内容保持不变、Agent 内容新增进去（置于原有内容之前 / 之后均可）；新增**逻辑冲突约束**：两者放一起不能有逻辑冲突，发现冲突以子项目原有内容为准、必须向用户汇报冲突内容；Agent 内容更新时同步新增 / 更新子项目对应内容、子项目原有内容始终保留不动。
  - 实例清单两处（「子项目清单」「边界」）：补入 PersonalAssistantAgent（Kit）→ xhqing（用户 GitHub 个人主页仓库）。
  - **同步镜像**：`claude/CLAUDE.md` 随全局逐字节一致；diff 验证通过。

### 变更（全局 CLAUDE.md「超集关系」节：实例清单升级为权威映射表 + 补 Hermes → XPilot，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户指出规则里「当前实例：……」是举例式内联罗列（两处重复——「子项目清单」条、「边界」条），让人误以为只是举例而非权威清单，且两处重复维护会不一致；同时用户新增子项目 XPilot 交由 Hermes（NetOpsAgent）负责，需登记进映射。要求所有超集关系映射写清楚、单一权威来源。
- **改了什么**（全局 `~/.claude/CLAUDE.md`，已镜像到 `claude/`）：
  - 超集关系节新增「**超集关系映射（完整清单，权威）**」表格，列出全部 Agent → 子项目映射：BackendEngineerAgent（Anvil）→ CC-BRIDGE、PersonalAssistantAgent（Kit）→ xhqing、NetOpsAgent（Hermes）→ XPilot（本次新增）；并要求新增 / 变更子项目时以此表为准、同步更新对应 Agent 项目 `.claude/CLAUDE.md` 的「子项目清单」节。
  - 「子项目清单」「边界」两处原来的「当前实例：……」内联罗列，改为引用上方映射表（消除两处重复、单一来源）。
  - **同步镜像**：`claude/CLAUDE.md` 随全局逐字节一致；diff 验证通过。

### 变更（全局 CLAUDE.md「超集关系」节修订：CLAUDE.md 内容同样超集、效果等价即可，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户明确要求 Agent 项目 `CLAUDE.md` 的**所有内容**也保持超集关系——不要求逐字节一致、不要求放在同名文件，只要效果等价（子项目会话能加载 / 看到 Agent 的全部规则）即可；最简单是把 Agent 项目 `CLAUDE.md` 内容直接加进子项目 `CLAUDE.md`，也可放子项目 `rules/` 下再 `@` 引用。原「`CLAUDE.md` 例外（各项目独有、只要求归属说明）」表述已不再成立，需修订。
- **改了什么**（全局 `~/.claude/CLAUDE.md`，已镜像到 `claude/`）：
  - 「Agent 项目与子项目的 `.claude/` 超集关系」节总述：补「`CLAUDE.md` 的**内容**同样覆盖到子项目（实现方式不限、效果等价即可）」。
  - 「`CLAUDE.md` 例外」条改为「`CLAUDE.md` 内容同样超集（实现方式不限，效果等价即可）」：内容须完整覆盖到子项目，但方式不限——直接加进子项目 CLAUDE.md 或放子项目 `rules/` 下 `@` 引用均可；建议带指代说明（如「以下为 BackendEngineerAgent（Anvil）CLAUDE.md 全文，其中『本项目』均指 BackendEngineerAgent」）避免指代混淆；Agent 项目 `CLAUDE.md` 内容更新时同步更新子项目对应内容。
  - **同步镜像**：`claude/CLAUDE.md` 随全局逐字节一致；diff 验证通过。

### 变更（全局 CLAUDE.md 新增「Agent 项目与子项目的 `.claude/` 超集关系」节，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户要求把「Agent 项目与所属子项目之间 `.claude/` 超集关系」立为**全局规则**——该关系存在于所有 Agent 项目与其负责的子项目之间，需在全局注明（此前仅写在 BackendEngineerAgent 项目级 CLAUDE.md）。目的：保证用户只操作子项目（如 CC-BRIDGE）时，子项目的 `.claude/` 也包含 Agent 项目的完整内容，体现项目归对应 Agent 负责。
- **改了什么**（全局 `~/.claude/CLAUDE.md`，已镜像到 `claude/`）：
  - 新增「## Agent 项目与子项目的 `.claude/` 超集关系（2026-08-10 用户立）」节，要点：Agent 项目 `.claude/` 为权威源、子项目 `.claude/` 为超集（除 `CLAUDE.md` 外每个文件逐字节一致、子项目独有内容保留不动）；Agent 项目 `.claude/` 内容变更（新增 / 修改 / 删除）自动同步到所有子项目、无需询问；子项目清单由各 Agent 项目 CLAUDE.md 维护（当前实例：Anvil → CC-BRIDGE）；`CLAUDE.md` 各项目独有、不逐字节同步、只要求子项目含「由该 Agent 负责」的归属说明；同步后 diff 验证；源变更记 Agent 项目 CHANGELOG、同步不重复记子项目 CHANGELOG；`settings.local.json` 同样同步、子项目 `.gitignore` 缺忽略规则一并补上；边界：目前仅 BackendEngineerAgent → CC-BRIDGE 一例。
  - **同步镜像**：`claude/CLAUDE.md` 随全局逐字节一致；diff 验证通过。

### 变更（全局 CLAUDE.md 智能体命名注册表新增 Anvil 行 + 位置说明，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户新建后端开发工程师 Agent（`BackendEngineerAgent`，拟人名 **Anvil**），按「新建带拟人名的 Agent 时自动维护注册表（免确认）」规矩，需向全局 CLAUDE.md 的智能体命名注册表追加新成员行，并在「销售流水线顺序」段补位置说明。
- **改了什么**（全局 `~/.claude/CLAUDE.md`，已镜像到 `claude/`）：
  - 注册表表格新增一行：**Anvil** | BackendEngineerAgent | 后端开发工程师 | 负责所有后端开发工作（服务端逻辑 / API / 数据库 / 系统架构 / 桥接服务），目前在手 CC-BRIDGE（Claude Code 上游桥接框架），独立于销售流水线。
  - 「销售流水线顺序」段：独立 agent 名单补入 Anvil（Kit、Victor、Tinker、Prometheus、Markowitz、Hermes、Anvil 各自独立）。
  - **同步镜像**：`claude/CLAUDE.md` 随全局逐字节一致；diff 验证通过。

## 2026-08-10

### 变更（新增全局 rules「Windows SSH 远程操作规范」+ 全局 CLAUDE.md 补齐 rules `@` 引用区，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户为 Mac 本机配置了经 SSH 管理同一局域网 Windows 机器的通道（`~/.ssh/config` 别名 `win-ai`、专用密钥免密登录普通权限账户），并要求把「`ssh win-ai` 只能用于普通权限操作、管理员凭据仅限人工应急」立为**全局操作规范**（对所有 agent 会话生效）。同时发现全局 CLAUDE.md 此前没有 rules `@` 引用区（既有 3 个 rules 文件未被引用，属「漏加载」违规），按「rules 文件必须在 CLAUDE.md 中 @ 引用」纪律一并补齐。属全局通用能力（rules 增补 + CLAUDE.md 规矩补齐），按「底层通用能力开源」自动同步规矩镜像到本项目 `claude/`。
- **改了什么**（全局 `~/.claude/`，已镜像到 `claude/`）：
  - **新增全局 rules**：`rules/windows-ssh-ai-operation.md`——对 Windows 机器的操作**默认**经 `ssh win-ai`（公钥免密、普通权限账户）执行；**需要管理员权限时先征求用户同意**、同意后以管理员身份（`ssh win-ai-admin`）执行本次操作（默认不主动使用管理员权限）；两条通道都是公钥免密，无需也不应使用密码文件；记录连接方式只用别名 + 占位符、不把真实 IP / 用户名写进会被 git 跟踪的文件。规则正文不写任何真实连接信息（IP、用户名、密码），clone 者按本机 `~/.ssh/config` 自行适配。（当日按用户要求两次修订：初稿曾写「管理员凭据仅限人工应急」，用户纠正为「管理员权限 AI 也可用、只是需征求同意」；随后按用户要求给管理员账户也配置了公钥免密通道，规则同步改为两条免密通道 + 密码文件退役）
  - **全局 `~/.claude/CLAUDE.md` 末尾新增「工作规则（全局 rules 显式引用）」节**：`@` 引用新增的 `windows-ssh-ai-operation` 及既有 `file-operation-priority-rules` / `tmp-dir-for-artifacts` / `verify-before-report` 三条（此前未被引用 = 漏加载，本次补齐）。
  - **同步镜像**：`claude/rules/windows-ssh-ai-operation.md` 与 `claude/CLAUDE.md` 随全局逐字节一致；`diff -r` 验证 rules / CLAUDE.md 均一致。

## 2026-08-10

### 变更（新增全局 skill `win-ai-monitor`——Win-AI 操作监视台，随自动同步规矩镜像到 `claude/skills/`）

- **为什么改**：用户配置了经 SSH 管理 Windows 机器（`win-ai` / `win-ai-admin`），并要求「AI 在 Win 上执行操作时全程可见」。经多轮调试（Session 0 隔离导致窗口不可见、脚本编码、GUI 事件作用域等），最终用「计划任务 XML（InteractiveToken）+ PsExec `-i 2` 投递到用户会话 + WinForms GUI 全屏置顶窗体」打通，用户确认窗口可见。为固化这套方案、避免下次重折腾，按用户要求写成全局 skill。
- **改了什么**：
  - 新增 `skills/win-ai-monitor/`：`SKILL.md`（触发说明 + 启动步骤 + 写日志方法 + 重建流程 + 关键坑清单）+ `scripts/monitor-gui.ps1`（全屏置顶 GUI 监视窗口）+ `scripts/start-monitor.ps1`（清理残留 → psexec 投递 → 触发任务 → 验证）+ `scripts/winaimonitor-task.xml`（登录自启任务模板）。
  - 核心规矩：**每次启动必须全屏 + 窗口最上层（TopMost）**；写 `.ps1` 必须带 UTF-8 BOM；GUI Timer 用全局变量。
  - 同步镜像：`claude/skills/win-ai-monitor/` 与全局逐字节一致。

## 2026-08-10

### 变更（`win-ai-monitor` skill 重构：从「全屏置顶监视台」改为「桌面代理 + 后台监视台」的窗口按需切换方案，随自动同步规矩镜像到 `claude/skills/`）

- **为什么改**：用户在多轮实测后明确需求——不是「监视台永远置顶」，而是「**操作哪个窗口，哪个窗口最大化置顶**」：执行命令时弹置顶终端窗口显示输入输出，操作 VSCode / Edge / 飞书等程序时把对应窗口置顶；任务栏始终保留；监视台只做后台记录、不抢焦点。旧版「全屏置顶监视台」会挡住一切窗口，已不合用。
- **改了什么**：
  - **SKILL.md 重写**：核心机制从「全屏置顶监视台」改为「桌面代理（win-ai-agent）+ 后台监视台」。代理指令 `EXEC <命令>`（弹最大化置顶终端执行命令、打印输入输出）、`TOP <进程名>`（任意窗口最大化置顶，如 `TOP Code` 置顶 VSCode）；新增启动/重启、清理残留 AI-CMD 窗口、重建流程；关键坑补「任务栏恢复」（不要隐藏任务栏，万一消失须在用户会话重启 explorer）、`$Args` 自动变量坑。
  - **scripts/ 更新**：新增 `win-ai-agent.ps1`（代理 v7，支持任意窗口置顶）、`winaiagent-task.xml`（代理登录自启任务）；`monitor-gui.ps1` 改为后台记录版（不置顶、不抢焦点、可覆盖）；移除废弃的 `start-monitor.ps1`（旧控制台方案）。
  - **验证**：多窗口连续切换测试通过（TOP Code / TOP msedge / TOP Feishu / EXEC 终端均正常最大化置顶，任务栏保留）。
  - **同步镜像**：`claude/skills/win-ai-monitor/` 与全局逐字节一致。

## 2026-08-09

### 变更（通用能力开源改单一出口：新建 agent 项目不再放通用能力副本 + 全量同步镜像 + 各项目副本清理）

- **为什么改**：用户立新规则——新建 Agent 项目**不再放置与全局重复的通用能力**（anysearch、find-skill、通用三件套等），通用能力开源分发统一经本项目 `claude/` 镜像一次性完成。直接触发是 2026-08-09 新建 NetOpsAgent 时发现副本易过期分叉（anysearch `runtime.conf` 副本与全局不一致、find-skill 副本多出 `.env.example`）；此前各项目各自放副本、通用能力一改就要同步所有项目，维护成本高且必然漂移。属全局通用能力（CLAUDE.md 规矩修订 + 镜像扩充 + 各项目副本清理），按「底层通用能力开源」自动同步规矩镜像到本项目 `claude/`。
- **改了什么**（全局 `~/.claude/CLAUDE.md`，已镜像到 `claude/CLAUDE.md`）：
  - **新增「通用能力开源单一出口」节（2026-08-09 立）**，取代原「skill 项目副本的存在原因」：新建 Agent 项目一律不放与全局重复的通用能力；通用能力经本项目 `claude/` 镜像统一开源；边界为只管新建项目，既有项目副本不做强制回退。
  - **「新建 Agent 项目的脚手架与开源约定」修订**：「每个项目都复制 skills / rules / commands」改为「不复制通用能力，只放角色专属内容 + 项目级配置」。
  - **anysearch / find-skill 两个同步小节**：同步范围收为「已存在副本的既有项目」，新建项目不再放置。
  - **「rules 文件必须在 CLAUDE.md 中 @ 引用」节补充边界**：项目级 `@` 引用针对项目自有的 `.claude/rules/` 文件。
  - **注册表 Prometheus 职责行更新**：职责加入「通用能力开源单一出口（新建 agent 项目不再分发副本，既有项目副本按需维护）」。
- **改了什么**（镜像扩充，`claude/skills/` 补 5 个缺失 skill + manifest）：
  - 补入全局存在、镜像缺失的 `agent-reach`、`ef-broadcast`、`ef-communication`、`ef-profile`、`ef-trading` 5 个 skill 与 `.ef-manifest.json`（EigenFlux 技能元数据）；`diff -r` 验证后 skills / rules / CLAUDE.md 三部分与全局逐字节一致（`find-skill/.env` 与 `cache/` 本机数据仍由 `.gitignore` 隔离，为唯一允许差异）。
- **改了什么**（各 agent 项目副本清理，用户 2026-08-09 授权统一执行）：
  - NetOpsAgent（新建）：删除 `.claude/skills/anysearch/`、`find-skill/`、`.claude/rules/` 通用三件套、`.claude/commands/install-skill.md`，`.gitignore` 去 find-skill 条目，`.claude/CLAUDE.md` 注明「通用能力从全局 / 本项目镜像获取」，CHANGELOG 记「移除」条目。
  - 既有 6 个老项目统一清理：DataAnalystAgent、DigiVendAgent、GrowthMarketerAgent、PersonalAssistantAgent、ProductProducerAgent、SiteBuilderAgent 删除 `.claude/skills/anysearch/`、`find-skill/`、`install-skill.md` 与通用三件套 rules（保留各自角色专属内容，如 DigiVendAgent 的 `vend`、SiteBuilderAgent 的 `site-builder`、销售流水线专属 rules）；各项目 `.gitignore` 去 find-skill 条目；PersonalAssistantAgent 的 `.claude/CLAUDE.md` 更新通用能力引用为「从全局 / 本项目镜像获取」；QuantStrategistAgent 虽无 anysearch / find-skill 副本，其遗留的配套 `install-skill.md` 命令一并删除。5 个项目无 CHANGELOG（历史遗留未按标配补齐），清理记录统一记本文件、由 commit skill 在其 `/commit` 时补 CHANGELOG / VERSION 标配。

## 2026-08-05

### 变更（撤销 todo-skill、待办管理改回项目根 TODO.md / TODO-archive.md 文件制，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户决定撤销 2026-08-05 当日刚立的 todo-skill 机制——待办管理不需要专门的 skill，方法论直接写进全局 CLAUDE.md 即可对所有项目生效；数据文件放项目根（项目通用位置、天然存在、不依赖 skill 加载），省去维护 skill 本体及各项目副本的负担。属全局通用能力（CLAUDE.md 规矩修订 + 删除通用 skill），按「底层通用能力开源」自动同步规矩（2026-08-01 用户立：发现分叉直接同步、无需询问）镜像到本项目 `claude/`。
- **改了什么**：
  - 全局 `~/.claude/CLAUDE.md`「待办（todo）管理走 todo-skill」节修订为「待办（TODO）管理：项目根 TODO.md 与 TODO-archive.md」：数据文件改放**项目根**（`TODO.md` 活跃只放未完成 + `TODO-archive.md` 归档已完成 / 已更新）、不设 skill、不依赖 skill 加载；原 SKILL.md 方法论全文吸收进本节（文件结构、待办条目格式、四步使用流程、边界），核心规矩全部保留（记录时间戳精确到分钟 / 前后矛盾以最新时间戳为准 / 做完改动闭环归档 / 不删已处理条目 / 敏感信息占位符）。
  - **删除 todo-skill**：全局 `~/.claude/skills/todo/` 与本镜像 `claude/skills/todo/` 删除（SKILL.md 方法论已并入全局 CLAUDE.md 节、无信息丢失）；DayTradingAgent 项目副本 `.claude/skills/todo/` 同步删除、其 TODO 数据文件移回项目根（见 DayTradingAgent CHANGELOG 2026-08-05）。
  - **同步镜像**：`claude/CLAUDE.md` 随全局逐字节一致；`diff -r` 验证 skills / rules / CLAUDE.md 三部分均一致（todo 在全局与本镜像两边均不存在）。

### 变更（全局 CLAUDE.md「待办统一存项目根 TODO.md」修订为「待办管理走 todo-skill」+ 新建全局 todo-skill，随自动同步规矩镜像到 `claude/`）

- **为什么改**：用户决定把待办管理机制从「各项目根 TODO.md 单文件（未完成与已处理混放）」改为 todo-skill 制——`TODO.md` 只放未完成条目、已完成 / 已更新条目归档到 `TODO-archive.md`，使「还有哪些没做」一眼全览。属全局通用能力（CLAUDE.md 规矩修订 + 新通用 skill），按「底层通用能力开源」自动同步规矩（2026-08-01 用户立：发现分叉直接同步、无需询问）镜像到本项目 `claude/`。
- **改了什么**：
  - 全局 `~/.claude/CLAUDE.md`「待办（todo）统一存项目根 TODO.md」节整体修订为「待办（todo）管理走 todo-skill（2026-08-05 改为 todo-skill 制）」：数据文件改放各项目 `.claude/skills/todo/`（`TODO.md` 活跃只放未完成 + `TODO-archive.md` 归档已完成 / 已更新）；闭环流程由「标记保留在原文件」改为「条目移入归档」；原「时间戳精确到分钟 / 前后矛盾以最新时间戳为准 / 不删已处理条目」等核心规矩保留、细节指针到 todo-skill。
  - **新建全局 todo-skill**（`~/.claude/skills/todo/`，本镜像 `claude/skills/todo/`）：`SKILL.md` 方法论——文件结构（SKILL.md 全局权威逐字节一致 / TODO.md 活跃 / TODO-archive.md 归档，后两者为各项目数据不同步）、待办条目格式（记录时间戳）、四步使用流程（记录 / 查询 / 完成更新闭环 / 矛盾以最新为准）、边界（不污染规范文档、敏感信息占位符）。按 skill-creator 方法论写（pushy description、Progressive Disclosure、主文件精简）。
  - **同步镜像**：`claude/CLAUDE.md` 与 `claude/skills/todo/SKILL.md` 随全局逐字节一致；`diff -r` 验证 skills / rules / CLAUDE.md 三部分均一致。
- **边界**：todo-skill 属通用 skill，各业务 agent 项目按需自行建立 `.claude/skills/todo/` 数据文件（DayTradingAgent 已先行落地：待办拆分 10 未完成 + 29 归档、项目根 TODO.md 移除，见其 CHANGELOG 2026-08-05；其它项目沿用旧制或按 todo-skill 迁移由各项目决定）。

## 2026-08-04

### 变更（项目说明 CLAUDE.md 从根目录迁入 `.claude/`，并订正正文残留的「项目根本目录」措辞）

- **为什么改**：项目说明 `CLAUDE.md` 原在仓库根目录，但它属项目级内容（非通用能力主体），放进 `.claude/`（本项目独有的项目级能力目录）与 capability-manager skill 等项目级能力同处一处更合理、根目录也更干净。迁入后正文仍写「项目根本目录的这个 `CLAUDE.md`」，与新位置 `.claude/CLAUDE.md` 不符，需订正。
- **改了什么**：
  - **迁入**（提交 `6b8650d`，纯重命名、内容未变）：`CLAUDE.md` → `.claude/CLAUDE.md`。
  - **订正措辞**：正文「项目根本目录的这个 `CLAUDE.md`」改为「本文件（`.claude/CLAUDE.md`）」，与新位置一致；其余内容（通用能力主体在 `claude/`、`.claude/` 为项目级能力目录、缓存独立到 `.commit-skill-cache.md` 等）不变。

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
