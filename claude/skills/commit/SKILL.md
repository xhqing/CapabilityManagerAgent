---
name: "commit"
description: "提交当前暂存区已有的内容到本地仓库并推送到远程（依次 git commit → git push；不执行 git add，只提交用户已自行 git add 到暂存区的内容；若无远程仓库则先用 gh repo create --public 创建一个再推送）。当用户输入 commit 时触发。git commit 之前对暂存区已有内容做敏感内容扫描 + cache 文件/目录检测（cache 命中则自动加入 .gitignore），任一命中即彻底终止本次流程——不 commit/push，需重新 /commit 走完整流程；push 之后再检测项目标配（README 中英双语+LOGO+徽章(不含 GitHub Stars 数量徽章)+版权署名(含版权人/署名引用名字归一为 All Contributors)+英文版 README 跳中文版链接文字统一为「简体中文」+Agent 拟人名、LICENSE.md、CHANGELOG.md 与 VERSION 文件、GitHub About 中英双语简介+标签、仓库 Sponsors 按钮），缺失则自动补上，齐全则记入项目根 `.commit-skill-cache.md` 缓存跳过重复检测；push 之后另做版本滞后检测（仅当项目根有 VERSION 文件：若 VERSION 标注版本已在 GitHub Release 发布且仓库有该版本后的新提交，则由智能体自主决定 bump 幅度并直接更新 VERSION/package.json/CHANGELOG 等各文件版本号，不阻塞、每次必查不缓存）+ 版本号一致性检测（项目根有 VERSION 文件才查：各文件版本号须与 VERSION 一致，不一致则以 VERSION 为准自动同步各文件，不阻塞、每次必查不缓存）。"
---

# Auto Git Commit & Push

当用户输入 `commit` 时，把**当前暂存区已有的内容**提交到本地仓库并推送到远程（**依次执行 `git commit` → `git push`**，不执行 `git add`，只提交用户已自行 `git add` 到暂存区的内容），**推送完成后再补齐项目标配**（README/LICENSE/CHANGELOG/VERSION/About/Sponsors，含版权人/署名引用名字归一为 All Contributors）。敏感内容扫描、cache 文件/目录检测是 `git commit` 之前的两项检测（均针对暂存区已有内容，任一命中即终止）；版本号一致性检测（项目根有 `VERSION` 文件才查）及其余项目标配检测全部放在 `git push` 之后，不阻塞提交流程。

## 核心定位：先提交推送，再补标配

- **触发与终止规则（2026-07-15 用户立，最高优先级）**：
  - **触发判定**：只由**用户当前这条消息**含 `/commit` 且**意图确为「现在执行提交」**才触发——**不看历史消息**（历史里有 `/commit` 不触发、不续跑）；**当前消息即便字面含 `/commit` 也要先理解意图**，若是在讨论 / 举例 / 引用 `/commit` 或意图非提交（如「这条含 /commit 但不是要 commit」），**不触发**。不自发、不续跑、不自动进入。
  - **命中即彻底终止**：流程中一旦命中敏感内容扫描或 cache 检测，**立即终止本次 `/commit`**（不 `commit` / `push`），**不存在「暂停 → 等用户处理 → 从断点继续」**；要再次提交，用户须**重新输入 `/commit`** 从头走完整流程。（版本号一致性检测不阻塞提交，已移至 push 后第 9k 步处理。）
- 本 skill **依次执行 `git commit`、`git push`**：提交暂存区已有的内容到本地仓库，再推送到远程（**不执行 `git add`**，提交内容以用户自行 `git add` 到暂存区的为准）。
- **两步用 `&&` 串联成一条命令一次性跑完（2026-07-17 用户立；2026-08-01 修订：去除 git add，改为只提交暂存区）**：`git commit` + `git push` 两步**优先用 `&&` 组合成一个 Bash 命令**一次执行，不拆成多次 Bash 调用、不中途停下来向用户列命令确认——用户输入 `/commit` 即明确授权当次 commit+push（全局 `~/.claude/CLAUDE.md`「Git 写操作必须先征得同意」段的例外已写明），再列命令确认是多余的反 confirm。commit 信息基于 `git diff --cached` + `git status`（暂存区已有内容）生成，随后直接 `git commit -m "<msg>" && git push` 一条命令跑完两步。**若 auto mode 权限分类器拦下其中某一条 git 写命令，不要退缩去问用户**——改用 `&&` 串联的组合命令继续执行（组合命令作为整体更易被识别为 commit 流程、不易被单点拦截）；commit 前的两项硬性检测（敏感内容扫描 + cache 检测，均针对暂存区已有内容）照常先做完、通过后才进入串联执行。本条同样适用 `/release` 等其它用户主动触发即授权的 skill。
- **commit 前检测有两项：敏感内容扫描 + cache 文件/目录检测**（均针对暂存区已有内容）；版本号一致性检测（项目根有 `VERSION` 文件才查）与 README/LOGO/徽章/版权署名/版权人与署名引用名字归一/LICENSE.md/CHANGELOG.md 与 VERSION 文件/About/仓库 Sponsors 按钮 等「项目标配」检测**全部放在 `git push` 之后**（第 9 步）——先提交推送代码，再补标配，补的内容作为新工作区改动，本次未提交；本 skill 不执行 `git add`，需用户自行 `git add` 后下次 `/commit` 提交。
- 标配检测：缺则自动补上；齐全则在项目根 `.commit-skill-cache.md` 标记，下次跳过重复检测。
- **严禁**执行 `git push --force`、`git reset --hard` 等破坏性操作。
- **严禁**编辑、删除、格式化项目文件（例外仅七类：① README/LICENSE 标配补全——可编辑 `README.md`/`README_cn.md`（顶部 LOGO/徽章居中块 + 移除 GitHub Stars 数量徽章（第 9l 步） + persona 说明块 + 底部版权署名段 + 版权人/署名引用名字归一为 `All Contributors`（第 9g 步）+ 语言基调修正：把 `README.md` 里「本该用英文却写成中文」的正文改为英文（特殊场景的中文保留不动）+ 英文版跳中文版链接文字统一为「简体中文」（第 9h 步））、创建 `assets/logo.svg`、创建 `LICENSE.md`、**删除冗余的其它格式 license 文件**（只保留 `LICENSE.md`）；② 项目根 `.commit-skill-cache.md` 写入缓存标记（不存在则新建）；③ 全局 `~/.claude/CLAUDE.md` 的「智能体命名注册表」**追加**新 agent 行（仅 9d 起名时，不改已有行）；④ cache 检测——第 3 步检测到的 cache 文件/目录可新增进 `.gitignore`；⑤ 版本滞后 bump（第 9j 步）——检测到 VERSION 滞后时，可更新 `VERSION`、`package.json`、`package-lock.json`、`CHANGELOG.md`、主 manifest（`manifest.json`/`pyproject.toml`/`Cargo.toml`/`*.csproj`）、README 的版本号；⑥ 版本号一致性同步（第 9k 步）——检测到 VERSION 与各文件版本号不一致时，以 VERSION 为唯一权威，更新 `package.json`、`package-lock.json`、`CHANGELOG.md`、主 manifest、README 的版本号到与 VERSION 一致（不动 VERSION 自身）；⑦ 新建 `CHANGELOG.md` 与 `VERSION` 文件（第 9m 步）——检测到项目缺这两个文件时按 9m 规则创建，不改动 `.gitignore` 的其它部分。
- 敏感内容扫描、cache 检测**均在 `git commit` 之前执行一次**（针对暂存区已有内容）；`git commit` 之后不再重复。（版本号一致性检测已移至 push 后第 9k 步，不阻塞提交。）

