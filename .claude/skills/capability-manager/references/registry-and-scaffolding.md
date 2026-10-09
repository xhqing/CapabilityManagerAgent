# 团队注册表与新项目脚手架（场景 C 详细流程）

本文件是 SKILL.md「场景 C」的详细展开。覆盖给团队新增 agent（定名 + 入注册表）、搭新 agent 项目脚手架、开源到 GitHub 的全流程。规则细节见全局 `~/.claude/docs/agents-registry.md`（「智能体命名注册表」「新建 Agent 时自动维护注册表」两节）与 `~/.claude/docs/new-agent-scaffold.md`（脚手架清单 / 命名规则 / 徽章规范 / 开源约定）——本文件把它们编排成可执行步骤。

## 任务一：给团队新增一个 agent（定名 + 入表）

### 1. 定名（命名规则 + 查重）

- **命名规则**（2026-10-09 修订）：**以 `Agent` 结尾、前缀尽可能简单**（如 `cuAgent`）——直接取项目用途的短前缀即可；不再要求「职称式全称 + PascalCase」，新建 agent 也不再强制拟人名（历史 agent 多为拟人名，保留不动）。用户主动要求拟人名时才按历史惯例（蕴含主要能力、双关优先——如制造生产类取 Wright「制造匠」、修补维护类取 Tinker「修补匠」）。
- **查重**：先读全局 `~/.claude/docs/agents-registry.md` 的「智能体命名注册表」表格，新名**全局不可重复**（拟人名与项目名都查；首字母尽量错开以利辨识）。
- **与用户确认名字**：名称有分歧时，把候选名 + 由来写进汇报让用户拍板。

### 2. 追加进注册表（免确认）

名字定了就**直接**改全局 `~/.claude/docs/agents-registry.md` 的注册表（这步本身免确认，该文件「新建 Agent 时自动维护注册表」节）：

- 在表格末尾加一行：
  ```
  | **<名称>** | <项目目录名，如 cuAgent> | <职称 Title> | <主要职责一句话> |
  ```
- 在表格下方「销售流水线与三小组」段补该 agent 的位置：在流水线内（① Scout → ② Wright → …）还是独立于流水线（独立工具型 agent 也要注明「不分组、直属用户」之类定位）。

**授权边界**：免确认**仅限**「追加新 agent 行 + 补位置说明」。改已有 agent 行 / 改语言偏好 / 改 git 规则等其它编辑仍要先征得用户同意。

### 3. 镜像本项目 claude/ + 验证

```bash
AUTH=~/Developer/CapabilityManagerAgent
cp ~/.claude/docs/agents-registry.md "$AUTH/claude/docs/agents-registry.md"
diff ~/.claude/docs/agents-registry.md "$AUTH/claude/docs/agents-registry.md" && echo "✅ 一致"
# 若团队 agent 总数有变：全局 CLAUDE.md 的「团队结构参考」计数也一并改，并同步 claude/CLAUDE.md
```

注册表改动只动 `docs/agents-registry.md`（可能连带 `CLAUDE.md` 计数），不涉及 skills；单一出口后无需分发到各项目。

## 任务二：搭新 agent 项目脚手架

确认了名字与角色后，搭项目骨架。**推荐做法：复制一个相近的已有 agent 项目再按角色改写**（比从零搭省事、且保证团队一致；可参考 `~/Developer/FullStackEngineerAgent` 的根目录文件结构）。

### 1. 建项目目录 + git init

```bash
cd ~/Developer
mkdir <目录名> && cd <目录名>     # 目录名 = 名称（以 Agent 结尾、前缀尽可能简单，如 cuAgent）
git init   # 免确认（CLAUDE.md「新建项目 git init 免确认」）
```

**目录名 = 名称**：以 `Agent` 结尾、前缀尽可能简单（2026-10-09 修订）——不再要求「职称式全称 + PascalCase」，也不强制拟人名。

### 2. 建根目录文件（不建 `.claude/`）

**新建项目一律不建 `.claude/` 目录、不复制任何通用能力副本**（单一出口，见 `~/.claude/docs/new-agent-scaffold.md`「通用能力开源单一出口」节）——通用 skill / hooks 由全局 `~/.claude/` 在运行时直接提供，开源分发统一走本项目 `claude/` 镜像。新项目根目录只建：

