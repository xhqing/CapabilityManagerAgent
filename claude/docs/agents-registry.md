# 智能体命名注册表与团队结构

> 本文件由全局 `~/.claude/CLAUDE.md`「团队结构参考」指针节指向。**何时读**：新建 Agent 项目前（名称查重）、判断某子任务该移交给哪个 agent 时、新增 / 变更 Agent 或子项目的注册信息时。权威源在全局 `~/.claude/docs/`，开源镜像在 CapabilityManagerAgent 仓库 `claude/docs/`。

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
| **Prometheus** | CapabilityManagerAgent | 通用能力管家 | 底座：维护 `~/.claude/` 通用能力（全局为权威源、`claude/` 为开源镜像；同步 skills / CLAUDE.md / docs / hooks / patch / pi 扩展 六部分，原 rules 三条已并入 CLAUDE.md）+ 通用能力开源单一出口（只有本项目镜像全局，其余 agent 项目不再分发副本）+ 团队注册表维护，独立于销售流水线 |
| **Markowitz** | QuantStrategistAgent | 量化策略师 | 量化策略：设计可回测的交易策略代码 → 历史回测标定可信度（离线开发，不盯盘不下单） |
| **Hermes** | NetOpsAgent | 网络运维管理员 | 网络：代理节点真实流量测速与连通性检测 → 自动选路（纯延迟 / 纯带宽 / 混合）→ 故障转移 → 订阅刷新，基于 Xray-core（`xpilot` CLI），独立于销售流水线 |
| **Anvil** | BackendEngineerAgent | 后端开发工程师 | 后端：负责所有后端开发工作（服务端逻辑 / API / 数据库 / 系统架构 / 桥接服务），目前在手 CC-BRIDGE（Claude Code 上游桥接框架），独立于销售流水线 |
| **Atlas** | FullStackEngineerAgent | 全栈开发工程师 | 全栈：负责横跨前后端的完整开发（前端界面 / 后端服务 / 构建发布工程化），目前在手 zcode-cli、zcode-vsce、ghostty-launcher、cmux-launcher、pi、ghostty 等项目（详见下方映射表），独立于销售流水线 |
| **Ada** | NeuralCoreAgent | AI 算法工程师 | 算法：设计 / 迭代 / 评测深度推理引擎（目前在手 AgentCortex——Infinite / Rapid / Incisive 三套推理引擎规则 + 评测体系），独立于销售流水线 |
| **Alfred** | DeviceStewardAgent | 电脑管家 | 资源管理：本地电脑 / 远程服务器 / 云电脑的资源监控与管理建议（进程 / 内存 / 存储治理）→ 让设备始终处于低负载的流畅工作状态，独立于销售流水线 |
| **Hopkins** | ApplyOptimizerAgent | 投递转化率优化师 | 工作接单全链路（专门负责：找单找岗、投递、转化一条龙，原由 Kit 承接）——任务池投标与招聘平台求职（电鸭、BOSS直聘等）同为并行接单策略、同属一条投递漏斗：投递材料工程（接单的标书 + 求职的简历与打招呼话术，模板库 + 单变量 A/B 测试）、漏斗追踪（投递 → 回应 → 沟通 / 面试 → 成单 / offer）、转化率归因、报价与薪资策略测试、渠道淘汰（多渠道数据触发不凭感觉）；名字取自「科学广告之父」Claude Hopkins（简历即自我广告、话术即文案、漏斗归因即本行），直属用户、不属任何小组（工作接单，单人）；项目原名 BidOptimizerAgent |
| **Justin** | LegalAgent | 法务Agent | 法务：负责整个团队所有跟合同和收款相关的事项——合同起草审查、收款结构设计（分期付款）、交易对手尽调、证据链留存、纠纷应对、合规备忘；名字取自编纂《民法大全》的查士丁尼大帝，直属用户、不属任何小组（纯法务，跨组服务全部小组；财务职能暂时空缺） |
| **Gatsby** | CommunityManagerAgent | 社群运营官 | 社群：运营用户的微信社群「AI前沿跨界交流群」——运营理念与方法（群规迭代、新人欢迎流程、话题日历、内容整理、运营复盘）由 Gatsby 主导产出，群主为辅助、引导和执行角色（微信内一切操作由群主落地）；名字取自《了不起的盖茨比》的传奇派对主人 Jay Gatsby，不分组、直属用户 |
| **Hopper** | TestEngineerAgent | 软件测试工程师 | 测试：全团队软件项目的功能测试与回归防护网——需求转验收用例（用例先行）、存量项目从事故补回归用例（先红后绿）、用例库与 CI（GitHub Actions）维护、交付验收判定；持用例定义权，与开发 agent 的实现权、CI 的裁决权三权分立（开发 agent 禁改用例迁就实现）；名字取自史上第一个计算机 bug 的发现者、「debug」一词推广者 Grace Hopper，隶属基础设施小组 |
| **cuAgent** | cuAgent | 电脑操作员 | 计算机操作用户代理：用 computer-use 能力（GUI 自动化——看屏幕 / 点击 / 输入 / 拖拽）代替用户操作本机电脑界面；独立工具型 agent、不分组、直属用户，独立于销售流水线；能力仅限本项目内启用（2026-10-09 建立，远程仓库待建） |