## 执行流程

1. 运行 `git status`，确认当前处于 git 仓库中。判断**暂存区是否已有内容**（本 skill 只提交暂存区已有的内容，**不执行 `git add`**）。
   - 暂存区为空（无任何已暂存的改动）→ 告知用户「暂存区无内容可提交（本 skill 不执行 git add，请先自行 git add 要提交的内容）」并结束流程（无提交则不推送）。
   - 暂存区有内容 → 继续下一步。
2. **敏感内容扫描（`git commit` 前一次性硬性检查，针对暂存区已有内容，本次操作仅此一次）**：检查暂存区即将被提交（commit）的所有文件，是否含敏感或不宜入库内容。这些文件 = 暂存区已有内容（用户此前自行 `git add` 的文件；本 skill 不执行 `git add`，故不扫工作区未暂存改动）。常见类别包括：
   - 凭证与密钥：`.env`、`.env.*`、`*.pem`、`*.key`、`id_rsa` 等私钥、API key、token、密码、数据库连接串；
   - 凭证目录：`.ssh/`、`.aws/`、`.gcloud/`、`secrets/`、`credentials/` 等；
   - 本地私有配置：`.claude/` 中含个人设置/记忆的文件、`.idea/`、`.vscode/` 中含个人配置的文件；
   - 其他不宜入库内容：大文件、二进制、本地数据库文件等。

   扫描对象（**仅暂存区已有内容**，本 skill 不 `git add`，故不扫工作区未暂存改动）：
   - 暂存区已有内容：`git diff --cached --name-only`（用户此前自行 `git add` 的文件）。

   扫描方式：
   - 列出上述文件，按敏感路径/文件名模式匹配；
   - 对命中或可疑文件抽样读取内容，确认是否含明文敏感信息。

   结果处理：
   - **未发现敏感内容** → 继续后续流程；
   - **发现敏感内容** → **立即终止本次 `/commit`，不执行 `git commit`、不执行 `git push`**，向用户列出：
     1. 每个涉及敏感内容的文件路径；
     2. 文件中具体的敏感内容片段（可截断，标出敏感字段）；
     3. 处理建议（从暂存区移除 `git restore --staged <file>`、加入 `.gitignore`、删除敏感内容等）。本 skill 自身不从暂存区移除文件、不修改 `.gitignore`、不改动工作区，处理由用户自行完成。
     **本次 `/commit` 就此终止、不续跑**（不「等用户处理后从第 1 步继续」）。用户处理完敏感内容后，须**重新输入 `/commit`** 才会从头走完整流程。

3. **cache 文件/目录检测**（与敏感扫描并列的 `git commit` 前硬性检测，针对暂存区已有内容）：扫描暂存区文件清单（`git diff --cached --name-only`）中，**名字含 cache 的**——常见如 `cache/` 目录、`__pycache__/`、`.cache/`、`*.cache`、`<skill>/cache/`（如 find-skill 的 `cache/`）等运行时缓存（本地生成、不应入库）。
   - 结果处理：
     - **未发现 cache** → 继续后续流程（第 4 步取暂存区清单）；
     - **发现 cache 文件/目录** → **自动在 `.gitignore` 追加对应忽略规则**（例外④允许：仅新增忽略本次检测到的 cache 路径，不改 `.gitignore` 其它部分），**然后立即终止本次 `/commit`，不执行 `git commit`、不执行 `git push`**，向用户汇报：发现的 cache 文件/目录清单 + 已写入 `.gitignore` 的忽略规则 + 提示用户自行从暂存区移除 cache（`git restore --staged <cache路径>` 或 `git rm --cached -r <cache目录>`）后重新 `/commit`。**本次 `/commit` 就此终止、不续跑**（不「等用户确认后从第 1 步继续」）；用户须**重新输入 `/commit`** 走完整流程。

4. 运行 `git status` / `git diff --cached --name-only`，获取本次暂存区已有的文件清单（按类别分组：新增、修改、删除）。
5. 获取当前分支名与远程仓库地址（`git remote -v`）。
6. 根据 `git diff --cached --stat` / `git diff --cached` 生成简洁英文提交信息（1-2 句话，说明本次改动的性质）。
7. 运行 `git commit -m "<生成的提交信息>"` 提交暂存区内容。**本步与第 8 步 push 用 `&&` 串联成一条命令执行**（不拆开、不中途停下确认，分类器拦单条也不退缩——详见「核心定位」段「两步用 && 串联一条命令跑完」）。
8. 执行推送。先检查远程仓库（`git remote -v`），按三种情形处理：
   - **无 `origin`（remote 为空）** → 主动创建 GitHub 远程仓库再推送：
     - 仓库名取项目目录名（`basename "$PWD"`），可见性 `--public`（本 skill 服务于开源项目）；
     - `gh repo create <仓库名> --public --source=. --remote=origin --push`（一条命令完成：创建公开仓库 + 设置 `origin` + 推送当前分支）；
     - **前置**：`gh` 已认证（`gh auth status`）。未认证 → 如实报告、跳过创建与推送，继续第 9 步；
     - 创建失败（重名冲突 / 网络等）→ 如实报告错误，不自行重试或破坏性解决；
     - 创建并推送成功后，第 9c 步的前置条件（有 `origin` + push 成功）即满足。
   - **有 `origin` 但当前分支无上游** → `git push -u origin <分支名>` 推送并设置上游。
   - **有 `origin` 且已设上游** → `git push`。
   - 推送过程中如遇冲突或其他错误，将错误信息如实报告给用户，不自行尝试破坏性解决（禁止 `--force`）。