- **LICENSE.md**：MIT（版权人 `All Contributors`）。
- **CLAUDE.md**（角色化）+ **`AGENTS.md` 软链接**（`ln -s CLAUDE.md AGENTS.md`）。
- **README.md + README_cn.md**（双语，含名称 + logo + 标准徽章）。
- **`.gitignore`**（必含项见第 4 小节）。
- **VERSION / CHANGELOG.md**：由首次 `/commit` 自动补建（commit skill 第 9m 步）。

**AutoMemory 全局已禁用**：不建 `.claude/memory/`、不填 `autoMemoryDirectory`、`.gitignore` 不挂 memory。

### 3. 写角色化文档

- **CLAUDE.md**：角色化——你是谁（名称 + 职责）/ 产物契约 / 工具 / 约束 / 流水线位置。
- **README.md（英文）+ README_cn.md（中文）**：含名称 + topics；顶部 logo（`assets/logo.svg`，agent 门面统一模板：640×200 渐变色卡 + 角色 emoji + 名字 + 职称；视觉规范见 icon-design skill）+ 标准徽章（shields.io：**License / Version / Type** 三枚；**不含** Forks / Stars / Last Commit 等动态徽章，团队仓库另挂 Visitors 访问量徽章属允许例外；**不含**点明 LLM / 厂商的徽章如 "Built with Claude Code"）。
- 详见 commit skill 第 9 步的 README 标配细则（logo 配色、徽章组合、版权署名归一为 All Contributors 等）——首次 `/commit` 会自动补齐缺失项。

### 4. 配 .gitignore

必含：`.env` / `.env.*`（留 `.env.example`）、`settings.local.json`、`tmp/`、`docs/`（运行时数据）、`artifacts/`（**可售卖成品，绝不公开**）、`node_modules/`、`.DS_Store`、`__pycache__/`。

### 5. 角色专属能力（按需）

如该 agent 有专属能力（如 Scout 的 hot-trend、Victor 的 trade），按 skill-creator 方法论新建；落位参照最新约定、与用户确认后执行——**新建项目不建 `.claude/` 目录**（旧项目 `.claude/skills/` 下的专属 skill 属历史形态、保留不动）。

## 任务三：开源到 GitHub

**注意**：开源涉及的 `gh repo create`（建远程）+ push 属 git 写操作——要**先征得用户同意**（列命令等确认），或由用户触发 `/commit`（commit skill 第 8 步在无 origin 时会自动创建公开远程并推送）；`git init` 已在任务二免确认完成。用户的「开源到 GitHub」大方向指令**不等于**直接授权建远程——仍要逐次确认（或走 `/commit` 通道）。

确认后步骤：

```bash
cd ~/Developer/<目录名>
# 1. 建公开仓库 + 设 origin + push（一条命令）
gh repo create <目录名> --public --source=. --remote=origin --push

# 2. 设 About：中英双语 description + topics
gh repo edit --description "<English summary> | <简体中文摘要>" \
  --add-topic ai-agent --add-topic <topic2> ...
# 多个 --add-topic 写字面量，勿用 shell 变量拼接（否则报 accepts at most 1 arg(s)）
```

- **description 中英双语**：英文部分以美式英文为主、中文部分以简体中文为主，用 ` | ` 分隔，总长 < 350 字符。
- **FUNDING.yml**：**只放一份**在 `xhqing/.github` 仓库（内容 `github: xhqing`），作为所有仓库的默认 Sponsor 配置。**不要**在每个 agent 项目里放 `.github/`。

## 完成后的闭环

- **记 CHANGELOG**（本 CapabilityManagerAgent 项目的）：若本次任务改了全局 `docs/agents-registry.md` / `CLAUDE.md`（并镜像到 `claude/docs/` / `claude/`）、或新增了通用 skill，记一条。
- **新 agent 项目自己的 CHANGELOG**：新项目的变更记它**自己**的 CHANGELOG（各项目独立），不混进本项目。
- **提示用户后续**：新项目内容改完后，由用户自行 `git add` + `/commit` 提交（本 skill 不动暂存区）。
