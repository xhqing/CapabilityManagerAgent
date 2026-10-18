# 智能体命名注册表与团队结构

> 本文件由全局 `~/.pi/agent/CLAUDE.md`「团队结构参考」指针节指向。**何时读**：新建 Agent 项目前（名称查重）、判断某子任务该移交给哪个 agent 时、新增 / 变更 Agent 或子项目的注册信息时。权威源在全局 `~/.pi/agent/docs/`，开源镜像在 CapabilityManagerAgent 仓库 `claude/docs/`。

## 智能体命名注册表（避免重名 + 跨 agent 推荐）

下列是已存在的智能体。**新起名称前先查此表，全局不可重复**（名称规则：以 `Agent` 结尾、前缀尽可能简单，如 `cuAgent`；历史 agent 多为拟人名）。执行任务时，若发现某子任务更适合另一个 agent，应主动推荐 / 移交给它。

| 名称 | 项目（仓库） | 职称 Title | 主要职责 |
|---|---|---|---|
| **Scout** | ProductStrategistAgent | 选品策略师 | 研判：热点 + 市场 + 竞品 + 盈利 + 渠道 →《机会研判报告》 |
| **Wright** | ProductProducerAgent | 数字产品制作人 | 生产：做出成品数字产品（prompt 包 / 模板 / ebook / 素材） |
| **Mason** | SiteBuilderAgent | 建站工程师 | 建设：搭成交基础设施——独立站建设 + 落地页技术与部署 + 支付渠道与接口配置；建设期（Wright 之后、Buzz 之前），建好把购买链接交 Buzz |
| **Buzz** | GrowthMarketerAgent | 增长营销 | 引流：各渠道引流内容 + 链接（X / IG / YouTube / 小红书 / 知乎 / B 站） |
| **Vendy** | DigiVendAgent | 电商运营 | 成交：上架 / 定价执行 / 履约 / 售后纠纷 / 多平台铺货 / 对账 |
| **Echo** | DataAnalystAgent | 数据分析师 | 复盘：归因（决策→业绩）+ 分发建议 + 累积 playbook |
| **Kit** | ExecutiveAssistantAgent | 总经理助理 | 通用助手：用户的第一助理、团队多面手，几乎任何事务都接得住（不分组、直属用户；找单找岗接活归 Hopkins） |
| **Victor** | DayTradingAgent | 日内交易员 | 信号：港股 / 美股盘中盯盘 → 分析标的 + 计算仓位与止损 → 发出交易信号（信号模式，不下单，人工执行） |
| **Tinker** | PatchClaudeAgent | 补丁维护匠 | 维护：VSCode Claude Code 扩展升级后重新应用自定义补丁（自愈引擎：定位→应用→校验→回写），独立工具型 agent |
| **Prometheus** | CapabilityManagerAgent | 通用能力管家 | 底座：维护 `~/.pi/agent/` 通用能力（全局为权威源、`claude/` 为开源镜像；同步 skills / CLAUDE.md / docs / patch / hooks / pi 扩展 六部分，原 rules 三条已并入 CLAUDE.md）+ 通用能力开源单一出口（只有本项目镜像全局，其余 agent 项目不再分发副本）+ 团队注册表维护，独立于销售流水线 |
| **Mark** | QuantStrategistAgent | 量化策略师 | 量化策略：设计可回测的交易策略代码 → 历史回测标定可信度（离线开发，不盯盘不下单）；2026-10-17 由 Markowitz 更名为 Mark（取自现代投资组合理论之父 Harry Markowitz 的常用名） |
| **Hermes** | NetOpsAgent | 网络运维管理员 | 网络：代理节点真实流量测速与连通性检测 → 自动选路（纯延迟 / 纯带宽 / 混合）→ 故障转移 → 订阅刷新，基于 Xray-core（`xpilot` CLI），独立于销售流水线 |
| **Anvil** | BackendEngineerAgent | 后端开发工程师 | 后端：负责所有后端开发工作（服务端逻辑 / API / 数据库 / 系统架构 / 桥接服务），目前在手 CC-BRIDGE（Claude Code 上游桥接框架），独立于销售流水线 |
| **Atlas** | FullStackEngineerAgent | 全栈开发工程师 | 全栈：负责横跨前后端的完整开发（前端界面 / 后端服务 / 构建发布工程化），目前在手 ghostty-launcher、codef、pi、ghostty、mp4-player 等项目（详见下方映射表），独立于销售流水线 |
| **Ada** | NeuralCoreAgent | AI 算法工程师 | 算法：设计 / 迭代 / 评测深度推理引擎（目前在手 AgentCortex——Infinite / Rapid / Incisive 三套推理引擎规则 + 评测体系），独立于销售流水线 |
| **Alfred** | DeviceStewardAgent | 电脑管家 | 资源管理：本地电脑 / 远程服务器 / 云电脑的资源监控与管理建议（进程 / 内存 / 存储治理）→ 让设备始终处于低负载的流畅工作状态，独立于销售流水线 |
| **Hopkins** | ApplyOptimizerAgent | 投递转化率优化师 | 工作接单全链路（专门负责：找单找岗、投递、转化一条龙，原由 Kit 承接）——任务池投标与招聘平台求职（电鸭、BOSS直聘等）同为并行接单策略、同属一条投递漏斗：投递材料工程（接单的标书 + 求职的简历与打招呼话术，模板库 + 单变量 A/B 测试）、漏斗追踪（投递 → 回应 → 沟通 / 面试 → 成单 / offer）、转化率归因、报价与薪资策略测试、渠道淘汰（多渠道数据触发不凭感觉）；名字取自「科学广告之父」Claude Hopkins（简历即自我广告、话术即文案、漏斗归因即本行），直属用户、不属任何小组（工作接单，单人）；项目原名 BidOptimizerAgent |
| **Justin** | LegalAgent | 法务Agent | 法务：负责整个团队所有跟合同和收款相关的事项——合同起草审查、收款结构设计（分期付款）、交易对手尽调、证据链留存、纠纷应对、合规备忘；名字取自编纂《民法大全》的查士丁尼大帝，直属用户、不属任何小组（纯法务，跨组服务全部小组；财务职能暂时空缺） |
| **Gatsby** | SocialMediaManagerAgent | 社媒运营官 | 社媒矩阵：运营群主本人的社媒账号矩阵——YouTube（横向长视频 + 纵向中短视频）/ 小红书（图文 + 纵向中短视频）/ 公众号 / 小绿书（公众号贴图）/ 视频号（纵向中短视频）/ 微信社群 / 个人微信朋友圈；社群的运营理念与方法（群规迭代、新人欢迎流程、话题日历、内容整理、运营复盘）由 Gatsby 主导产出，群主为辅助、引导和执行角色（微信内一切操作由群主落地）；名字取自《了不起的盖茨比》的传奇派对主人 Jay Gatsby，不分组、直属用户（2026-10-14 由「社群运营官」升级为「社媒运营官」；项目名 2026-10-15 由 CommunityManagerAgent 更名为 SocialMediaManagerAgent） |
| **Hopper** | TestEngineerAgent | 软件测试工程师 | 测试：全团队软件项目的功能测试与回归防护网——需求转验收用例（用例先行）、存量项目从事故补回归用例（先红后绿）、用例库与 CI（GitHub Actions）维护、交付验收判定；持用例定义权，与开发 agent 的实现权、CI 的裁决权三权分立（开发 agent 禁改用例迁就实现）；名字取自史上第一个计算机 bug 的发现者、「debug」一词推广者 Grace Hopper，隶属基础设施小组 |
| **cuAgent** | cuAgent | 电脑操作员 | 计算机操作用户代理：用 computer-use 能力（GUI 自动化——看屏幕 / 点击 / 输入 / 拖拽）代替用户操作本机电脑界面；独立工具型 agent、不分组、直属用户，独立于销售流水线；能力仅限本项目内启用（2026-10-09 建立，远程仓库待建） |