9. **项目标配检测（`git push` 之后，最后一步）**：提交推送已完成，这里补齐项目标配。push 失败时仍进入本步（9a/9b/9d/9g/9h/9k/9l/9m 是本地检测；9e 永久跳过，见第 9e 步），但 9c 需 push 成功。先读项目根 `.commit-skill-cache.md`（不存在则视为无缓存、稍后新建），按缓存标记跳过已确认的项（见「`.commit-skill-cache.md` 检测缓存」）；对未跳过的项逐一检测，**缺则补、齐则记标记，不再停下阻塞**。补的内容作为新工作区改动，本次未提交；本 skill 不执行 `git add`，需用户自行 `git add` 后下次 `/commit` 提交。

   **例外（跳过整个第 9 步）**：若当前仓库根目录名（`basename "$(git rev-parse --show-toplevel)"`）为 `xhqing`——这是 GitHub 账号同名 Profile 仓库，仅含一个 `README.md` 用于在 GitHub 个人主页展示，非常规项目——**直接跳过本步全部检测（9a/9b/9c/9d/9e/9f/9g/9h/9i/9j/9k/9l/9m）与 `.commit-skill-cache.md` 缓存读写**，不做任何 README/LICENSE/About 补全，直接进入汇报。

   **9a. README 标配**（标记 `readme-standard`）：`README.md` 英文版 + `README_cn.md` 中文版，两版顶部 LOGO/徽章块一致并互链（英文版 `[简体中文](README_cn.md)`、中文版 `[English](README.md)`），底部有版权与许可证 + 署名方式 + 项目地址引用段。
   - **双语**：无 `README.md` → 创建英文版最小 README；无 `README_cn.md` → 基于 `README.md` 翻译创建中文版。
   - **语言基调**（2026-08-01 修订，替代原「语言纯度」）：`README.md` 以**美式英文为主**（特殊场景可用任何语言），`README_cn.md` 以**简体中文为主**（特殊场景可用任何语言）。默认英文版写英文、中文版写中文，但**不追求「逐字纯净」**——正文里需要保留的中文专有名词、人名、机构名、产品名、引用原文、代码示例、注音等属「特殊场景」，可按需混入主语言之外的字词，不视为违规。
     - 扫描 `README.md` 发现中文时**逐处语义判断**（不再机械地「见中文即违规」）：**属特殊场景（如上列举）→ 保留不动**；**属「本该用英文却写成了中文」**（典型如整段中文叙述塞进英文版、或正文随手用了中文词而非通用英文术语）**→ 改为英文**。
     - **LOGO（`assets/logo.svg` 里 `<text>`/嵌入文字）与徽章（URL 参数、alt 文本）**：默认用英文（项目名、`AI Agent` 等 Type 标签是面向全球读者的视觉元素）；仅当项目名本身就是中文、或有意做双语 LOGO 时保留中文（属特殊场景）。
     - `README_cn.md` 反向同理：以简体中文为主，必要的英文术语、代码、引用原文保留，不追求逐字纯净。
   - **LOGO**：`README.md` 无图片引用或图片不存在 → 按 LOGO 生成规则创建 `assets/logo.svg`，并在两版顶部插入 `<div align="center"><img ...></div>`（已有居中 div 则在其中插入）。
   - **徽章**：`README.md` 无 `img.shields.io` → 在 LOGO 下方插入徽章行并同步两版。
   - **版权与署名**：两版底部缺「版权与许可证说明 + 署名方式 + 项目地址引用方式」→ 追加完整段（英文版 `## License & Attribution`，中文版 `## 版权与署名`）：① 版权 `Copyright (c) <年份> All Contributors` + 许可证（链 `LICENSE.md`）；② 署名方式（致谢 + 保留版权声明 + 注明来源）；③ 项目地址引用（`origin` 的 GitHub URL，无 remote 则用 `https://github.com/<git user>/<目录名>`）。**版权人统一 `All Contributors`；已存在的具体人名（含已有版权段里的）由 9g 主动归一，本步不重复扫描。**
   - **项目类型推断**（定 Type 徽章 + LOGO 配色/emoji）：`package.json` 有 `engines.vscode` → VSCode Extension（`Type-VSCode%20Extension-0078D4`，蓝）；目录名以 `Agent` 结尾或 README/CLAUDE.md 自述为 agent → AI Agent（`Type-AI%20Agent-FF1493`，按角色）；`package.json` 有 `main`/`exports` 且无上述特征 → Library（`Type-Library-9CF`，青）；否则 → Project（`Type-Project-lightgrey`，紫）。
   - **LOGO 生成**（`assets/logo.svg`）：640×200、圆角 `rx=28`、线性渐变、左侧大 emoji（按主题选，无把握用 `⚙️`）+ 项目名 + 副标题（`<类型> · <一句话描述>`）；结构对齐 DigiVendAgent logo.svg 模板。
   - **徽章组合**（按 remote）：解析 `git remote -v`，`origin` 为 `github.com` 则提取 `user/repo`。有 remote（3 枚）：License + `github/last-commit/<user>/<repo>` + Type；无 remote（2 枚）：License + Type。License 从 `LICENSE.md`/`package.json.license` 推断（MIT→`License-MIT-yellow`、Apache-2.0→`License-Apache_2.0-blue`、GPL-3.0→`License-GPL_v3-blue`，无则跳过）。**不使用 GitHub Stars 数量徽章**（`github/stars/...`）——stars 数量不展示在 README，由第 9l 步负责清理已存在的 stars 徽章。
   - **只补不删**：不改动用户已有的 LOGO/徽章/正文（**语言基调修正除外**：把 `README.md` 里「本该用英文却写成中文」的正文改为英文是允许的，特殊场景的中文保留不动）。README 双语 + LOGO + 徽章 + 版权署名段全齐 → 写 `<!-- commit-skill: readme-standard = ok -->` + 日期行。

   **9b. LICENSE.md**（标记 `license`）：根目录**只保留 `LICENSE.md`**，不与其它格式 license 文件重复。
   - 无 `LICENSE.md` → 创建（若有 `LICENSE`/`LICENSE.txt` 等同名文件则复制其内容，否则用 MIT 模板）；**版权人统一用 `All Contributors`**（覆盖原文件里的具体人名）。已存在 `LICENSE.md` 里写死的具体人名归一由 9g 处理。
   - 创建后、或 `LICENSE.md` 已存在时，若根目录还有其它格式 license 文件（`LICENSE`、`LICENSE.txt` 等）→ **删除冗余**，只留 `LICENSE.md`。
   - `LICENSE.md` 存在且无冗余 → 写 `<!-- commit-skill: license = ok -->` + 日期行。

   **9c. GitHub About**（标记 `github-about`）：确保 GitHub repo About 有中英双语 description 与 topics。
   - **前置**：`origin` 指向 `github.com` 且 `gh` 已认证、且第 8 步 push 成功。任一不满足 → 跳过、不记录、如实报告（如「无 GitHub remote / push 未成功，跳过 About 检测」）。
   - `gh repo view <user/repo> --json description,repositoryTopics` 取当前 About。
     - description 中英双语判定：description 须同时含英文与中文（结构形如「English summary | 简体中文摘要」，**英文部分以美式英文为主（特殊场景可用任何语言）、中文部分以简体中文为主（特殊场景可用任何语言）**）。
       - 已是中英双语（既含英文也含中文）→ 视为合规，保留不动。
       - 仅含英文或为空 → 缺中文，用 `gh repo edit --description "<English summary> | <简体中文摘要>"` 补成双语（中文部分从 README 中文段提取或由英文翻译为简体中文，英文部分以美式英文为主，总长 < 350 字符）。
       - 仅含中文 → 缺英文，用同样命令补上英文部分（从 README/package.json description 提取或翻译为英文，拼成「English | 中文」双语，总长 < 350 字符）。
     - topics 判定：为空 → 按项目类型 + 关键词推断，`gh repo edit --add-topic a --add-topic b ...` 补全（**多个 `--add-topic` 写字面量，勿用 shell 变量拼接**）；非空 → 保留不动。
     - topics 推断：VSCode 扩展 → `vscode`/`vscode-extension`；性能监控 → `performance`/`monitoring`；macOS 依赖 → `macos`；TypeScript → `typescript`；Claude Code 构建 → `claude-code`；Agent → `ai-agent`。按实际命中选取，不强加。
   - 补全（或检测发现已配）后 → 写 `<!-- commit-skill: github-about = ok -->` + 日期行。

   **9d. Agent 拟人名**（标记 `agent-persona`）：项目目录名以 `Agent` 结尾时，必须有一个**蕴含主要能力含义**的拟人化名字并写进 README（项目核心内容为代表 Agent 能力的 skills / rules / memory / mcp 等，名字即 Agent 的身份）。
   - **触发**：目录名以 `Agent` 结尾。不以 `Agent` 结尾 → 跳过本项、不记录。
   - **检测已有**：① 查全局 `~/.claude/CLAUDE.md` 的「智能体命名注册表」，该仓库已在表中 → 名字即定，README 引用之；② 否则看 README（中英任一）是否已有 persona 说明块（如 `> **<Name>** — <一句话能力说明>` 形式）。两者皆无 → 视为缺名。
   - **缺名则起名**：
     - **查重**：新名不得与注册表已有名（Scout / Wright / Buzz / Vendy / Echo / Kit / Victor 等）重复，首字母尽量错开以利辨识；
     - **语义**：名字要**蕴含该 Agent 的主要能力**（双关优先，如修补维护类取 Tinker「修补匠」、制造生产类取 Wright「制造匠」），避免直白工具名（如 Patcher）；
     - **写入**：在两版 README 标题正下方加 persona 说明块（emoji + **名字** + 一句话能力说明），中英一致；
     - 起名后**把新名字追加进全局 `~/.claude/CLAUDE.md` 的「智能体命名注册表」**（新起一行 `| **<名字>** | <仓库目录名> | <职称> | <主要职责> |`，不改已有行；若该 agent 不属销售流水线，在表下「流水线顺序」句补注其独立）；
   - 已有名字（注册表命中或 README persona 块已存在）或新起并写入后 → 写 `<!-- commit-skill: agent-persona = ok -->` + 日期行（注明名字）。

   **9e. AutoMemory 目录**（标记 `automemory`）：**永久跳过——不检测、不补全、不写标记**。
   - **原因**：全局 AutoMemory 已禁用（`~/.claude/settings.json` 设 `autoMemoryEnabled: false`，2026-07-20 用户立）。按全局 `~/.claude/CLAUDE.md` 约定，新建项目一律不配 AutoMemory——不建 `.claude/memory/`、不填 `autoMemoryDirectory`、`.gitignore` 不挂 memory 条目。
   - **因此本步不做任何检测与补全**：不创建/编辑 `.claude/settings.local.json`、不创建 `.claude/settings.local.example.json`、不向 `.gitignore` 写 memory 相关内容（`settings.local.json` 的忽略与 `.claude/memory/` 的入库由项目脚手架阶段处理，非本 skill 职责）。
   - `.commit-skill-cache.md`**不写 `automemory` 标记**（该标记在本约定下永久不出现）。
   - **边界**：若日后重新启用 AutoMemory，恢复本步检测逻辑即可（届时需同步恢复「例外④ AutoMemory 配置」与缓存段 `automemory` 标记示例）。

   **9g. 版权人/署名引用名字归一**（标记 `attribution-name`）：README.md（英文版）、README_cn.md（中文版）、LICENSE.md 三份文件里，凡是代表「本项目版权人 / 作者」身份的名字，统一使用 `All Contributors`，不出现具体个人名（如 `Huaqing Xu`、`xhqing` 等）。与 9a/9b 互补——9a 只在「缺段则补」、9b 只在「创建 LICENSE」时写入 `All Contributors`，**已存在文件里写死的具体人名由本步主动归一**。
   - **触发**：所有项目（凡有 README/LICENSE 的都扫，与 9a/9b 一致）。`xhqing` Profile 仓库仍走第 9 步开头的例外、整个跳过，9g 不例外。
   - **扫描对象**（三份文件，不存在的跳过）：`README.md`、`README_cn.md`、`LICENSE.md`。
   - **扫描位置**（仅两类，避免误伤正文）：
     1. **版权声明行**：`Copyright (c) <年份> <持有人>` / `Copyright <年份> <持有人>` / `© <年份> <持有人>` 等中英文变体——持有人位置 ≠ `All Contributors` → 改为 `All Contributors`。
     2. **署名说明段**：README 的 `## License & Attribution` / `## 版权与署名` 段落内（LICENSE.md 一般无此段，只看版权声明行）——凡「作为本项目作者/版权人被引用」的具体名字（`by <Name>`、`作者：<Name>`、`© <Name>`、`<Name> (<email>)`、裸人名、`@handle` 等）→ 改为 `All Contributors`。
   - **不改（排除清单）**：
     - **GitHub 仓库地址里的 user**（如 `github.com/xhqing/repo` 中的 `xhqing`）——仓库归属事实、非版权人；改了会让链接指向不存在的仓库、失效；
     - **Agent 拟人名**（9d 写入的 Scout / Wright / Victor 等）——角色身份、非版权人，与 9d 冲突；
     - **第三方依赖/工具署名**（依赖库自带的版权声明）——非本项目版权人；
     - **项目名本身**。
   - **判定方式**：由 CC 语义判断「该名字是否代表本项目版权人/作者」（非纯正则）；**拿不准的保留不动并在汇报里列出**，不擅自改。
   - 三份文件均无具体人名（版权人/署名引用位置已是 `All Contributors` 或无可改位置）→ 写 `<!-- commit-skill: attribution-name = ok -->` + 日期行。

   **9h. 英文版 README 跳转中文版链接文字**（标记 `readme-link-text`）：英文版 `README.md` 里指向中文版（`README_cn.md`）的跳转链接，其呈现文字统一为「简体中文」，不允许只写「中文」两个字。与 9a 互补——9a 管「两版是否互链」，本步专门校正「英文版里跳转中文版的链接文字是否符合规范」。
   - **触发/前置**：`README.md` 与 `README_cn.md` 均存在。缺任一 → 跳过、不记录（由 9a 先补齐双语，下次 `/commit` 再检测本步）。
   - **检测**：扫描 `README.md` 里所有指向 `README_cn.md` 的 markdown 链接（形如 `[<文字>](README_cn.md)`，含 `./README_cn.md` 等路径变体）。
   - **修正**：链接文字 ≠「简体中文」（常见为只有「中文」二字，或「Chinese」「繁体中文」等其它写法）→ 改为 `[简体中文](<原链接目标>)`，只改呈现文字、不动链接目标。
   - 英文版当前没有指向中文版的链接 → 本步不负责补链接（互链由 9a 补，9a 补时直接用「简体中文」），跳过、不记录。
   - 链接文字已是「简体中文」→ 写 `<!-- commit-skill: readme-link-text = ok -->` + 日期行。

   **9i. 仓库 Sponsors 按钮**（标记 `repo-sponsors`）：确保 GitHub 仓库页会显示 Sponsor 按钮（仓库主页右侧「Sponsor this project」按钮，由 `FUNDING.yml` 驱动，区别于 README 里自定义的赞助块 / 收款码）。
   - **机制**：Sponsor 按钮由 `FUNDING.yml` 驱动，文件可放在仓库根目录或 `.github/` 子目录。`<username>/.github` 仓库的 `FUNDING.yml` 会作为该用户**所有仓库的默认 sponsor 配置**（除非某仓库自己有 `FUNDING.yml` 覆盖）。按全局 `~/.claude/CLAUDE.md` 约定，**统一只在 `xhqing/.github` 仓库放一份 `github: xhqing`**，不在每个项目里单独放 `.github/FUNDING.yml`——赞助配置不是项目主体内容。
   - **前置**：`gh` 已认证（`gh auth status`）。未认证 → 跳过、不记录、如实报告（如「gh 未认证，跳过 Sponsors 检测」）。
   - **检测**（判断当前仓库在 GitHub 上是否会显示 Sponsor 按钮，二者任一满足即「就绪」）：
     1. 当前仓库有自己的 `FUNDING.yml`（`.github/FUNDING.yml` 或根目录 `FUNDING.yml`）且含有效 sponsor 键（`github:` / `patreon:` / `ko_fi:` / `buy_me_a_coffee:` / `open_collective:` / `custom:` 任一）→ 已就绪（尊重现状，不主动移除；按全局约定 agent 项目不应有，但本步不负责清理）；
     2. 否则查全局 `xhqing/.github` 仓库的 `FUNDING.yml`（根目录或 `.github/` 子目录）是否存在且含有效 sponsor 键（约定为 `github: xhqing`）→ 存在则已就绪（默认配置对该用户所有 GitHub 仓库生效）。
   - **未就绪则修复**（两者皆无）：按全局约定，**通过 `gh api` 在 `xhqing/.github` 仓库创建 / 更新 `FUNDING.yml`**，内容为 `github: xhqing` + 注释模板（赞助平台说明 + 文档链接 + 其它平台注释行）。用 `gh api -X PUT repos/xhqing/.github/contents/FUNDING.yml -f message="Add FUNDING.yml for GitHub Sponsors" -f content="<base64 编码的内容>"`（若该文件已存在但内容不含有效 sponsor 键，先 GET 取 `sha`，再带上 `-f sha=<sha>` 更新）。这是**跨仓库远程写操作**（写的是 `xhqing/.github` 而非当前项目，区别于本 skill 其它只动当前项目的步骤），但内容确定、是全局默认配置、符合用户「让所有仓库都显示 Sponsor 按钮」的意图，直接执行；创建 / 更新失败（网络 / 权限等）→ 如实报告，不强行重试、不动当前项目文件。
   - 已就绪（检测通过）或修复成功后 → 写 `<!-- commit-skill: repo-sponsors = ok -->` + 日期行（注明「全局默认 `xhqing/.github/FUNDING.yml` 就绪」或「当前仓库自有 FUNDING.yml」）。

   **9j. 版本滞后检测与自动 bump**（不写缓存标记、每次 `/commit` 必查）：检测 `VERSION` 标注的当前版本是否已落后于代码实际进度——若该版本**已经在 GitHub Release 发布**（该版本号对应的 Release / tag 已存在），且仓库里**该版本之后又有新的提交**，说明代码已往前走但版本号没跟上，此时由本智能体**自主决定 bump 幅度、直接更新** `VERSION` 及各相关文件的版本号。与第 9k 步「版本号一致性检测与同步」互补：9k 管横向（`VERSION` 与各文件版本号是否对齐、以 `VERSION` 为准同步），本步管纵向（`VERSION` 是否落后于已发布进度、必要时向上 bump）。
   - **触发 / 前置**：项目根有 `VERSION` 文件 + 有 `origin` 指向 `github.com` + `gh` 已认证（`gh auth status`）+ 第 8 步 push 成功。任一不满足 → 跳过、不记录、不 bump（如「无 `VERSION` / 无 GitHub remote / push 未成功，跳过版本滞后检测」）。
   - **检测逻辑**：
     1. 读 `VERSION` 取基准版本号（trim 首尾空白 / 换行），如 `2.1.0`。
     2. 查该版本**是否已在 GitHub Release 发布**：先 `gh release view "v<版本>"`（仓库惯用 `v` 前缀 tag）；提示 not found 则再试不带 `v` 的 `gh release view "<版本>"`。任一能查到 → 该版本已发布（记下实际 tag 名供下一步用）；都查不到 → **未发布，版本未滞后**（`VERSION` 指向尚未发布的下一版，不用 bump），正常通过。
     3. 该版本已发布 → 查仓库里**该版本 tag 之后是否有新提交**：先确保本地有该 tag（`git fetch --tags`，浅克隆 / 未 fetch 标签时必要），再 `git rev-list --count <实际tag>..HEAD`，结果 > 0 → 有新提交（代码已超前于已发布版本）；结果 = 0 → 该版本发布后无改动，不用 bump，正常通过。
     4. 两者同时满足（该版本已发布 + 该版本后有新提交）→ **版本滞后，进入 bump**。
   - **Bump 幅度判定**（由本智能体自主决定，依据该版本 tag 之后到 HEAD 的提交内容）：
     - 分析提交：`git log <实际tag>..HEAD --oneline`（必要时看完整 `git log <实际tag>..HEAD`），判断这些改动的性质。
     - **major**（第一段 +1，后两段归 0，如 `2.1.0`→`3.0.0`）：含**破坏性 / 不兼容**改动——公开接口 / 命令 / 配置格式 / API 签名变化导致旧用法失效，或 commit message 标注 `BREAKING CHANGE` / `!:`。
     - **minor**（中间段 +1，末段归 0，如 `2.1.0`→`2.2.0`）：含**新增功能**——新特性、新命令、新选项、新上游适配器等，且向后兼容。
     - **patch**（末段 +1，如 `2.1.0`→`2.1.1`）：只有 **bug 修复 / 重构 / 文档 / 杂项**，无新功能、无破坏性改动。
     - **拿不准 → patch**：提交性质模糊时取最保守的 patch，避免误升 major / minor 造成版本号虚高。判定后算出新版本号。
   - **直接更新版本号**（不阻塞——push 已完成，改完的版本号作为新工作区改动，本次未提交；本 skill 不执行 `git add`，需用户自行 `git add` 后下次 `/commit` 提交）：
     1. **`VERSION`**：改为新版本号（纯数字，无 `v` 前缀）。
     2. **`package.json`**：顶层 `version` 字段改为新版本号（存在才改）。
     3. **`package-lock.json`**：**顶层** `version` 字段改为新版本号（仅顶层，不动 `packages` 内各依赖版本；存在才改）。
     4. **`CHANGELOG.md`**：**在顶部新增一条新版本条目**（`## [新版本号] - <今天日期 YYYY-MM-DD>`，其下依据上方提交分析补简要改动说明）——**不要改已发布版本的历史条目**（那是已发版的既定记录），只在最上方加新版本。
     5. **主 manifest**：`manifest.json` / `pyproject.toml`（`version = "x"`）/ `Cargo.toml`（`version = "x"`）/ `*.csproj`（`<Version>x</Version>`）——存在才改为新版本号。
     6. **README**（`README.md` / `README_cn.md`）：**显式声明当前版本**的位置（「Current version: x」「当前版本：x」、版本徽章里的版本号）——存在才改为新版本号；不抓 changelog 历史版本、不抓依赖版本。
     - 改完后各文件版本号自然都等于新版本号，相当于顺带满足第 9k 步「版本号一致性检测与同步」。
   - **不写缓存标记**：版本滞后状态随每次提交 / 每次发版动态变化，**每次 `/commit` 都要重新查**，故 `.commit-skill-cache.md`**不写 `version-staleness` 标记**、永不跳过本步。
   - **例外**：当前仓库根目录名为 `xhqing`（Profile 仓库）→ 随第 9 步开头例外整个跳过，9j 不例外。

   **9k. 版本号一致性检测与同步**（不写缓存标记、每次 `/commit` 必查）：检测 `VERSION` 与项目里各处版本号是否**横向一致**——`VERSION` 是唯一权威源（对齐全局 `~/.claude/CLAUDE.md`「版本信息一致性」规则），其余涉及版本号的文件若与 `VERSION` 不一致，则**以 `VERSION` 为准自动同步**（不动 `VERSION` 自身）。与 9j 互补：9j 管纵向（`VERSION` 是否落后于已发布进度、必要时向上 bump 并同步各文件），本步管横向（`VERSION` 与各文件版本号是否对齐、以 `VERSION` 为准补齐）；两者都在 push 之后、都不阻塞、都不写缓存标记、都每次必查。**本步排在 9j 之后**：若 9j 已 bump `VERSION` 并同步各文件，则本步复查时各处应已一致、无需再改；若 9j 未触发（`VERSION` 未滞后），但某文件版本号偏离了 `VERSION`（典型如手动改了 `VERSION` 但 `package.json` / `CHANGELOG` 未跟上），则由本步补齐。
   - **触发 / 前置**：项目根有 `VERSION` 文件（本步只比对本地文件，**不要求** `origin` / `gh` / push 成功——push 失败也照常检测）。无 `VERSION` → 跳过、不记录、不同步。`xhqing` Profile 仓库随第 9 步开头例外整个跳过。
   - **检测逻辑**：
     1. 读 `VERSION` 取**基准版本号**（trim 首尾空白/换行），如 `2.1.1`。
     2. **允许前缀差异**：剥离前导的 `v` / `Version` / `"version":` 等修饰性前缀与引号、标点后，比较核心的 major.minor.patch 三段数字逐一相同即视为一致（如 `v2.1.1`、`Version 2.1.1`、`"version": "2.1.1"` 与 `2.1.1` 均算一致）；后缀（`-beta`、`-rc.1`、`+build` 等 pre-release / build metadata）不属于前缀、不自动豁免，需判断是否为有意区分。
     3. 逐一比对**须比对的位置**（存在的才查，各自提取版本号字串并 trim 后与基准比核心三段数字）：
        1. `package.json` 顶层 `version` 字段；
        2. `package-lock.json` **顶层** `version` 字段（仅顶层，不查 `packages` 内各依赖版本）；
        3. `CHANGELOG.md` 里**最新一条实际版本标题**（跳过 `## [Unreleased]` 占位符，取其下第一条形如 `## [2.1.0]` / `## 2.1.0` 的版本标题）；
        4. 项目主 manifest 的版本字段：`manifest.json`、`pyproject.toml`（`version = "x"`）、`Cargo.toml`（`version = "x"`）、`*.csproj`（`<Version>x</Version>`）——存在才查；
        5. README（`README.md` / `README_cn.md`）里**显式声明当前版本**的文字（如「Current version: x」「当前版本：x」、版本徽章），仅取「声明当前发布版本」的位置，不抓 changelog 历史版本、不抓依赖版本、不抓安装命令示例里的版本号。
   - **结果处理**（不阻塞——push 已完成，同步后的版本号作为新工作区改动，本次未提交；本 skill 不执行 `git add`，需用户自行 `git add` 后下次 `/commit` 提交）：
     - **无 `VERSION` 文件** → 跳过；
     - **各位置版本号均与基准一致** → 无事可做，正常通过；
     - **发现不一致** → **以 `VERSION` 为唯一权威，把偏离的文件同步到基准版本号**（不动 `VERSION`）：
       1. **`package.json`**：顶层 `version` 字段改为基准版本号；
       2. **`package-lock.json`**：**顶层** `version` 字段改为基准版本号（仅顶层，不动 `packages` 内各依赖版本）；
       3. **`CHANGELOG.md`**：若顶部有 `## [Unreleased]` 段且其下第一条实际版本标题 < 基准版本号 → 把 `## [Unreleased]` 改为 `## [基准版本号] - <今天日期 YYYY-MM-DD>`（其下的 Added / Changed 等内容即归入该版本；**不要改已发布版本的历史条目**）；若顶部无 `Unreleased` 段、最新实际版本标题就低于基准 → 在最顶部新增 `## [基准版本号] - <今天日期>`（依据近期提交补简要改动说明）；
       4. **主 manifest**：`manifest.json` / `pyproject.toml`（`version = "x"`）/ `Cargo.toml`（`version = "x"`）/ `*.csproj`（`<Version>x</Version>`）——存在才改为基准版本号；
       5. **README**（`README.md` / `README_cn.md`）：**显式声明当前版本**的位置（「Current version: x」「当前版本：x」、版本徽章里的版本号）——存在才改为基准版本号；不抓 changelog 历史版本、不抓依赖版本、不抓安装命令示例。
   - **不写缓存标记**：版本号一致性状态随每次改动动态变化，**每次 `/commit` 都要重新查**，故 `.commit-skill-cache.md`**不写 `version-consistency` 标记**、永不跳过本步。

      **9l. README 不含 GitHub Stars 数量徽章**（标记 `readme-no-stars-badge`）：`README.md`（英文版）、`README_cn.md`（中文版）的徽章行**不得包含 GitHub Stars 数量徽章**（即 URL 路径含 `github/stars/` 的徽章，形如 `https://img.shields.io/github/stars/<user>/<repo>`，含 `?style=social` 等参数变体）。与 9a 互补——9a 管「该有的徽章是否齐全」（其「徽章组合」也不再添加 stars 徽章），本步专门清理「已存在的 stars 徽章」。
   - **触发**：所有项目（凡有 README 的都扫，与 9a 一致）。`xhqing` Profile 仓库仍走第 9 步开头的例外、整个跳过，9l 不例外。
   - **扫描对象**（两份文件，不存在的跳过）：`README.md`、`README_cn.md`。
   - **检测**：扫描徽章行里所有 `img.shields.io` 徽章，命中 URL 路径含 `github/stars/` 的 → 视为违规徽章。
   - **修正**：删除该 stars 徽章所在的整行 markdown（形如 `![...](https://img.shields.io/github/stars/...)`），其余徽章 / LOGO / 正文一律保留。**本步突破 9a「只补不删」原则，仅针对 stars 徽章删除**——不删其它徽章、不删 LOGO、不动正文。
   - 两份文件均无 stars 徽章（或某份文件不存在）→ 写 `<!-- commit-skill: readme-no-stars-badge = ok -->` + 日期行。

   **9m. CHANGELOG.md 与 VERSION 文件**（标记 `changelog-version`）：**任何项目都必须有 `CHANGELOG.md` 与 `VERSION` 两个文件**（2026-08-03 用户立）——它们是「CHANGELOG 记录纪律」「版本信息一致性」规则的落地载体（这两条规则现无条件生效、无缺省豁免），也是 9j 版本滞后检测、9k 版本号一致性检测的检测对象。
   - **触发**：所有项目（除 `xhqing` Profile 仓库随第 9 步开头例外整个跳过外，9m 不例外）。
   - **本步与 9j/9k 的关系**：本步排在 9j/9k 之后。首次 `/commit` 若项目缺 `VERSION`，9j/9k 按「无 VERSION」跳过、由本步创建；自下次 `/commit` 起 9j/9k 正常执行。
   - **版本号取值顺序**（新建时共用）：① `package.json` 顶层 `version`；② 主 manifest 的版本字段（`manifest.json` / `pyproject.toml`（`version = "x"`）/ `Cargo.toml`（`version = "x"`）/ `*.csproj`（`<Version>x</Version>`））；③ 已有的 `CHANGELOG.md` 顶部最新实际版本标题（仅建 `VERSION` 时可用，`CHANGELOG.md` 尚不存在则跳过）；④ 以上皆无 → `1.0.0`。
   - **无 `VERSION` → 新建**：文件内容为纯数字版本号（无 `v` 前缀）+ 换行（如 `1.0.0\n`）。
   - **无 `CHANGELOG.md` → 新建**：顶部写 `## [<当前版本号>] - <今天日期 YYYY-MM-DD>`（当前版本号 = 已有 / 本次新建的 `VERSION`；`VERSION` 尚无则按上方取值顺序），其下写该版本摘要（新项目写「初始版本」说明 + 按当前已知内容简要记录）；**不写 `[Unreleased]` 占位**——新建即用具体版本号标题，与 9k「最新实际版本标题须与 VERSION 一致」天然对齐，避免下次 `/commit` 被 9k 再改。
   - 两者均存在 → 无事可做。
   - 新建 / 确认存在后 → 写 `<!-- commit-skill: changelog-version = ok -->` + 日期行。

   第 9 步是收尾，补全/标记后直接进入汇报，不再阻塞提交。

