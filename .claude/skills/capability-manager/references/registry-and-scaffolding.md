# fleet 注册表与新项目脚手架（场景 C 详细流程）

本文件是 SKILL.md「场景 C」的详细展开。覆盖给 fleet 新增 agent（起名 + 入注册表）、搭新 agent 项目脚手架、开源到 GitHub 的全流程。规则细节见全局 `~/.claude/CLAUDE.md` 的「智能体命名注册表」「新建带拟人名的 Agent 时自动维护注册表」「新建 Agent 项目的脚手架与开源约定」三节——本文件把它们编排成可执行步骤。

## 任务一：给 fleet 新增一个 agent（起名 + 入表）

### 1. 起拟人名（查重 + 语义）

- **查重**：先读全局 `~/.claude/CLAUDE.md` 的「智能体命名注册表」表格，新名**全局不可重复**。现有名字（截至 2026-08）：Scout、Wright、Mason、Buzz、Vendy、Echo、Kit、Victor、Tinker、Prometheus、Markowitz。首字母尽量错开以利辨识。
- **语义**：名字要**蕴含该 agent 的主要能力**（双关优先——如制造生产类取 Wright「制造匠」、修补维护类取 Tinker「修补匠」、能力管家取 Prometheus「盗火者」）。避免直白工具名（如 Patcher）。
- **与用户确认名字**：起名是语义判断，把候选名 + 由来写进汇报让用户拍板。

### 2. 追加进注册表（免确认）

名字定了就**直接**改全局 `~/.claude/CLAUDE.md` 的注册表（这步本身免确认，CLAUDE.md「新建带拟人名的 Agent 时自动维护注册表」节）：

- 在表格末尾加一行：
  ```
  | **<名字>** | <项目目录名，如 XxxAgent> | <职称 Title> | <主要职责一句话> |
  ```
- 在表格下方「销售流水线顺序」段补该 agent 的位置：在流水线内（① Scout → ② Wright → …）还是独立于流水线。

**授权边界**：免确认**仅限**「追加新 agent 行 + 补位置说明」。改已有 agent 行 / 改语言偏好 / 改 git 规则等其它编辑仍要先征得用户同意。

### 3. 镜像本项目 claude/ + 验证

```bash
AUTH=~/Documents/Projects/CapabilityManagerAgent
cp ~/.claude/CLAUDE.md "$AUTH/claude/CLAUDE.md"
diff ~/.claude/CLAUDE.md "$AUTH/claude/CLAUDE.md" && echo "✅ 一致"
```

注册表改动只动 CLAUDE.md，不涉及 skills/rules，无需分发到各项目。

## 任务二：搭新 agent 项目脚手架

确认了名字与角色后，搭项目骨架。**推荐做法：复制一个相近的已有 agent 项目再按角色改写**（比从零搭省事、且保证 fleet 一致）。

### 1. 建项目目录 + git init

```bash
cd ~/Documents/Projects
mkdir XxxAgent && cd XxxAgent
git init   # 免确认（CLAUDE.md「新建项目 git init 免确认」）
```

目录名 = `XxxAgent`（职称 Title + Agent，PascalCase），对齐 DigiVendAgent。

### 2. 复制通用底座（从已有 agent 项目）

从相近项目（如 DigiVendAgent）复制下列内容到新项目 `.claude/`：

- **skills**：`anysearch`、`find-skill`（**复制后删 `find-skill/.env` 和 `cache/`**——密钥与本机数据不带走）。
- **commands**：`install-skill.md`。
- **rules**：通用三件套 `file-operation-priority-rules` / `tmp-dir` / `verify-before-report`；**销售流水线 agent 再加** `available-channels` / `passive-income-only`。
- **settings.json**：原样复用（hooks 默认空）。
- **settings.local.json**：新建，本机配置**不入库**；同时建 `settings.local.example.json` 作**入库模板**供 clone 者照抄。
- **LICENSE.md**：MIT。

**AutoMemory 全局已禁用**：不建 `.claude/memory/`、不填 `autoMemoryDirectory`、`.gitignore` 不挂 memory。

### 3. 写角色化文档

- **CLAUDE.md**：角色化——你是谁（拟人名 + 职责）/ 产物契约 / 工具 / 约束 / 流水线位置。
- **README.md（英文）+ README_cn.md（中文）**：含拟人名 + topics；顶部 logo（`assets/logo.svg`，统一模板 640×200 渐变色卡 + 角色 emoji + 名字 + 职称）+ 标准徽章（shields.io：License MIT / Last Commit / AI Agent；**不含**点明 LLM / 厂商的徽章如 "Built with Claude Code"，**不含** GitHub Stars 数量徽章）。
- 详见 commit skill 第 9 步的 README 标配细则（logo 配色、徽章组合、版权署名归一为 All Contributors 等）——首次 `/commit` 会自动补齐缺失项。

### 4. 配 .gitignore

必含：`.env` / `.env.*`（留 `.env.example`）、`find-skill/.env` 与 `cache/`、`settings.local.json`、`tmp/`、`docs/`（运行时数据）、`artifacts/`（**可售卖成品，绝不公开**）、`node_modules/`、`.DS_Store`、`__pycache__/`。

### 5. 角色专属 skill（按需）

如该 agent 有专属能力（Scout 加 hot-trend、Victor 加 trade、Mason 加 site-builder），按 skill-creator 方法论新建，放该项目的 `.claude/skills/`（专属 skill 不回传全局、不分发其它项目）。

## 任务三：开源到 GitHub

**注意**：开源涉及的 `gh repo create`（建远程）+ push 属 git 写操作。建远程仓库要**先征得用户同意**（列命令等确认）；`git init` 已在任务二免确认完成。用户的「开源到 GitHub」大方向指令**不等于**直接授权建远程——仍要逐次确认。

确认后步骤：

```bash
cd ~/Documents/Projects/XxxAgent
# 1. 建公开仓库 + 设 origin + push（一条命令）
gh repo create XxxAgent --public --source=. --remote=origin --push

# 2. 设 About：中英双语 description + topics
gh repo edit --description "<English summary> | <简体中文摘要>" \
  --add-topic ai-agent --add-topic <topic2> ...
# 多个 --add-topic 写字面量，勿用 shell 变量拼接（否则报 accepts at most 1 arg(s)）
```

- **description 中英双语**：英文部分以美式英文为主、中文部分以简体中文为主，用 ` | ` 分隔，总长 < 350 字符。
- **FUNDING.yml**：**只放一份**在 `xhqing/.github` 仓库（内容 `github: xhqing`），作为所有仓库的默认 Sponsor 配置。**不要**在每个 agent 项目里放 `.github/`。

## 完成后的闭环

- **记 CHANGELOG**（本 CapabilityManagerAgent 项目的）：若本次任务改了全局 CLAUDE.md 注册表（并镜像到 `claude/`）、或新增了通用 skill，记一条。
- **新 agent 项目自己的 CHANGELOG**：新项目的变更记它**自己**的 CHANGELOG（各项目独立），不混进本项目。
- **提示用户后续**：新项目内容改完后，由用户自行 `git add` + `/commit` 提交（本 skill 不动暂存区）。
