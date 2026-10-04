# 新建 Agent 项目脚手架与开源约定

> 本文件由全局 `~/.claude/CLAUDE.md`「团队结构参考」指针节指向。**何时读**：新建 Agent 项目（含带拟人名的团队 agent）前必读，保证团队一致、开源安全。权威源在全局 `~/.claude/docs/`，开源镜像在 CapabilityManagerAgent 仓库 `claude/docs/`。

**为什么**：agent 越来越多，统一脚手架避免重造轮子、避免泄露密钥。**怎么用**：复制已有 agent 项目（如 FullStackEngineerAgent）再按角色改写。

## 通用能力开源单一出口

**新建 Agent 项目一律不放与全局通用能力重复的内容**——`~/.claude/skills/` 里的通用 skill（如 anysearch）不再复制进各 agent 项目的 `.claude/`。通用能力的开源分发统一经 **CapabilityManagerAgent（Prometheus）的 `claude/` 镜像**（`skills/`、`CLAUDE.md`、`docs/`、`hooks/`、`patch/`、`pi/agent/extensions/` 六部分）一次性完成——clone 该项目即得全部通用能力；各 agent 项目只放自己独有的内容（新建项目一律不建 `.claude/` 目录，见下）。

- **为什么**：全局 `~/.claude/` 是运行时实际加载的「活」源头；每个项目放一份副本意味着通用能力一改动就要同步到所有项目，副本容易过期分叉（新建 NetOpsAgent 时即发现 anysearch `runtime.conf` 副本与全局不一致、find-skill 副本多出 `.env.example`）。统一单一出口后，全局改一处、镜像同步一处，各项目零维护。
- **边界**：单一出口模式已全量落地——各 agent 项目的 anysearch 等通用 skill 副本已全部清除（2026-09-13 核验，`~/Developer/*/.claude/skills/` 下无任何 anysearch 副本），「既有项目副本」这层维护已终结，不再存在项目间分发。

## 脚手架清单