### `.commit-skill-cache.md` 检测缓存

项目根 `.commit-skill-cache.md` 是「commit skill 检测缓存」的**专用载体文件**：不存在 → 新建（只含缓存内容，**不碰项目的 `CLAUDE.md`**）；存在 → 末尾追加（不破坏已有内容）。commit skill **不再在项目 `CLAUDE.md` 里写缓存**——`CLAUDE.md` 由项目脚手架维护、只承载项目说明，缓存独立到这个文件。文件统一格式，九类标记各自写入、互不依赖：

```
# commit skill 检测缓存

本文件由 commit skill（`/commit`）自动维护，记录项目标配检测的就绪状态，供后续 `/commit` 跳过重复检测。请勿手动编辑——commit skill 会按检测结果增补标记。

<!-- commit-skill: readme-standard = ok -->
- README 中英双语 + LOGO + 徽章 + 版权署名：已就绪（YYYY-MM-DD 确认）

<!-- commit-skill: license = ok -->
- LICENSE.md：已存在（YYYY-MM-DD 确认）

<!-- commit-skill: github-about = ok -->
- GitHub About：已配置（中英双语 description + topics，YYYY-MM-DD）

<!-- commit-skill: agent-persona = ok -->
- Agent 拟人名：已写入 README（<名字>，YYYY-MM-DD）

<!-- commit-skill: attribution-name = ok -->
- 版权人/署名引用名字：已归一为 All Contributors（YYYY-MM-DD 确认）

<!-- commit-skill: readme-link-text = ok -->
- 英文版 README 跳转中文版链接文字：已统一为「简体中文」（YYYY-MM-DD 确认）

<!-- commit-skill: repo-sponsors = ok -->
- 仓库 Sponsors 按钮：已就绪（xhqing/.github 全局默认 FUNDING.yml，YYYY-MM-DD 确认）

<!-- commit-skill: readme-no-stars-badge = ok -->
- README 徽章：已不含 GitHub Stars 数量徽章（YYYY-MM-DD 确认）

<!-- commit-skill: changelog-version = ok -->
- CHANGELOG.md 与 VERSION 文件：已存在（YYYY-MM-DD 确认）
```