## 销售流水线与三小组

销售流水线顺序：① Scout → ② Wright → ③ Mason → ④ Buzz → ⑤ Vendy → ⑥ Echo。整个团队按涉及领域分为三个小组：**数字产品销售小组**（六段流水线 Scout → Wright → Mason → Buzz → Vendy → Echo）、**投资与交易小组**（Mark 量化策略研发与回测标定，Victor 日内盯盘发信号）、**基础设施小组**（Tinker 给 CC 打补丁；Prometheus 开源全团队通用能力；Hermes 网络运维，为需要稳定代理连接的 agent 提供节点测速选路与故障转移；Anvil 纯服务端项目；Atlas 横跨前后端的完整项目及偏前端 / TUI / 客户端侧的工作——两者分工协作；Ada 负责全团队推理引擎的设计与评测，为所有 agent 的思考能力供底；Alfred 负责本地电脑 / 远程服务器 / 云电脑的资源管理与建议，让各设备始终处于低负载的流畅工作状态；Hopper 负责全团队软件项目的功能测试与回归防护网——用例先行 + CI 红灯门禁，把「改 A 坏 B」拦在合并进 main 之前）。**Kit（总经理助理）不分组、不属于任何小组**——用户的第一助理、团队多面手，几乎任何事务都接得住（工作接单整体归 Hopkins、合同收款归 Justin）。**Gatsby（社媒运营官，2026-10-14 由「社群运营官」升级）同样不分组、直属用户**——运营群主本人的社媒账号矩阵（YouTube / 小红书 / 公众号 / 小绿书 / 视频号 / 微信社群 / 个人微信朋友圈），理念方法由 Gatsby 出、执行由群主落地（微信内一切操作）；与 Buzz 的分工：Buzz 负责数字产品销售的渠道引流内容（X / IG / YouTube / 小红书 / 知乎 / B 站），Gatsby 负责群主本人账号的长期运营与私域阵地——平台有重叠、任务不同。**cuAgent（电脑操作员）不分组、直属用户**——computer-use 专用 agent：用 GUI 自动化代替用户操作本机电脑界面（看屏幕 / 点击 / 输入 / 拖拽），独立于销售流水线，能力仅限自己项目内启用。其中 Mason（建设期：建成交阵地 + 接支付）必须在 Buzz 之前就位，Buzz 的带货链接才有处可指；Vendy 在 Buzz 之后做运营期（接单 / 履约 / 售后 / 对账）——Mason 建、Vendy 营，接力同一阵地。每个 agent 的名称同时写在其项目 README 里。