- **AutoMemory 全局已禁用**（`~/.claude/settings.json` 设 `autoMemoryEnabled: false`）：新建项目**不配 AutoMemory**（不建 `.claude/memory/`、不填 `autoMemoryDirectory`、`.gitignore` 不挂 memory 条目）。知识沉淀走 rules/skills（强约束规范）+ CLAUDE.md，不依赖 AutoMemory 自动记。
- **目录名** = `XxxAgent`（职称 Title + Agent，PascalCase），对齐 DigiVendAgent。
- **不建 `.claude/` 目录**：新建项目**一律不建 `.claude/` 目录**，旧规定要求照建的 `.claude/` 下文件（`settings.json`、`settings.local.json`、`settings.local.example.json`，以及角色专属 skills / rules 等）**一律都不要**；通用能力经 CapabilityManagerAgent `claude/` 镜像统一开源（见上「通用能力开源单一出口」节），项目内不留任何副本。项目根只建脚手架清单内的根目录文件（如 `LICENSE.md`（MIT））。
- **角色化 `CLAUDE.md` 直接放项目根目录**（你是谁 / 产物契约 / 工具 / 约束 / 流水线位置，不放 `.claude/` 下）；**建项目根 `CLAUDE.md` 的同时，在项目根建一条软链接 `AGENTS.md` 指向它**（`ln -s CLAUDE.md AGENTS.md`，两文件内容天然同步，兼容只认 `AGENTS.md` 的 agent 工具）+ **中英双语 `README.md`**（含拟人名 + topics）。README 顶部必须有 **logo**（`assets/logo.svg`，统一模板：640×200 渐变色卡 + 角色 emoji + 名字 + 职称，配色按角色区分）+ **标准徽章**（shields.io：**License / Version / Type** 三枚是必须含有的底线——License 标开源许可证（如 MIT）、Version 标项目版本号（取自 VERSION 文件）、Type 标项目类型（如 AI Agent）；**不含** Forks，也不含 Stars / Last Commit 等 GitHub 动态数值 / 时间徽章；另**不含**点明 LLM / 厂商的徽章，如 "Built with Claude Code"）。logo 的视觉规范（英文文字、拟人头像 vs 项目象征）见 icon-design skill。
- **访问量徽章（Visitors，团队仓库专用例外）**：团队各仓库（agent 主仓库及其子项目）的 README 在标准三枚之外**另挂一枚 Visitors 徽章**——shields.io endpoint 形式，URL 指向 `xhqing/xhqing` 仓库的 `traffic/badges/<repo>.json`（如 `https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/xhqing/xhqing/main/traffic/badges/DayTradingAgent.json`），徽章名 `Visitors`（badge JSON 的 `label` 字段为 `Visits/day`，即该徽章展示的是日均访问量）。数据由 xhqing 仓库的集中式采集（`scripts/update_traffic.py` + 每日 GitHub Action，secret `FLEET_TRAFFIC_PAT`）从官方 Traffic API 按日拉取、按日去重累计。**为什么允许这枚「动态徽章」**：它不是 shields.io 从 GitHub 实时抓取的动态数值徽章，而是指向本仓库静态 JSON 的 endpoint 徽章，与「不含动态徽章」规矩不冲突；且这是团队统一部署的去重访问统计，属有意为之的例外。**边界**：只豁免这一种 URL 形态（指向 `xhqing/xhqing` 的 `traffic/badges/` 下 JSON 的 endpoint 徽章）；komarev / seeyoufarm 等第三方计数图片、以及其它任何动态徽章仍不挂。
- **徽章英文首字母必须大写**：README 里所有徽章上的英文文字——静态 badge 的 label（如 `License`、`Version`、`Type`）与 message、endpoint 徽章 JSON 里的 `label` 字段、以及徽章 `<img>` 的 `alt` 文本——凡英文，**首字母一律大写**（如 `License-MIT`、`Visits/day`、`Mode-Signal`）。**为什么**：小写首字母在徽章墙上观感不一致、显得随意，与团队统一的专业视觉风格不符；首字母大写是英文标识词的标准书写规范。**怎么用**：新写徽章时直接按首字母大写书写；既有小写存量，接触一处改一处（顺手改，不必专门一次性返工）。**边界**：本条管「徽章上显示的英文文字」；URL 路径、仓库目录名等非显示内容不管；单词内部字母（如 `AI Agent` 的 `AI`、`iOS`）按该词本身的规范书写，不因本条改动。
- **`.gitignore` 必含**：`.env`/`.env.*`（留 `.env.example`）、`settings.local.json`、`tmp/`、`docs/`（运行时数据）、`artifacts/`（**可售卖成品，绝不公开**）、`node_modules/`、`.DS_Store`、`__pycache__/`。
- **开源到 GitHub**：`gh repo create XxxAgent --public --source=. --remote=origin --push` → 设 About + topics（`gh repo edit --description "<English summary> | <简体中文摘要>" --add-topic a --add-topic b ...`——description 用**中英双语**，英文部分以美式英文为主（特殊场景可用任何语言）、中文部分以简体中文为主（特殊场景可用任何语言）；**多个 `--add-topic` 写字面量、勿用 shell 变量拼接**，否则报 `accepts at most 1 arg(s)`）→ FUNDING.yml **只放一份在 `xhqing/.github` 仓库**（`github: xhqing`），作为所有仓库的默认 Sponsor 配置；**不要在每个 agent 项目里放 `.github/`**——赞助配置不是项目主体内容。别用 `repos/.../funding` API 验证（不公开返回）。

## 中英双语 README 内容自动同步

凡项目同时存在中英双版 README（常见形态：英文 `README.md` + 中文 `README_cn.md`，以项目实际双版文件名为准），**两版内容必须时刻保持同步**：每次改动其中任何一版的**内容**（措辞、信息、列举项、口径、数字、结构），都必须在**同一轮改动里自动同步另一版**，**不需要问用户「要不要同步」**。

- **中文版为权威方向**：用户用中文打磨措辞，英文版跟随同步；用户直接改英文版的情况同理反向同步中文版。
- **为什么**：双语 README 是同一内容的两种语言表达，只改一版会让两版信息不一致，读者看到过期或矛盾的另一半；每次询问「要不要同步」是多余的反 confirm——同步是内容改动的固有部分，不是可选步骤。
- **怎么用**：改中文版某句 → 同一轮顺带改英文版对应句；改英文版 → 同步中文版。英文按英文习惯表达，**不必逐字直译**，但**语义内容必须对齐**——信息点、列举项、口径、数字一处不能少、不能多、不能变。语言固有差异允许：语序、地道表达按各自语言规范来（如中文「如……等」的非穷尽语义，英文 "such as" 一词已含，不必再叠 "etc."）。
- **边界**：本条管「内容」同步；两版**语言特有**的内容（如各自的语言切换链接——英文版跳中文版的链接文字统一为「简体中文」）不算内容差异，不受影响。仓库只有单语 README 的，本条不适用。