## 销售流水线与三小组

销售流水线顺序：① Scout → ② Wright → ③ Mason → ④ Buzz → ⑤ Vendy → ⑥ Echo。整个团队按涉及领域分为三个小组：**数字产品销售小组**（六段流水线 Scout → Wright → Mason → Buzz → Vendy → Echo）、**投资与交易小组**（Markowitz 量化策略研发与回测标定，Victor 日内盯盘发信号）、**基础设施小组**（Tinker 给 CC 打补丁；Prometheus 开源全团队通用能力；Hermes 网络运维，为需要稳定代理连接的 agent 提供节点测速选路与故障转移；Anvil 纯服务端项目；Atlas 横跨前后端的完整项目及偏前端 / TUI / 客户端侧的工作——两者分工协作；Ada 负责全团队推理引擎的设计与评测，为所有 agent 的思考能力供底；Alfred 负责本地电脑 / 远程服务器 / 云电脑的资源管理与建议，让各设备始终处于低负载的流畅工作状态；Hopper 负责全团队软件项目的功能测试与回归防护网——用例先行 + CI 红灯门禁，把「改 A 坏 B」拦在合并进 main 之前）。**Kit（总经理助理）不分组、不属于任何小组**——用户的第一助理、团队多面手，几乎任何事务都接得住（工作接单整体归 Hopkins、合同收款归 Justin）。**Gatsby（社群运营官）同样不分组、直属用户**——运营用户自己的微信社群（私域阵地），理念方法由 Gatsby 出、群主执行；公域渠道投放仍归 Buzz（Gatsby 只做私域社群，不越界到公域）。**cuAgent（电脑操作员）不分组、直属用户**——computer-use 专用 agent：用 GUI 自动化代替用户操作本机电脑界面（看屏幕 / 点击 / 输入 / 拖拽），独立于销售流水线，能力仅限自己项目内启用。其中 Mason（建设期：建成交阵地 + 接支付）必须在 Buzz 之前就位，Buzz 的带货链接才有处可指；Vendy 在 Buzz 之后做运营期（接单 / 履约 / 售后 / 对账）——Mason 建、Vendy 营，接力同一阵地。每个 agent 的名称同时写在其项目 README 里。

## 新建 Agent 时自动维护注册表（免确认）

凡是新建一个 **Agent 项目**（即属于上方注册表范畴的团队 agent），**无需每次征得同意**，直接做两件事：

1. 把「名称 + 项目（仓库）+ 职称 Title + 主要职责」加进上方「智能体命名注册表」表格（名称先查重，全局不可重复；新建 agent 按命名规则起名——以 `Agent` 结尾、前缀尽可能简单）；
2. 在上方「销售流水线与三小组」段补上该 agent 的位置（在流水线内，还是独立于流水线）。

**为什么免确认**：新建一个 agent 项目本身就已明确要把它纳入团队；注册表是团队的元数据，追加新成员是建立该 agent 的固有一步，每次都问一遍是多余的反 confirm。

**授权边界（重要，防过度泛化）**：本条的免确认授权**仅限「向注册表追加新 agent 行 + 补一句位置说明」这一类编辑**，**不扩展**到全局 `~/.claude/CLAUDE.md` 或本文件的其它任何修改——例如改语言偏好、git 规则、输出风格、脚手架约定，或对**已有** agent 行的重命名 / 调整职责 / 删除等，仍一律按「先征得同意」处理，不因本条规定而自动授权。改全局元规范默认要谨慎，只有「新建 agent 时追加注册表行」这一个窄口子放开。

## Agent 项目与子项目的 `.claude/` 超集关系