## 新建 Agent 时自动维护注册表（免确认）

凡是新建一个 **Agent 项目**（即属于上方注册表范畴的团队 agent），**无需每次征得同意**，直接做两件事：

1. 把「名称 + 项目（仓库）+ 职称 Title + 主要职责」加进上方「智能体命名注册表」表格（名称先查重，全局不可重复；新建 agent 按命名规则起名——以 `Agent` 结尾、前缀尽可能简单）；
2. 在上方「销售流水线与三小组」段补上该 agent 的位置（在流水线内，还是独立于流水线）。

**为什么免确认**：新建一个 agent 项目本身就已明确要把它纳入团队；注册表是团队的元数据，追加新成员是建立该 agent 的固有一步，每次都问一遍是多余的反 confirm。

**授权边界（重要，防过度泛化）**：本条的免确认授权**仅限「向注册表追加新 agent 行 + 补一句位置说明」这一类编辑**，**不扩展**到全局 `~/.pi/agent/CLAUDE.md` 或本文件的其它任何修改——例如改语言偏好、git 规则、输出风格、脚手架约定，或对**已有** agent 行的重命名 / 调整职责 / 删除等，仍一律按「先征得同意」处理，不因本条规定而自动授权。改全局元规范默认要谨慎，只有「新建 agent 时追加注册表行」这一个窄口子放开。

## 智能体专属文件归属与子项目映射（2026-10-17 修订）

**智能体专属文件**指「会话启动时按工作目录加载、用于表征智能体身份 / 给智能体下指令」的项目级文件与目录，当前包括：`CLAUDE.md`、`AGENTS.md`、`AGENTS.override.md`、`.claude/`（Claude Code 项目级配置：CLAUDE.md / settings / rules / skills / memory 等）、项目级 `.pi/`（pi 项目级配置：skills / extensions / prompts / SYSTEM.md / settings 等）。

**归属规则（2026-10-17 用户修订，取代 2026-10-12 的「子项目一律不得存在」）**：

1. **实体只属于 Agent 项目**：这些文件的**实体副本（独立内容）只有 Agent 项目（团队 agent 项目，见上方注册表）允许拥有**；非 Agent 项目（含各 Agent 负责的子项目、以及其它任何非 Agent 项目）**不得放置实体副本、不得从 Agent 项目复制内容进去**——同一套机制只需一份权威来源。（历史「子项目 `.claude/` 超集」规则于 2026-10-12 废止，历史版本见本文件 git 历史。）
2. **子项目挂两条指回负责 Agent 的软链接（默认形态）**：每个子项目根目录带两条相对路径软链接，把负责 Agent 的规则与 pi 资源「引」进子项目目录：
   - `AGENTS.md → ../<负责Agent项目>/AGENTS.md`
   - `.pi → ../<负责Agent项目>/.pi`
   效果：**在子项目目录直接开会话时，会话按工作目录加载上下文文件与 `.pi` 资源，继承负责 Agent 的身份 / 规则 / 技能 / 扩展 / 设置**——即「Agent 进驻子项目」。机制已在 pi 上实测：上下文文件、技能、提示模板、项目级扩展、settings 均透过软链接从负责 Agent 项目加载；软链接嵌套（链指向链）同样有效。