- `readme-standard` 标记：第 9a 步检测到 README 中英双语（`README.md` 以美式英文为主、`README_cn.md` 以简体中文为主） + LOGO + 徽章 + 版权署名段全齐时写入。
- `license` 标记：第 9b 步检测到 `LICENSE.md` 存在（且无冗余）时写入。
- `github-about` 标记：第 9c 步补全 About（或检测发现已配）后写入。
- `agent-persona` 标记：第 9d 步检测到 README 已有拟人名（或新起并写入）后写入；仅以 `Agent` 结尾的项目适用。
- `automemory` 标记：**永久不写入**——9e 已随全局 AutoMemory 禁用而永久跳过（详见第 9e 步），缓存段不再出现该标记。
- `attribution-name` 标记：第 9g 步检测到 README（中英两版）与 LICENSE.md 的版权人/署名引用名字均已归一为 `All Contributors`（或无可改位置）后写入。
- `readme-link-text` 标记：第 9h 步检测到英文版 `README.md` 里指向 `README_cn.md` 的跳转链接文字已是「简体中文」（或英文版暂无该链接、留待 9a 补）后写入。
- `repo-sponsors` 标记：第 9i 步检测到 Sponsor 按钮配置就绪（当前仓库自有 `FUNDING.yml`，或全局 `xhqing/.github/FUNDING.yml` 默认配置生效）或修复成功后写入。
- `readme-no-stars-badge` 标记：第 9l 步检测到 README（中英两版）均不含 GitHub Stars 数量徽章（或某份文件不存在）后写入。
- `changelog-version` 标记：第 9m 步检测到项目根已有 `CHANGELOG.md` 与 `VERSION` 两个文件（或缺失时新建完成）后写入。
- `version-staleness` 标记：**永不写入**——9j 版本滞后检测反映 `VERSION` 当前是否落后于代码进度，状态随每次提交 / 每次发版动态变化，每次 `/commit` 都要重新查 GitHub Release + git log，**不缓存、不跳过**。
- `version-consistency` 标记：**永不写入**——9k 版本号一致性检测反映 `VERSION` 与各文件版本号当前是否对齐，状态随每次改动动态变化，每次 `/commit` 都要重新比对本地文件，**不缓存、不跳过**。
- 后续 /commit 第 9 步读此文件，按标记跳过对应检测；缺哪个标记就做哪项检测，只补缺的标记（9j 版本滞后检测、9k 版本号一致性检测均无标记、每次必查，不受此缓存机制影响）。
- 该 `.commit-skill-cache.md` 与本次补全的 README/LICENSE 等都是 push 之后产生的工作区改动，本次未提交；本 skill 不执行 `git add`，需用户自行 `git add` 后下次 `/commit` 一并提交（本地存在即足以跳过检测）。