**Agent 项目**（团队 agent，见上方注册表）若负责维护**子项目**（用户的后端项目等由该 Agent 负责的项目），两者 `.claude/` 目录之间维护**超集关系**：**Agent 项目 `.claude/` 是权威源，子项目 `.claude/` 是它的超集**——Agent 项目 `.claude/` 下除 `CLAUDE.md` 外的每个文件，在子项目 `.claude/` 下都必须存在且逐字节一致；`CLAUDE.md` 的**内容**同样新增到子项目（实现方式不限、效果等价即可，见下）。子项目 `.claude/` 下 Agent 项目没有的内容（如 CC-BRIDGE 的 `rules/cc-bridge-install.md`、子项目原有的 `CLAUDE.md` 内容）**保留不动**（超集只增不减）。目的是保证用户只操作子项目时，子项目的 `.claude/` 也包含 Agent 项目的完整内容，体现该项目归该 Agent 负责。

**超集关系映射（完整清单，权威）**：当前全部 Agent → 子项目超集映射如下表，新增 / 变更子项目时以此表为准，并同步更新对应 Agent 项目 `.claude/CLAUDE.md` 的「子项目清单」节，保持一致。

| Agent 项目（拟人名） | 子项目（仓库） | 说明 |
|---|---|---|
| BackendEngineerAgent（Anvil） | CC-BRIDGE | Claude Code 上游桥接框架（Node.js） |
| FullStackEngineerAgent（Atlas） | zcode-cli | 非官方 ZCode 终端客户端（Node.js / TypeScript，TUI）；2026-10-09 起短期搁置（用户决定暂不维护，本地开发目录已删除） |
| FullStackEngineerAgent（Atlas） | zcode-vsce | 非官方 ZCode VSCode 扩展客户端（与 zcode-cli 平行的姊妹项目：同一官方 runtime、`app-server` 协议、webview 前端） |
| FullStackEngineerAgent（Atlas） | ghostty-launcher | VSCode 状态栏一键唤起外部 Ghostty 终端的扩展（在跑激活已有窗口 / 未跑带工作区目录启动，零依赖、仅 macOS） |
| FullStackEngineerAgent（Atlas） | cmux-launcher | VSCode 扩展：一键唤起外部 CMux 终端（状态栏 + 主侧边栏 / 副侧边栏 / 底部面板 / 编辑器区四处窗口面板，通过 CMux 自带 CLI 通信，零依赖、仅 macOS，ghostty-launcher 的姊妹项目）；2026-10-09 起短期搁置（用户决定暂不维护，本地开发目录已归档） |
| FullStackEngineerAgent（Atlas） | codef | 全屏打开 VSCode 的 CLI 小工具（code + 自动全屏 + 目标窗口置顶，bash + osascript、仅 macOS；开发目录 ~/Developer/codef，生产副本部署在 ~/.local/bin/，发版后安装、禁止软链） |
| FullStackEngineerAgent（Atlas） | pi | Pi agent harness 独立分叉仓库（TypeScript monorepo：coding agent CLI / agent 运行时 / 统一多供应商 LLM API / TUI 组件库），2026-09-19 起与原上游 earendil-works/pi 断开 fork 关系，自主维护演进 |
| FullStackEngineerAgent（Atlas） | ghostty | Ghostty 终端的独立分叉仓库（2026-09-20 起与原上游 ghostty-org/ghostty 断开 fork 关系、自主演进；当前为 v1.3.1 基线 + 「Cmd+V 粘贴剪贴板图片为临时文件路径」补丁，GitHub Actions 云构建） |
| FullStackEngineerAgent（Atlas） | channels-watch | 视频号私信只读监控（Python + Playwright：监控视频号助手私信页的「打招呼消息 / 私信」，新消息推送飞书 / ntfy / Server酱，launchd 每 5 分钟一轮；2026-10-09 立项开源） |
| FullStackEngineerAgent（Atlas） | mp4-player | VSCode 视频播放扩展（上游 Brodazz/mp4-player 的独立仓库：编辑器标签页内带音频播放视频，内置 ffmpeg WebAssembly 做音频解码与格式转码；2026-10-09 移交 Atlas，开发目录 ~/Developer/mp4-player） |
| ExecutiveAssistantAgent（Kit） | xhqing | 用户 GitHub 个人主页仓库 |
| ExecutiveAssistantAgent（Kit） | CyberRipple | 组织总览仓库（AI Agent 团队总览 README 中英双语；交由 Kit 负责，远程仓库待建） |
| ExecutiveAssistantAgent（Kit） | blog | 个人博客仓库（docsify 静态博客，github.com/xhqing/blog，线上 xhqing.github.io/blog） |
| ExecutiveAssistantAgent（Kit） | copybridge | macOS 剪贴板桥接工具（在 VSCode 资源管理器复制的文件可直接粘贴到 Finder / 微信 / 浏览器等系统任意 App：后台修复 VSCode 私有剪贴板格式；2026-10-08 建立、2026-10-09 登记） |
| NetOpsAgent（Hermes） | XPilot | Xray-core 节点管理 CLI（Python） |
| NeuralCoreAgent（Ada） | AgentCortex | 深度推理引擎规则集（三套推理引擎：Infinite / Rapid / Incisive） |
| DeviceStewardAgent（Alfred） | ResourceMonitor | 整机资源监控 + AI 清理建议的 VSCode 扩展（TypeScript） |
| QuantStrategistAgent（Markowitz） | Intraday | Markowitz 的日内尺度策略研究仓库（订单流 mbo 特征、分钟级 ML 信号、walk-forward 验证；quant skill 位于其 `.claude/skills/quant/`） |
| QuantStrategistAgent（Markowitz） | Swing | 日 K 趋势跟随策略工具集（美股大盘股，Python，完整文档 + 回测验证 + 可信度标定） |
| QuantStrategistAgent（Markowitz） | gridtrader | 网格交易策略开发及回测工具（Python / backtrader） |
| ProductProducerAgent（Wright） | GitComic | Git 漫画书产品线仓库（试读 PDF + 引流图卡，en/zh 双语，后续全本迭代在该仓进行；制作资产与交付物在本机被忽略的 artifacts/） |
| ProductProducerAgent（Wright） | agent-team-playbook-src | The Agent Team Playbook 产品私有源仓库（en/zh 源树 + spec；付费内容不公开，tag + gh release 附分语言 zip 管版本；与公开落地页仓 agent-team-playbook 区分——那是 Mason 的 GitHub Pages 部署仓） |
| DayTradingAgent（Victor） | TradingProofs | 交易数学的 Lean 4 + Mathlib 机器可验证证明（从固定比例下注的累计收益率推导开始，覆盖强数定律指数增长率 / 凯利最优 f\* /「两倍凯利」边界；与实盘执行完全隔离，2026-10-11 立项；按 2026-10-09 新式脚手架不建 `.claude/`，超集以 CLAUDE.md 全文随附落地） |