3. **两条链接随仓库提交（2026-10-17 用户决定）**：仓库主要作为用户本人的备份，clone 者方便与否是次要因素；Agents 与子项目之间的关联是团队网络的组成部分（团队整体是一个大项目、GitHub 上只是分仓库存放，后续此类关联可能更多）——**看到仓库里的 `AGENTS.md` / `.pi` 软链接时，即表示它是「某 Agent 项目进驻该子项目」的关联链**，其目标是同级目录下的负责 Agent 项目；单独 clone 到别处时链接会悬空（无害，仅表现为缺省）。后续新增的其它跨仓库关联同样在文档里写明。
4. **后台开启 / 唤醒会话仍限定 Agent 项目根目录（2026-10-17 用户决定保留）**：凡通过 intercom / `agent_call` / `agent_wake` 等为某个 agent 开启（或唤醒）后台 pi 会话，工作目录只能是该 agent 的 **Agent 项目根目录**；不得以其子项目 / 任意非 Agent 项目目录开启（工具按注册表校验，子项目目录会被拒绝）。子项目的工作（读文件、跑命令、开发、提交）一律在 Agent 项目的会话里按路径跨目录操作（如 `git -C <子项目目录>`）。在子项目目录开会话是用户手动操作的场景（继承负责 Agent 身份），不走后台唤醒。
5. **`.claude/` 不纳入本网络（2026-10-17 用户决定）**：Claude Code 侧不再维护——子项目不挂 `.claude` 链接；各 Agent 项目里现有的 `.claude/` 内容暂留不动（不新增、不维护、不迁移）。
6. **存量清理口径**：子项目里除上述两条链接之外的智能体专属文件（实体副本、或指向其它位置的链接）一律清理；删除前先检查有无「不属于 agent 身份规则」的独有内容（子项目专属说明、上游开发指南、项目专属 skill 等）——有保留价值的先迁到负责的 Agent 项目里（或子项目的普通文档，如 README / docs），再删。各 Agent 项目「子项目清单」节的表述与本规同步（2026-10-17 起）。

- **为什么这样设计**：会话启动时，agent 规则文件按工作目录加载——pi 加载 `CLAUDE.md` / `AGENTS.md`（当前目录 + 逐级上级目录 + 全局 `~/.pi/agent/`）与工作目录下 `.pi/` 的项目级配置（技能 / 扩展 / 提示模板 / 设置）。直接用子项目目录开会话时看不到 agent 身份与规则；挂上两条软链接后，子项目目录开会话也能拿到完整身份，而规则的权威来源始终只有 Agent 项目一份。
- **工具强制**：pi 端扩展 `~/.pi/agent/extensions/agent-call.ts` 在自动唤醒前按本文件「子项目映射」表校验目标目录必须是已登记的 **Agent 项目**（子项目目录会被拒绝；2026-10-17 起由原「标记文件存在性检查」升级为注册表校验）；`~/.pi/agent/patch/settle-repo-check/settle-repo-check.py`（收尾巡检，由 pi 扩展调用）同样按下方「子项目映射」表定位子项目（cwd 为子项目目录时也能正确归属）。

**子项目映射（完整清单，权威）**：当前全部 Agent → 子项目对应关系如下表，新增 / 变更子项目时以此表为准，并同步更新对应 Agent 项目 `CLAUDE.md` 的「子项目清单」节，保持一致。表中每个子项目根目录都应带两条指回负责 Agent 的软链接（`AGENTS.md`、`.pi`，随仓库提交，见上方规则第 2、3 条）。

**宿主机归属（2026-10-17 用户立）**：**每个 Agent 只允许存在于一个宿主机**（其项目目录所在的机器，即其活跃工作位置的唯一性）；**迁移 = 转移而非双活**——迁移后原机器必须清理活跃副本（归档即可）。默认全部在本机（MacBook Air）；**已迁移到 macmini 的**：**Mark**（QuantStrategistAgent 及其子项目 Intraday / Swing / gridtrader，2026-10-17 整体迁移；本机已归档 `~/Archive-Migrated/`、不再保留活跃副本）。跨机呼叫已迁移 Agent 的方式见全局 CLAUDE.md「跨机协作」节。