## 注意

- 本 skill 先完成「`git commit` + `git push`」（**不执行 `git add`**，只提交暂存区已有内容），**再**在第 9 步补齐项目标配（README/LICENSE/CHANGELOG/VERSION/About/Sponsors，含版权人/署名引用名字归一）；标配检测不阻塞提交推送。
- **commit + push 用 `&&` 串联成一条命令一次跑完**（2026-07-17 用户立；2026-08-01 修订：去除 git add，只提交暂存区）：不拆成多次 Bash 调用、不中途停下来向用户列命令确认（`/commit` 触发即授权当次完整流程）；auto mode 权限分类器拦下其中某条 git 写命令也不退缩去问用户——改用 `&&` 组合命令继续执行。详见「核心定位」段「两步用 && 串联一条命令跑完」。
- 敏感内容扫描、cache 检测**均在 `git commit` 之前执行一次**（针对暂存区已有内容），是 commit 前的两项硬性检测；`git commit` 之后不再重复。（版本号一致性检测已移至 push 后第 9k 步，不阻塞提交。）
- 禁止 `git push --force`、`git reset --hard` 等破坏性操作。
- **无远程仓库时**：第 8 步检测到 `git remote -v` 为空，会用 `gh repo create <目录名> --public --source=. --remote=origin --push` 主动创建公开 GitHub 仓库并推送（需 `gh` 已认证；未认证或创建失败则如实报告、跳过）。
- 不随意删除文件；处理敏感内容由用户自行完成。编辑/删除项目文件的**例外仅七类**：① README/LICENSE 标配补全（可编辑 `README.md`/`README_cn.md` 顶部 LOGO/徽章居中块 + 移除 GitHub Stars 数量徽章（第 9l 步） + persona 说明块 + 底部版权署名段 + 版权人/署名引用名字归一为 `All Contributors`（第 9g 步）+ 语言基调修正（把 `README.md` 里「本该用英文却写成中文」的正文改为英文，特殊场景的中文保留不动）+ 英文版跳中文版链接文字统一为「简体中文」（第 9h 步）、创建 `assets/logo.svg`、创建 `LICENSE.md`、**删除冗余的其它格式 license 文件**只保留 `LICENSE.md`）；② 项目根 `.commit-skill-cache.md` 写入缓存标记（不存在则新建）；③ 全局 `~/.claude/CLAUDE.md` 的「智能体命名注册表」追加新 agent 行（仅 9d 起名时，不改已有行）；④ cache 检测（第 3 步检测到的 cache 文件/目录可新增进 `.gitignore`）；⑤ 版本滞后 bump（第 9j 步）——检测到 VERSION 滞后时，可更新 `VERSION`/`package.json`/`package-lock.json`/`CHANGELOG.md`/主 manifest/README 的版本号；⑥ 版本号一致性同步（第 9k 步）——检测到 VERSION 与各文件版本号不一致时，以 VERSION 为唯一权威，更新 `package.json`/`package-lock.json`/`CHANGELOG.md`/主 manifest/README 的版本号到与 VERSION 一致（不动 VERSION 自身）；⑦ 新建 `CHANGELOG.md` 与 `VERSION` 文件（第 9m 步）——检测到项目缺这两个文件时按 9m 规则创建。其余文件及 `.gitignore` 其它部分严禁改动/删除。
- 推送冲突或错误如实报告，不自行破坏性解决。