- **触发**：Agent 项目 `.claude/` 下任何内容变更（新增 / 修改 / 删除文件）后，**自动同步**到其所有子项目，无需询问；删除的文件同步删除子项目中的对应文件。
- **子项目清单**：由各 Agent 项目在自己的 `.claude/CLAUDE.md` 中维护（须与上方「超集关系映射」表保持一致）。新增 / 变更子项目时，同步更新映射表与对应 Agent 项目的「子项目清单」节。
- **`CLAUDE.md` 内容同样超集（实现方式不限，效果等价即可）**：Agent 项目 `CLAUDE.md` 的**内容**也必须完整进入子项目（子项目会话中能加载 / 看到 Agent 的全部规则），但**不要求逐字节一致、不要求放在同名文件**。**做法是「新增」而不是「覆盖」**：子项目原有的 `CLAUDE.md` 内容**保持不变**，把 Agent 项目 `CLAUDE.md` 的内容**新增**进去——最简单的做法是**直接把 Agent 项目 `CLAUDE.md` 的内容加进子项目的 `CLAUDE.md`**（Agent 内容置于子项目原有内容之前或之后均可）；也可以放到子项目 `rules/` 下新建的 rule 文件、再在子项目 CLAUDE.md 里加 `@` 引用（效果等价）。无论哪种方式，建议带一句指代说明（如「以下为 BackendEngineerAgent（Anvil）CLAUDE.md 全文，其中『本项目』均指 BackendEngineerAgent」），避免内容在子项目语境下指代混淆。**两者内容放到一起后不能有逻辑冲突**（如身份矛盾、规则打架、职责冲突）；若发现逻辑冲突，**以子项目原有的内容为准**，且**必须向用户汇报冲突内容**（冲突双方各是什么、按子项目为准的处理结果）。Agent 项目 `CLAUDE.md` 内容更新时，同步新增 / 更新子项目对应内容，子项目原有内容始终保留不动。
- **验证**：同步后用 `diff` 核对，确认子项目 `.claude/` 仍为 Agent 项目 `.claude/` 的超集。
- **记录**：源变更记 Agent 项目自己的 CHANGELOG；同步动作本身不重复记子项目 CHANGELOG。
- **敏感信息**：`settings.local.json` 等本机配置同样同步；若子项目 `.gitignore` 缺少对应忽略规则，同步时一并补上。
- **边界**：本规则适用于「Agent 项目负责子项目」的情形；当前全部映射见上方「超集关系映射」表。