| Agent 项目（拟人名） | 子项目（仓库） | 说明 |
|---|---|---|
| BackendEngineerAgent（Anvil） | CC-BRIDGE | Claude Code 上游桥接框架（Node.js） |
| FullStackEngineerAgent（Atlas） | ghostty-launcher | VSCode 状态栏一键唤起外部 Ghostty 终端的扩展（在跑激活已有窗口 / 未跑带工作区目录启动，零依赖、仅 macOS） |
| FullStackEngineerAgent（Atlas） | codef | 全屏打开 VSCode 的 CLI 小工具（code + 自动全屏 + 目标窗口置顶，bash + osascript、仅 macOS；开发目录 ~/Developer/codef，生产副本部署在 ~/.local/bin/，发版后安装、禁止软链） |
| FullStackEngineerAgent（Atlas） | pi | Pi agent harness 独立分叉仓库（TypeScript monorepo：coding agent CLI / agent 运行时 / 统一多供应商 LLM API / TUI 组件库），2026-09-19 起与原上游 earendil-works/pi 断开 fork 关系，自主维护演进 |
| FullStackEngineerAgent（Atlas） | ghostty | Ghostty 终端的独立分叉仓库（2026-09-20 起与原上游 ghostty-org/ghostty 断开 fork 关系、自主演进；当前为 v1.3.1 基线 + 「Cmd+V 粘贴剪贴板图片为临时文件路径」补丁，GitHub Actions 云构建） |
| FullStackEngineerAgent（Atlas） | mp4-player | VSCode 视频播放扩展（上游 Brodazz/mp4-player 的独立仓库：编辑器标签页内带音频播放视频，内置 ffmpeg WebAssembly 做音频解码与格式转码；2026-10-09 移交 Atlas，开发目录 ~/Developer/mp4-player） |
| ExecutiveAssistantAgent（Kit） | xhqing | 用户 GitHub 个人主页仓库 |
| ExecutiveAssistantAgent（Kit） | copybridge | macOS 剪贴板桥接工具（在 VSCode 资源管理器复制的文件可直接粘贴到 Finder / 微信 / 浏览器等系统任意 App：后台修复 VSCode 私有剪贴板格式；2026-10-08 建立、2026-10-09 登记） |
| ExecutiveAssistantAgent（Kit） | diff-bridge | pi「改动可视化」的 VSCode 侧助手扩展（配合全局 pi 扩展 diff-view（原名 ai-edit-diff，2026-10-18 改名）：按 pi 的 `/close-diff` 请求静默关闭由 pi 打开的 diff 标签；本地项目 `~/Developer/diff-bridge`，2026-10-18 建立、尚未开源） |
| NetOpsAgent（Hermes） | XPilot | Xray-core 节点管理 CLI（Python） |
| NeuralCoreAgent（Ada） | AgentCortex | 深度推理引擎规则集（三套推理引擎：Infinite / Rapid / Incisive） |
| QuantStrategistAgent（Mark） | Intraday | Mark 的日内尺度策略研究仓库（订单流 mbo 特征、分钟级 ML 信号、walk-forward 验证） |
| QuantStrategistAgent（Mark） | Swing | 日 K 趋势跟随策略工具集（美股大盘股，Python，完整文档 + 回测验证 + 可信度标定） |
| QuantStrategistAgent（Mark） | gridtrader | 网格交易策略开发及回测工具（Python / backtrader） |
| DayTradingAgent（Victor） | TradingProofs | 交易数学的 Lean 4 + Mathlib 机器可验证证明（从固定比例下注的累计收益率推导开始，覆盖强数定律指数增长率 / 凯利最优 f\* /「两倍凯利」边界；与实盘执行完全隔离，2026-10-11 立项） |
| SocialMediaManagerAgent（Gatsby） | xhs-mentor-scam | 小红书「陪跑 / 带教」反诈视频项目材料（私人仓库；独立 git 仓库位于 `~/Developer/xhs-mentor-scam`，绑定 GitHub 私有远程持续备份、launchd 自动提交推送；2026-10-13 由 Kit 设立、2026-10-15 移交 Gatsby 负责） |

- **已取消 / 已退役的子项目（不再维护）**：GitComic、agent-team-playbook-src（Wright）；zcode-cli、zcode-vsce、cmux-launcher（Atlas）；channels-watch（Atlas，2026-10-17 退役）；ResourceMonitor（Alfred）；CyberRipple、blog（Kit）——本地项目资料删除，GitHub 远端仓库保留为存档（CyberRipple 原未建远端仓库，其组织总览内容已并入 `xhqing` 主页 README）。

- **子项目清单**：由各 Agent 项目在自己的 `CLAUDE.md`（pi 侧经 `AGENTS.md` 软链接读取）中维护（须与上方「子项目映射」表保持一致）。新增 / 变更子项目时，同步更新映射表与对应 Agent 项目的「子项目清单」节。
- **边界**：本规则适用于「Agent 项目负责子项目」的情形；当前全部映射见上方「子项目映射」表。