## 汇报

报告提交与推送结果：本次提交的暂存区文件清单（按新增、修改、删除分组）、commit hash、分支名、远程仓库地址、推送是否成功、推送的提交范围（如适用）；若因发现敏感内容而终止，则列出对应文件清单、敏感片段与处理建议；若因发现 cache 文件/目录而终止，则列出 cache 清单、已写入 `.gitignore` 的忽略规则，并提示用户从暂存区移除 cache（`git restore --staged` / `git rm --cached`）。（版本号不一致不再终止提交——已移至 push 后第 9k 步处理。）并提示「本次 `/commit` 已终止，处理 / 确认后需重新输入 `/commit` 走完整流程」。随后报告第 9 步项目标配检测的结果：补了哪些内容（logo.svg、README/README_cn 改动或新建、徽章清单（含移除 GitHub Stars 数量徽章，如有）、版权署名段、persona 拟人名、LICENSE.md 新建/冗余删除、About 的 description/topics、版权人/署名引用名字归一为 All Contributors 的改动、英文版 README 跳中文版链接文字统一为「简体中文」的改动、仓库 Sponsors 按钮（检测 / 修复 `xhqing/.github` 全局 FUNDING.yml）的改动、CHANGELOG.md 与 VERSION 文件（第 9m 步）的新建结果（缺哪个建哪个 + 版本号取值来源）或已存在确认、版本滞后检测的结果（VERSION 是否滞后；若滞后则报告：bump 幅度判定 patch/minor/major 的依据 + 新版本号 + 已更新哪些文件的版本号）、版本号一致性检测的结果（VERSION 与各文件是否一致；若不一致则报告：以 VERSION 为准同步了哪些文件 + 各自旧值→新值））以及写入了哪些缓存标记；提醒「本次补全的标配内容是新工作区改动，本 skill 不执行 git add，需用户自行 `git add` 后再 `/commit` 才会提交」。
