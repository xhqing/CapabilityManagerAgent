# Changelog

本项目（CapabilityManagerAgent）是智能体舰队通用能力底座的**开源镜像仓库**：`claude/`（2026-08-03 起从 `.claude/` 迁入）下的 `skills` / `CLAUDE.md` / `docs` 三部分（全局规则随 CLAUDE.md 走；原 `~/.claude/rules/` 目录已废弃删除，2026-09-14 起文档口径统一）与全局权威源 `~/.claude/` 逐字节一致（2026-08-04 起权威方向反转：全局为权威、本项目 `claude/` 为镜像）。本 CHANGELOG 记录**通用能力底座的变更**——即 `claude/` 镜像范围的增删改，以及全局 ↔ 本项目镜像的同步动作。

> 按全局 CLAUDE.md「同步动作只记权威源的 CHANGELOG」规矩：通用能力的同步只记本文件，**不记到各业务 agent 项目**（如 DayTradingAgent 等）的 CHANGELOG，避免污染那些项目自己的变更记录。

## [1.3.0] - 2026-10-04

新增会话保护工具链与跨会话委派授权：`session-guard`（pi 端扩展，禁止关闭用户终端里的前台 pi 会话与危险 tmux 操作，与 CC 钩子规则 8 同源）、`session-sweep`（后台会话清扫器，默认干跑、`--kill` 才动手）；`AI_AUTHORIZED_COMMIT` 明确授权扩为四种形式（新增跨会话委派）；详见下方 2026-10-04 分节。

## [1.2.1] - 2026-10-04

release skill 产物核查改为「以项目声明为准」（取消「历史 assets」信号），同步全局 `~/.claude/CLAUDE.md` 的 `/release` 限定与本仓库「不带产物」发版声明；详见下方 2026-10-04 分节。

## [1.2.0] - 2026-10-04

新增 `kdbx-guard`（密码库 / 密钥文件的删除 / 移动 / 覆盖硬拦截，防 AI 误删经文件同步传播到两端）并收紧 commit 判定（文本提及不再误触发守卫）；详见下方 2026-10-04 分节。

## [1.1.0] - 2026-10-03

自 1.0.0 以来的通用能力变更汇总（每项详情见下方各日期分节）：新增 pre-commit 凭证扫描 skill、auto-rc 预发布工作流、`agent-call` 跨会话协作扩展与 `version-guard` 版本一致性守卫扩展；实现发版自动链（`/commit` 第 10 步自动衔接 `/bump` → `/add` → `/commit` → `/release`）与 `/add` 预检完全干净后自动衔接提交推送；新增敏感扫描白名单机制、修正 gitleaks 单路径调用；开源镜像扩展至六部分；dev-workflow 修订测试产物不单独提交、不单独开 PR；release skill 新增公开文本发布前敏感自检（notes / tag message 定稿后、公开动作前检测，2026-10-03）。

## 2026-10-04

### 新增（kdbx-guard：密码库 / 密钥文件的删除与覆盖硬拦截）

- **为什么做**：2026-10-04 用户在配置 KeePass 双端同步（Syncthing 手机 ↔ Mac）时明确提出「担心 AI 误删电脑端数据库文件」。风险是复合的：数据库内容丢了无法重建，而文件同步的语义是「两端完全一致」——**本机删除会传播到对端**，一次误删 = 两端同时失去数据（对端只剩 `.stversions` 里一份需人工取回的归档）。此前只有文本纪律（「增改查优先、慎用删除」），对这类文件没有任何硬闸。
- **改了什么**：
  ① 新增 pi 端扩展 `pi/agent/extensions/kdbx-guard.ts`（tool_call 拦截，两端同源判定）：A) 写 / 编辑类工具（write / edit）命中受保护路径直接 deny（无逃生门）；B) bash / powershell 的删除 / 移动 / 清空动作（`rm` / `mv` / `unlink` / `shred` / `trash` / `truncate`、`find -delete`、`>` 重定向覆盖）命中受保护路径时 deny，命令带标记 `AI_AUTHORIZED_KDBX_OP` 放行。
  ② `~/.claude/hooks/pre-tool-use-guard.sh` 新增**规则 7**（Bash 删除 / 移动 / 覆盖）与**规则 7 前置段**（Write / Edit / MultiEdit / NotebookEdit 等写类工具按 `file_path` 拦截；因该段需在 Bash 早退之前执行，`deny_msg()` 函数定义上移到脚本前部）；与 pi 端判定逻辑逐条对齐。
  ③ 受保护目标：任何含 `.kdbx` 的路径、`~/Key/` 与 `/Key/` 下的密钥文件、含 `KeePass` 的目录、`~/Sync` 同步根目录（覆盖 `rm -rf ~/Sync` 这类连窝端与 `rm -rf ~/Sync/KeePass/*` 这类通配删除）。绝对路径统一写作 `/Users/[^/]+/Sync` 通配、**不硬编码个人路径**（仓库既有规范：脚本统一用 `~` / `$HOME` 展开、便于开源镜像直接复用）；首版实现曾写成 `/Users/<本机用户名>/Sync` 字面量，/add 预检被拦下后改为通配形态。
  ④ 全局 `~/.claude/CLAUDE.md`「工作规则」新增子节「**密码库与密钥文件不得删除 / 移动（钩子已硬拦截）**」——说明保护对象、拦截动作、逃生门，以及「正常使用不触发本规则」的边界（读写密码库由 KeePassXC / KeePassDX 自身完成，不需要 AI 碰文件）。
- **测试**：同组 25 用例对照测试（Bash 删除 / 移动 / 覆盖 11、写类工具 4、既有规则回归 10），CC 端 25/25；pi 端另用 15 用例组验证 15/15，逐条结果一致。边界用例覆盖「带 `AI_AUTHORIZED_KDBX_OP` 标记放行」「普通 `rm -rf ~/Downloads/junk` / `mv` 放行」「`read` 工具读库放行」「`rm -rf ~/Sync` 连窝端拦截」。可移植化改造后两端各重跑 13 例路径匹配测试（绝对路径当前用户 / 任意用户、`~` / `$HOME` 形态、通配删除、带标记放行、普通删除与「别的路径含 Sync」不误伤）13/13、13/13。
- **镜像同步**：`claude/hooks/pre-tool-use-guard.sh`、`claude/CLAUDE.md`、`pi/agent/extensions/kdbx-guard.ts` 已同步；六部分 diff 核对一致。

### 变更（commit 判定收紧：文本提及不再误触发守卫）

- **为什么改**：当日 kdbx-guard 的测试里，把测试用例写成 JSON 字符串喂给 CC 钩子，其中一条 payload 含 `"command":"git commit -m test # AI_AUTHORIZED_COMMIT"`——pi 端 `git-status-guard.ts` 的判定是「命令里同时出现 `AI_AUTHORIZED_COMMIT` 与 `git commit`」（全文包含式匹配），于是把这段**文本**误判成「本次 run 发生过授权 commit」，强制要求在最终回复里贴 `git status` 块（还让用户误以为真的执行了 commit）。同一原因下 `git-commit-guard.ts` 与 CC 钩子规则 3 也会对含这类文本的命令误报拦截。误伤方向虽安全（多拦 / 多提醒，不放松），但造成困惑、且掩盖了真正的触发信号。
- **改了什么**：三处判定统一收紧为「**按 `&&` / `||` / `;` / `|` / 换行切分命令段后，只认段首为 `git` 的命令段**」——
  ① pi 端 `pi/agent/extensions/git-commit-guard.ts`：新增 `SEGMENT_SPLIT` + `GIT_COMMIT_SEGMENT` 常量与 `hasGitCommit()` 函数，替换原全文包含式正则；
  ② pi 端 `pi/agent/extensions/git-status-guard.ts`：同源复制同一判定（`isAuthorizedCommit` 改为「命令含标记 + 存在 git commit 段」）；
  ③ `~/.claude/hooks/pre-tool-use-guard.sh` 规则 3：新增 `is_git_command()` 辅助函数（切段 → 去前导空白 → 段首必须 `git` → 子命令匹配），规则 3 改用它（规则 5 / 6 暂未改，属同族、可按需再收）。
- **合法路径不受影响**：`/commit` skill 的真实写法 `git commit -m "<msg>" && git push # AI_AUTHORIZED_COMMIT` 仍照常识别（切段后首个 `git` 开头的段命中 `commit`；标记在整条命令里、不要求与 commit 同段）；`cd <repo> && git commit ...`、`git -C <repo> commit ...`、`git status ; git commit ...` 同样命中；`git log --grep=commit`、`git commit-tree` 仍不命中。
- **测试**：pi 端 12 用例（含 skill 串联写法、`cd` / `git -C` / 分号串联、`git log --grep=commit`、`commit-tree`、文本提及两例）全部通过；CC 端 18 用例（规则 3 处理 11 + 规则 7 回归 4 + 规则 1/2/6 与普通命令回归 3）全部通过；两端结论一致。
- **镜像同步**：`claude/hooks/pre-tool-use-guard.sh`、`pi/agent/extensions/git-commit-guard.ts`、`pi/agent/extensions/git-status-guard.ts` 已同步；六部分 diff 核对一致。

### 新增（session-sweep：后台会话清扫器 + 用完即清 / 不活跃即清规矩）

- **为什么做**：用户 2026-10-04 明确——「**我看不到后台会话，后台会话对我来说等于不存在**」，要求「只要不活跃都要清理掉，或者用完就清理掉」。现状是代际遗田：tmux 里挂着一堆 `pi-<名字>` 后台会话（实测 21 个），其中 19 个已空闲约 29 小时（10-03 团队批量化唤醒留下），而且全部无 tmux 客户端附着（= 没人看得见）；光靠「下次记得清」的文本纪律不可靠，需要工具。
- **改了什么**：
  ① 全局 `~/.claude/CLAUDE.md`「会话间协作」节新增一条「**后台会话用完即清、不活跃即清**」：用完就清（`agent_call` / `agent_wake` 拉起的会话完成使命后主动 `tmux kill-session`，下次需要会重新唤醒）；不活跃就清（空闲 ≥ 30 分钟且无人在看）；明确「不能自作主张清」的四类（真实 tty 上的会话、30 分钟内有活动、活跃工作流等反馈、拿不准的情况）；给出「无人在看」「空闲」的判定方法（tmux 附着计数 + 会话记录文件 mtime，含 slug 推导规则）。
  ② 新增 `patch/session-sweep/session-sweep.py`（可移植、无硬编码个人路径）：默认干跑列出候选与保留理由，`--kill` 才真关闭；支持 `--idle-min` / `--exclude` / `--kill-unknown` / `--json`；安全阀——只动 `pi-` 前缀、有客户端附着的跳过、非 tmux 的 pi 进程不动、记录文件匹配不到的默认不动。会话→记录文件的映射用「进程启动时间 ↔ 文件名 UTC 时间戳」（实测误差 0–1 秒）。
- **当时执行的清理**：20 个后台会话（含 19 个空闲 ≈ 29 小时 + 1 个从未使用的空会话 `pi-vendy`）已关闭，0 失败；`pi-Victor`（27 分钟前还在活跃工作流里等反馈）按规矩保留。另有 2 个非 tmux 的 tty 会话（GrowthMarketerAgent / CommunityManagerAgent）属用户可见范围，未动。
- **镜像同步**：`claude/CLAUDE.md`、`claude/patch/session-sweep/session-sweep.py` 已同步；六部分 diff 核对一致。

### 变更（会话保护 + 跨会话委派提交：两条新规矩配套工具强制）

- **为什么做**：用户在「后台会话用完即清」立规后立刻补了两条边界与一条授权——
  ① **终端窗口里的 pi 会话（前台）由用户本人操作，禁止 agent 用命令关闭**（他看得见这些会话、会自己处理）。风险很实：`pkill -f "pi -n"`、`kill <pid>`、`tmux kill-server` 这三类写法都会误伤用户正在用的会话（`kill-server` 更是把用户自己的 tmux 会话一起端掉）。
  ② **其它 agent 的仓库有待提交内容时自动委派**：用户原话「每次检查到或者得知其它 Agent 的仓库有需要 commit 的内容就自动 call 这个 agent 使用 /add skill 或 /commit skill 处理一下，不要每次都问我」——把「跨会话委派提交」升为常设授权，省去反复确认。
- **改了什么**：
  ① 全局 `~/.claude/CLAUDE.md`：「Git 写操作必须先征得同意」节新增「常设授权：其它 agent 仓库有待提交内容 → 自动委派，不必询问用户」条目；「Git 暂存区禁止 AI 自主增删改」节把 commit 的明确授权从「三种形式」扩为「**四种形式**」（新增 ④ 跨会话委派）；「工作规则 · 会话间协作」节新增同一条的完整条目（含授权边界：只允许委派对方按它自己的 skill 流程提交，不得由本会话替对方仓库执行 git 写操作）；「后台会话」条目新增子条「**用户终端里的会话（前台）一律不许用命令关闭**」（禁止 kill/pkill/killall 打 pi 进程、禁止 `tmux kill-server` 与指向非 `pi-` 名字的 `kill-session`；关闭后台会话只能 `tmux kill-session -t <pi-名字>`）。
  ② 新增 pi 端扩展 `pi/agent/extensions/session-guard.ts`（与 CC 钩子规则 8 同源）：拦 `tmux kill-server`、拦指向非 `pi-` 名字的 `tmux kill-session`、拦打 pi 进程的 `kill` / `pkill` / `killall`（两种识别方式：命令文本出现 pi 特征；或目标是具体 pid 且实测 `ps` 显示该进程就是 `pi`——用于抓裸 `kill <pid>`）；逃生门标记 `AI_AUTHORIZED_SESSION_KILL`。
  ③ `~/.claude/hooks/pre-tool-use-guard.sh` 新增**规则 8**（同源判定）；规则 3 与 pi 端 `git-commit-guard.ts` 的 deny 消息、`skills/commit/SKILL.md` 的标记说明同步补上第四种授权形式。
- **测试**：pi 端 14 用例、CC 端 17 用例（含 tmux 两类、kill/pkill/killall、按 pid 实测识别、合法路径 `tmux kill-session -t pi-*` 放行、带标记放行，以及规则 2 / 7 的回归），两端全部通过。
- **镜像同步**：`claude/CLAUDE.md`、`claude/skills/commit/SKILL.md`、`claude/hooks/pre-tool-use-guard.sh`、`pi/agent/extensions/session-guard.ts`、`pi/agent/extensions/git-commit-guard.ts` 已同步；六部分 diff 核对一致。

### 变更（release skill 产物核查改为「以项目声明为准」；本项目声明不带产物）

- **为什么改**：2026-10-04 用户立规——发版产物问题「以后不要再询问」。背景：v1.1.0 / v1.2.0 发版时 release skill 第 7 步按「本仓库历史 Release 挂过 assets」（v1.0.0 在案）暂停等待裁决；用户说明 v1.0.0 的 assets 是当时**借 Release 作备份**、并非发布惯例——该历史信号在本仓库属假信号。同时用户要求不能一刀切「全局一律不带产物」：VSCE / 二进制类项目的产物是安装链路必需品（如 vsce-install 从 Release 取 vsix），一刀切会静默破坏那些项目。
- **改了什么**：① `skills/release/SKILL.md` 第 7 步重写为「产物核查（以项目声明为准）」——**取消「本仓库历史 assets」信号**；「项目规则 / 文档 / 项目 skill / cache 明确声明要产物」「仓库存在 tag 触发产物 workflow，或 README 下载链接指向 Release 产物」「fork upstream 同名 tag 挂 assets」任一命中（= 已声明）→ 照常构建上传；未声明 → 默认不带产物、直接发布、不再询问。「注意」段与 description 同步。② 全局 `~/.claude/CLAUDE.md`「/release」授权段补限定：产物按项目声明为准，未声明默认不带、不询问。③ 本项目根 `CLAUDE.md` 增加项目级发版声明「本仓库发版不带产物（历史 v1.0.0 assets 属借用备份，不代表惯例）」。
- **镜像同步**：`claude/skills/release/SKILL.md`、`claude/CLAUDE.md` 已同步（`diff` 逐字节一致；`~/.pi/agent/skills` 与 `~/.claude/skills` 同 inode，自动跟随）。
- **关联**：v1.2.0 已于本日前序发布（用户裁决：不带产物）；本改动经 `/add` → `/commit` 自动链提交，并随自动发版链发布。

## 2026-10-03

### 变更（release skill：公开文本发布前敏感自检）

- **为什么做**：release skill 对外公开的文字内容（Release notes、annotated tag message）此前没有独立的敏感信息检测环节——既有的三道防线（add 预检、commit 暂存区扫描、gitleaks pre-commit hook）全发生在「文件进仓库」环节；而 release 对外文本有三个路径不在扫描链内：① CHANGELOG 缺条目时的手写 notes；② `--generate-notes` 现场生成的文本；③ 翻译现场生成的新文字（信息源自已扫过的 CHANGELOG，但属现场生成、无复核环节）。Release 一旦发布即面向全球公开（Release 页面、通知、RSS 分发），曝光面大于仓库文件本身，需要补一道发布前最后防线。
- **改了什么**：`skills/release/SKILL.md` 第 4 步新增「**公开文本敏感自检（打 tag 前必做）**」子段——
  ① **时机**：notes 与 tag message 定稿后、任何公开动作（打 tag / 推 tag / 建 Release）之前；
  ② **对象**：notes 文本与 tag message 文本（同源时合并扫一份、有差异分别扫；title 由项目名 + 版本号构成、不专门检测）；
  ③ **方式**：工具 + 语义两层（口径与 /add 预检一致）——待发布文本写入 `tmp/` 临时文件跑 gitleaks（缺失 / 失败降级 AI 正则扫描并标注），AI 逐段检查三类敏感内容（财务状况 / 个人隐私标识 / 敏感叙述，拿不准按可疑处理），白名单联动 `.commit-cache.md`（范围外照常扫、凭证实值不适用白名单）；
  ④ **`--generate-notes` 来源**：改用 `gh api .../releases/generate-notes` 预生成文本 → 自检 → `--notes-file` 传入（保持「自检早于公开」不变量）；
  ⑤ **命中处理**：暂停本次发布（不 tag、不推、不建 Release）、报告命中内容与处理建议，用户处理后重新触发 `/release`（白名单条目当次追加、下次起效，与 /commit 机制一致）；自检通过（含白名单跳过）在汇报中注明。
  同步更新：授权语义异常清单新增第 6 条（公开文本敏感自检命中）、预发布通道「流程差异」句补「无论 notes 来源为何均须过自检」、注意节与汇报节、description（656/1024 字符）。
- **镜像同步**：`claude/skills/release/SKILL.md` 已同步（pi 端与全局为同一硬链接文件，编辑即两端生效）；其余五部分未动。

### 新增（release-guard：发布公开动作敏感自检硬拦截）

- **为什么做**：按「规矩必须配套工具强制」元规则，为同日新增的 release skill「公开文本敏感自检」配套硬拦截——此前自检只靠文本纪律，若执行者跳过自检直接打 tag / 发 Release，未检查的文本（tag message / Release notes）即公开且事后无拦截点。
- **改了什么**：
  ① 新增 pi 端扩展 `pi/agent/extensions/release-guard.ts`（tool_call 拦截）：命令未带标记 `AI_SENSITIVE_CHECKED` 时，对三类公开发布动作一律 deny——打 annotated tag（`-a`/`--annotate`/`-m`/`--message`/`-F`/`--file`）、推送 tag（`--tags`/`--follow-tags`/`refs/tags/`/refspec 形如版本号）、`gh release create|edit`；查询类（`git tag -l`、`git push` 普通分支、`gh release view/list`）与本地删除类（`git tag -d`）不拦。
  ② `~/.claude/hooks/pre-tool-use-guard.sh` 新增**规则 6**（CC / CodeBuddy 等端，与 pi 端判定逻辑对齐、两端同步改）；`release-guard.ts` 与其余 guard 同构（防御性 catch、不阻塞会话）。
  ③ `skills/release/SKILL.md`：第 4 步自检子段补「完成后的放行标记（工具强制）」条目，第 5-7 步命令示例带 `# AI_SENSITIVE_CHECKED` 标记，注意节补 release-guard 说明（description 656/1024 不变）。
- **测试**：两端同组 29 用例对照测试（tag 创建 9、tag 推送 8、gh release 6、标记放行 3、无关命令 3），CC 端 29/29、pi 端 29/29、逐条结果一致。
- **镜像同步**：`claude/skills/release/SKILL.md`、`claude/hooks/pre-tool-use-guard.sh`、`pi/agent/extensions/release-guard.ts` 已同步；其余部分未动。

### 变更（public-text-guard：范围扩展至 PR / Issue 公开文本；commit / dev-workflow skill 配套）

- **为什么做**：PR title / body、Issue 文本、commit message 与 Release notes 一样是「会发出去的公开文字」，但此前不在任何扫描链内——文件内容有三道防线（add 预检 / commit 扫描 / gitleaks hook），这些**现场生成的文本**是空白；PR body 还是 AI 基于 diff 的自由概括，最容易从对话上下文带出敏感信息（100% 真实事故类型：敏感信息进 git 历史只能 filter-repo 重写）。用户 2026-10-03 要求补齐三项（skill 纪律 + PR / Issue 工具拦截 + commit message 纪律）。
- **改了什么**：
  ① pi 端扩展 `release-guard.ts` **更名为 `public-text-guard.ts`** 并扩展范围——新增 `gh pr create|edit`、`gh issue create|edit` 两类拦截（原覆盖打 tagged tag / 推 tag / Release 创建编辑不变）；更名原因：职责已从「发布链」扩到「一切公开文本」。判定逻辑与 CC 端保持一致。
  ② `~/.claude/hooks/pre-tool-use-guard.sh` 规则 6 同步扩展（加 PR / Issue 正则；注释与 deny 消息更新为 public-text-guard）。
  ③ `skills/commit/SKILL.md`：新增「公开文本敏感自检（commit message / PR / Issue）」节（时机、两层检测方式、工具强制说明）；第 6 步（生成 commit message 后自检）、第 8 步两处 `gh pr create`（带 `# AI_SENSITIVE_CHECKED` 标记 + 建前自检）同步；description 更新（997/1024）。
  ④ `skills/dev-workflow/SKILL.md`：第 7 步 PR 命令带标记 + 「建 PR 前先过公开文本自检」bullet；第 1 步 `gh issue create` 补「公开前自检、带标记」；授权边界段两条创建命令补标记要求；description 更新。
  ⑤ `skills/release/SKILL.md`：守卫引用全面更名（release-guard → public-text-guard）+ 补「同时覆盖 PR / Issue」指向。
- **测试**：两端同组 40 用例对照测试（新增 PR / Issue 用例 14 条），CC 端 40/40、pi 端 40/40、逐条一致；实机验证（无头 pi 加载扩展）：无标记 `gh pr create` 被拦截未执行、带标记 `gh issue create` 放行执行（测试环境无 remote、gh 自身报错，与守卫无关）。
- **镜像同步**：`claude/skills/commit|dev-workflow|release/SKILL.md`、`claude/hooks/pre-tool-use-guard.sh`、`pi/agent/extensions/public-text-guard.ts`（旧 `release-guard.ts` 删除）已同步；其余部分未动。

## 2026-10-02

### 变更（发版自动链扩展：未就绪自动 /bump → /add，全链自动化）

- **为什么做**：用户 2026-10-02 追加要求——「不要提示我 /bump：如果检测出来需要先 /bump 则自动触发 /bump，bump 之后自动触发 /add」。上一版（同日前述条目）实现为「版本未就绪时不触发 release、**提示**先 /bump」；用户要求把 bump 环节也自动化，使 commit 流程在检测到「有新提交但版本未就绪」时直接补齐版本并一路发版，全程不提示、不询问。
- **改了什么**：
  ① `skills/commit/SKILL.md`：第 10 步「版本就绪检查」由「未就绪 → 不触发 + 提示」改为「未就绪 → **自动进入 `/bump` 完整流程** → bump 第 5 步自动衔接 `/add` → 预检干净时继续自动衔接 `/commit`（bump 提交经 PR + CI 合并、9z 对齐 main）→ 回到第 10 步（版本已就绪）→ `/release` 完成发版」；新增**防循环条款**（若本次 commit 本身是 bump 链条产物而仍未就绪，停止报告、不再触发第二次 bump）。description、前言段、核心定位段、9j（正文与第 4 点）、「严禁编辑项目文件」例外清单（七类 → 八类，新增第 ⑧ 类：bump 链条中版本号文件改动由 `/bump` 环节按其职责执行）、汇报段同步。
  ② `skills/bump/SKILL.md`：第 5 步由「指引用户 `git add` + `/commit`」改为「**自动衔接 `/add`**（候选集 = 第 4 步改动文件清单）→ 预检完全干净时继续自动衔接 commit skill → 自动发版」；保留「只 bump、不要提交」逃生口（输出旧式手动指引）；职责边界表、第 6/7 步、description、边界段同步。
  ③ `skills/add/SKILL.md`：触发来源与 git add 授权补「bump skill 改完版本号文件后的自动衔接（2026-10-02 起）」；第 0 步候选集补「bump 传入的改动文件清单」；第 7 步报告组织、与其他 skill 衔接段同步（新增 bump 衔接说明）。
  ④ `skills/release/SKILL.md`：description、授权语义来源②、预发布「试用后处置」段同步为「未就绪 → 先自动走 /bump → /add → /commit 链条补齐、就绪后进入本流程」。
  ⑤ `skills/dev-workflow/SKILL.md`：发版口径更新为全自动链（`/bump` → `/add` → `/commit` → `/release`；入口两种：用户主动 `/bump`、或 commit 流程检测到未 bump 自动触发）；核心逻辑段、第 10 步、正式发版段、授权段四处同步。
  ⑥ 全局 `CLAUDE.md`：授权例外段新增 `/bump` 描述（用户主动 / commit 自动衔接 = 预授权整条链）、`/add` 与 `/release` 描述更新为自动 bump 链条；暂存区授权形式③、git add 例外段补 bump 来源。
- **设计要点与回归风险**：全自动链使「功能合并后对 main 的 `/commit` / `/add` 链条会连带自动完成 bump 与正式发版」——这改变了 dev-workflow 原「正式发布由用户验收后触发（`/bump` + `/release` 人工门禁）」的落点，已在 dev-workflow 中如实标注（「试用要在发版链被触发前完成；如需收紧门禁需修订该段与 commit skill 第 10 步」），并向用户汇报此影响。防循环条款保证链条不无限递归；`git-commit-guard` / `pre-tool-use-guard` 判定逻辑未变（授权场景③的语义仍为「/add 预检完全干净后的自动衔接」，/add 的来源不影响该条件）。
- **镜像同步**：`claude/skills/commit|release|add|bump|dev-workflow/SKILL.md`、`claude/CLAUDE.md` 已同步；六部分 diff 核对除本机私有文件（anysearch/.env、backup/endpoints/endpoints.json、scroll-reverser/local/config.md）与 `__pycache__` 本机产物外逐字节一致。

### 变更（commit skill：流程末尾自动衔接 /release 发版）

- **为什么做**：用户 2026-10-02 立规——「全局 commit skill 最后 commit 成功之后加一个判断：如果工作区干净且暂存区也干净、且有新功能或新修复需要发版，则直接自动触发 /release skill 开启发版流程」。原状：正式发版需用户手动 `/release`（三段式 `/bump` → `/commit` → `/release` 的最后一段），bump 之后的发版动作还要用户再介入一次。
- **改了什么**：
  ① `skills/commit/SKILL.md`：新增**第 10 步「自动衔接发版检测」**（原第 10 步 `git status` 收尾顺延为第 11 步）——前置条件：本次 commit + push 成功（PR 通道须 9z 已合并对齐）、在 main 且与远端同步、**工作区与暂存区干净**（`git status --porcelain` 为空）、存在 VERSION 且 gh 就绪；判定：① 自最新 tag 有新提交（无 tag 即首次发版），② 版本就绪（VERSION 未发布 + CHANGELOG 顶部一致）——两者全满足则直接进入 `/release` 完整流程，未就绪则按 9j 口径提示先 `/bump`（bump 后的 `/commit` 自动发版）。description、核心定位段、9z 引用、注意段、汇报段、9j 指引同步更新。
  ② `skills/release/SKILL.md`：授权语义改为**触发来源两种**（用户主动输入 / commit skill 第 10 步自动衔接——预授权链路、无需二次确认；自动衔接下执行流程一步不省）；description 与预发布「试用后处置」段同步。
  ③ `skills/add/SKILL.md`：预检完全干净自动衔接 commit 的链条明确**延伸到自动发版**——满足发版条件时继续自动衔接 `/release`（授权边界第 3 条、第 7 步列举、报告组织、衔接段、description 五处同步）。
  ④ `skills/dev-workflow/SKILL.md`：验收门禁口径更新——「`/bump` 由用户主动触发即验收通过的表达；bump 后的 `/commit` 自动衔接 `/release` 完成发版」，核心逻辑段、第 10 步、验收段、授权段四处同步。
  ⑤ `skills/bump/SKILL.md`：description、三段式表格、第 7 步汇报同步「无需手动 `/release`，commit skill 第 10 步自动衔接」。
  ⑥ 全局 `CLAUDE.md` 三处：`/release` 授权例外段补「触发来源两种 + 自动衔接预授权」；`/add` 授权自动延伸段补「满足条件时继续自动衔接触发 `/release`」；暂存区授权形式③同步。
  ⑦ `pi/agent/extensions/git-status-guard.ts`：注释与 notify 文本里的「commit skill 第 10 步」（指 git status 收尾）随步骤编号改为「第 11 步」（判定逻辑不变）。
- **设计要点**：**「版本就绪」作为触发条件是刻意的**——未 bump 时触发 `/release` 会撞上 release 第 3 步「tag 已存在」的异常暂停（报 tag 冲突、要用户从「force push / 补发 / 保持现状」里选），而真正待办是 `/bump`；release 第 0 步的版本就绪校验只管「VERSION 与 CHANGELOG 是否一致」，拦不住「一致地停在已发布版本上」的情形。把 bump 提示留在 9j / 第 10 步更准确（未就绪 → 提示 `/bump` → bump 后 `/commit` 自动发版）。与 dev-workflow 验收门禁的交互：主路径变为「用户验收满意 → `/bump`（用户主动 = 验收通过的表达）→ `/commit` → 自动发版」，发版动作自动化不改变「正式发布以用户试用满意为前提」——未 bump 不会自动发版（回归风险已评估、口径已同步）。
- **镜像同步**：`claude/skills/commit|release|add|bump|dev-workflow/SKILL.md`、`claude/CLAUDE.md`、`pi/agent/extensions/git-status-guard.ts` 已同步；六部分 diff 核对除本机私有文件（anysearch/.env、backup/endpoints/endpoints.json、scroll-reverser/local/config.md）与 `__pycache__` 本机产物外逐字节一致。

### 新增（skill：wechat-mac-ops —— 微信 Mac 客户端操作；当日迁出到项目，见下方更正）

> **归属更正（2026-10-02，同日）**：本 skill 起初按「通用能力」建在全局 `~/.claude/skills/` 并镜像到本项目；同日晚些时候用户裁定「这是 Gatsby 的专属 skill，放 CommunityManagerAgent 本项目，不放全局」，已迁到 `~/Developer/CommunityManagerAgent/.claude/skills/wechat-mac-ops/`（配 `.pi/skills → ../.claude/skills` 软链，CC 与 pi 都能发现），**全局目录与本项目 `claude/skills/` 镜像已删除**——因此本项目 `claude/skills/` 清单里**没有** `wechat-mac-ops`，这不是遗漏。本条目保留作沿革记录（下文的「镜像同步」一句已失效，以本注为准）。

- **为什么做**：2026-10-02 用户要求把当天操作微信群的经验沉淀成 skill、避免下次踩坑。当天在微信客户端完成三件事——改群名（AI+X 实战经验交流群）、编辑并发布群公告（v1.2.0）、在群里发一条自我介绍消息——全程只有命令行＋剪贴板可用，踩了几个真坑（弹窗坐标换算不对、click 工具被无障碍路径吞掉、type_text 无效、误触关闭丢编辑）。
- **做了什么**：新增 skill `wechat-mac-ops`（`~/.claude/skills/wechat-mac-ops/`）：
  - `SKILL.md`（103 行）：三个任务的分步流程（改群名 / 改群公告 / 群内发言）＋ 统一机制（三条命令行 + 截图坐标约定）＋ 收尾纪律（恢复剪贴板、清理含隐私的截图、汇报影响面）＋ 坑清单
  - `references/computer-use.md`：open-computer-use 的工作机制（截图像素 → 窗口点 → 全局点的换算、点击的三条路径 AX / postToPid / 全局指针兜底、环境变量、权限与隐私）
  - `references/wechat-ui.md`：微信 Mac 4.x 界面地图（窗口清单、主窗口与群公告窗口的控件位置、三个确认弹窗的按钮语义、会惊动群里的三种操作）
  - `scripts/`：`ocu.sh`（截图 + 元素树）、`tap.sh`（拖拽式真实点击）、`clic.sh`（真点击）、`wxgeom.py`（窗口几何 / 坐标换算 / 鼠标指针回读）
- **验证**：description 长度检查通过（340/1024，skill-creator 的 `check_description.py`）；四个脚本在本机实跑通过——窗口几何与本机实测值一致（主窗口 X=18 Y=30 W=817 H=696）、坐标换算结果与当天实际操作值对得上、截图落盘正常。
- **镜像同步**：`claude/skills/wechat-mac-ops/` 已同步，`diff -r` 逐字节一致。

### 新增（版本一致性守卫：VERSION ↔ 群公告版本号，三层工具强制）

- **为什么做**：用户 2026-10-02 立规（CommunityManagerAgent 项目规则）——「`VERSION` 里面的版本号应该和 `announcement.txt` 的版本号一致。这个是硬性规定，工具强制」。背景：该项目此前是「两套体系」（群公告版本独立于项目 `VERSION`、不比对，2026-08-27 裁定），实际长期背离（`VERSION` 停在 0.1.0、公告已到 v1.2.0），而公告通道又是该项目唯一的对外发布通道，版本号分开维护无收益、易漂移。
- **做了什么（三层同源，规则变更时三处同步改）**：
  ① 新增 pi 扩展 `version-guard.ts`（`~/.pi/agent/extensions/`）：拦截 `git commit` / `git tag`（含 `git -C <path>` 与开头 `cd <dir> &&` 形态），检出仓库根 `VERSION` 与 `docs/community/announcement.txt` 的「版本：」行不一致即 deny；版本号按 major.minor.patch 比对（`v` 前缀差异视为一致）；fail-closed（两侧文件都在而任一侧解析不出同样拦）；逃生标记 `VERSION_MISMATCH_OK`（用户授权后使用）。仅当仓库同时存在两个文件时生效，其它项目零影响。
  ② `~/.claude/hooks/pre-tool-use-guard.sh` 新增规则 5（CC / CodeBuddy 等端，判定与逃生标记同 ①）。
  ③ 全局 git pre-commit hook（`~/.config/git/hooks/pre-commit`）增加同一检查——该 hook 在本机 `~/.config/git/hooks/`、**不属开源镜像范围**（与 gitleaks hook 同），clone 者需自行按同规则配置；逃生门 `git config hooks.version-consistency false`。
- **全局规则同步**：全局 `CLAUDE.md`「版本信息一致性」节新增一段——项目若还有自带版本号的对外发布物（如群公告 `announcement.txt`），其版本号必须与 `VERSION` **完全一致**（bump 一个必须同步 bump 另一个），并注明三层工具强制与生效范围。
- **实测验证**：git hook（拦截 / 放行 / 逃生门配置）、CC 规则 5（不一致 deny、逃生标记放行、一致放行、无关仓库放行、缺「版本：」行 fail-closed）、pi 扩展 9 用例（`git commit` / `git tag` / 逃生标记 / 一致 / 非 commit 命令 / 非 git 仓库 / `git -C` 形态 / `cd &&` 形态 / cd 后非 commit）全部通过。
- **镜像同步**：`pi/agent/extensions/version-guard.ts`、`claude/hooks/pre-tool-use-guard.sh`、`claude/CLAUDE.md`、`claude/docs/capability-sync.md`（pi 扩展清单 4 → 5）已同步；六部分 diff 核对（排除本机产物）逐字节一致。

## 2026-10-01

### 新增（跨会话协作：agent-call 扩展 + 全局协作规则）

- **为什么做**：用户需要「agent 之间自己传话、不让用户当传话筒」，且对方会话未开启时不能让任务阻塞。经调研选定 pi 生态方案：pi-intercom（会话互通能力）+ 自研 agent-call 扩展（自动唤醒 + 调用）。2026-10-01 用户确认：形态用 pi 扩展、命名 `agent-call.ts`、协作触发规则放全局规则文件。
- **做了什么**：
  ① 新增 pi 扩展 `agent-call.ts`（`~/.pi/agent/extensions/`）：提供 `agent_wake`（确保目标会话在线——不在线则在目标项目目录用 tmux 启动 `pi -n <名字>` 并等待注册）与 `agent_call`（唤醒 + 发送；`mode=send` 走 pi-intercom 扩展 Outbox 事件通道、消息以本会话身份发出；`mode=ask` 走 pi-intercom CLI 阻塞等待回复并自动附加发送者签名）两个工具。依赖 pi-intercom 与 tmux；`PI_INTERCOM_CLI` / `PI_AGENT_BIN` 环境变量可覆盖路径，代码不含任何私有信息。
  ② 全局 `CLAUDE.md` 新增「会话间协作（agent-call）」小节：自动唤醒（调用时尽快带上目标项目目录）、两种模式（send/ask）、消息自带背景、联系不上不硬等、会话命名约定（`pi -n <agent名字>`）。
  ③ 实测验证（本机三个测试 pi 会话）：会话发现、send 身份（接收方消息头显示「From caller」）、自动唤醒（关闭目标会话后 `agent_call` 自动拉起新会话、注册、投递并拿到回复）全部通过。
- **镜像同步**：`pi/agent/extensions/agent-call.ts` 与 `claude/CLAUDE.md` 已同步；六部分 diff 核对（除本机私有文件与本机产物）逐字节一致。

### 变更（add / commit 自动衔接机制：/add 预检完全干净后直接进入 commit skill，减少用户二次介入）

- **为什么改**：用户 2026-10-01 立规——「如果没有需要人工审核的文件和不建议入库的文件则可以直接调用全局的 commit skill，这样可以减少我的介入，增加自动化程度」。原状（2026-09-22 起）：/add 完成预检分流后必须由用户再输入 /commit 才能提交；预检完全干净（无人工过目、无不建议入库）时那次 /commit 没有新增任何把关价值，白白多一次介入。
- **改了什么**：
  ① `skills/add/SKILL.md`：description 补自动衔接说明（含触发条件与 2026-10-01 出处）；「授权边界」第 3 条由「不 commit、不 push」改为「预检完全干净时自动衔接 commit skill（全局 CLAUDE.md 授权形式③）」；新增**第 7 步「自动衔接 commit skill」**——判定条件三条全部满足才衔接（至少 1 个文件加入暂存区 + 需人工过目 0 个 + 不建议入库 0 个；「白名单跳过」不构成阻断，用户此前已确认可公开）、满足则直接进入 commit skill 完整流程一步不省（含其全部检测与终止 / 暂停规则，`git commit` 照常带 `# AI_AUTHORIZED_COMMIT` 标记）、逃生口（用户当轮明确说「只 add、不要提交」时不衔接）、报告组织（add 三段式报告 + commit 完整汇报连成一链，含 `>> git status` 收尾）；第 6 步报告指引句按「自动衔接 / 未衔接」两场景拆分；「与其他 skill 的衔接」段与定位段同步。
  ② `skills/commit/SKILL.md`：description 与「核心定位」触发判定改为**来源两种**（① 用户当前消息 /commit；② add skill 预检完全干净后的自动衔接，2026-10-01 用户立）；「两步用 && 串联」段的授权来源、`# AI_AUTHORIZED_COMMIT` 标记场景说明、汇报段「重新触发」措辞同步。
  ③ 全局 `CLAUDE.md` 三处同步（见镜像同步）：「Git 写操作必须先征得同意」例外段增 `/add` 自动衔接；「Git 暂存区禁止 AI 自主增删改」第 1 条明确授权由两种形式扩为**三种形式**（③ = /add 预检完全干净后的自动衔接）；「commit skill 的触发与终止」改为**触发来源两种**。
  ④ `hooks/pre-tool-use-guard.sh` 与 `pi/agent/extensions/git-commit-guard.ts`：授权标记 AI_AUTHORIZED_COMMIT 的使用场景说明由两种扩为三种（判定逻辑不变，仍以标记存在与否为准）；`pi/agent/extensions/git-status-guard.ts` 注释同步（强制锚点来源扩为三种）。
- **设计要点**：「/add 授权自动延伸」的边界——只在下述条件全满足时生效：本次预检**至少 1 个文件入暂存区**（无预检成果可提交的零入库场景不衔接）+ 需人工过目 0 个 + 不建议入库 0 个；有任一不满足则停在 add 报告阶段不衔接（保留原有人工把关）；命中的安全规则（commit skill 敏感扫描 / cache 检测、git-commit-guard 标记）全部原样保留，自动衔接不是跳过防线、只是省掉重复的触发动作。
- **镜像同步**：`claude/skills/add/SKILL.md`、`claude/skills/commit/SKILL.md`、`claude/CLAUDE.md`、`claude/hooks/pre-tool-use-guard.sh`、`pi/agent/extensions/git-commit-guard.ts`、`pi/agent/extensions/git-status-guard.ts` 已同步，六部分 diff 核对除本机私有文件（anysearch/.env、backup/endpoints/endpoints.json、scroll-reverser/local/config.md）与 `__pycache__` 外逐字节一致；`~/.pi/agent/skills` 与 `~/.claude/skills` 为同 inode 硬链接，自动跟随。

## 2026-09-30

### 变更（dev-workflow 修订：测试产物不单独提交、不单独开 PR——修正「测试先交付即提交」的流程缺陷）

- **为什么改**：用户 2026-09-30 裁定——测试先行的产物不能先提交、更不能先开 PR。此前 skill 第 3 步让测试 Agent「报告应 `git add` 的路径、commit 由用户亲自执行」，而 `/commit` 在非 main 分支上必然 push 分支 + 建 PR + enable auto-merge，「测试先交付即提交」实际等于「测试单独开一个 PR」；PR 描述又按惯例带 `fixes #N`，合并那一刻 GitHub 的自动关闭关键词会把 Issue 提前关成 completed。2026-09-29 实测事故：ghostty-launcher 的测试 PR #2（只含测试、CI 红）合并，1 秒后 Issue #1 被自动关成 completed，而实现还只在分支上；main 也因此出现「测试已进、实现未进」的半程状态、CI 全量必红，破了 main 永远绿的底线。正确动线：测试写在功能分支工作区放着**不提交**，开发完成、本地全量测试转绿后由用户一次性 `git add`（测试 + 实现 + CHANGELOG）+ `/commit`——测试与实现在**同一次提交、同一个 PR** 里进 main。
- **改了什么**：
  ① `skills/dev-workflow/SKILL.md`：第 3 步新增专门段落「测试产物不单独提交、不单独开 PR（2026-09-30 用户定，硬规矩）」——写清为什么（含事故实证）、正确移交方式（报告测试文件清单 / 测试命令 / 自跑见红证据即结束交付，测试以未提交的工作区改动留在分支上）、唯一例外（合并 `origin/main` 时未提交的测试文件撞上游改动被 git 拒，可先本地提交一次但不 push / 不开 PR）；第 3 步任务下发与交付口径、第 5 步「测试有没有变」（按工作区文件比对而非 commit）、第 7 步标题与 PR 条目（PR 只在开发完成 + 本地全量绿后创建一次，内容 = 测试 + 实现，禁止为测试单独开 PR）、流程总览第 8 项、沿革、授权边界段同步。
  ② `skills/dev-workflow/references/test-cases.md`：「先红后绿的时序」三条重写（测试不提交、与实现同一次提交同一 PR、测试先行不是「先提交先开 PR」的先行）；Hopper 主通道条目同步。
  ③ `skills/commit/SKILL.md` 第 1 步新增「测试文件独占暂存区的暂停询问」配套工具强制——暂存区全部是测试文件、无任何功能代码 / 配置改动时先停下，说明风险（`fixes #N` 提前关 Issue + main 半程状态）并建议等实现一起提交，用户明确确认是有意的纯测试提交后才继续（**暂停型决策点**，同第 0a 步语义，不是敏感扫描 / cache 那种「命中即终止」）。
- **镜像同步**：`claude/skills/dev-workflow/`（`SKILL.md` + `references/test-cases.md`）与 `claude/skills/commit/SKILL.md` 已同步，`diff -rq` 除本机私有文件（anysearch/.env、backup/endpoints/endpoints.json、scroll-reverser/local/config.md）与 `__pycache__` 外逐字节一致。
- **配套改动（不在本仓库镜像范围）**：测试 Agent 项目 TestEngineerAgent 的 `CLAUDE.md` 出题动线第 4 步、工作原则、约束段与双语 README 第 2 步同步修订（测试产物留在工作区、不提请用户提交），记该项目自己 CHANGELOG。

## 2026-09-29

### 变更（commit / add 缓存检测补例外：`.commit-cache.md` 不算 cache、不拦）

- **为什么改**：`.commit-cache.md` 名字含 cache，会被 commit skill 第 3 步 / add skill 第 1 步的「名字含 cache」检测字面命中——实际它是 commit skill 自己的状态文件（标配标记 + 敏感扫描白名单），本就应入库、且在扩展出白名单段后更需要正常随提交入库；不修则下一次 `/commit` 会把暂存中的它误判为运行时缓存、自动写进 `.gitignore` 并终止流程。
- **改了什么**：① `skills/commit/SKILL.md` 第 3 步、② `skills/add/SKILL.md` 第 1 步各补一句例外——「项目根 `.commit-cache.md` 是 commit skill 的状态文件（本就应入库、非运行时缓存），不算 cache、不拦」。
- **触发场景**：2026-09-29 该文件（含白名单段）进 `/add` 预检时实际遇到该判定分叉，按语义判为放行、规则仍存字面歧义，据此把例外写进规则消除歧义。
- **镜像同步**：`claude/skills/commit/SKILL.md`、`claude/skills/add/SKILL.md` 已同步，diff 逐字节一致。

### 变更（commit / add 新增「敏感扫描白名单」机制：用户确认可公开的命中项不再重复拦截）

- **为什么改**：2026-09-29 实战——`/commit` 敏感扫描命中了两个身份标识类内容块，用户确认「可公开、加入 commit 白名单，下次不再检测」；但按原机制命中即终止、重跑还会再拦，已被用户确认的内容反复打断流程。据此把「一次性人工确认」固化为可复用的白名单机制。
- **改了什么**：
  ① `skills/commit/SKILL.md`：第 2 步敏感扫描新增「先读白名单」——读项目根 `.commit-cache.md` 的「敏感扫描白名单」段，命中条目描述范围的内容跳过、不再拦截（汇报里列一行「白名单跳过」，不静默省略）；白名单只覆盖条目描述范围、范围外或拿不准照常拦截；凭证类实值命中不适用白名单。结果处理「发现敏感内容」分支补：用户明确确认「可公开」后可把对应条目追加进白名单（例外②）——本次仍终止、不续跑，白名单对下一次起效。例外②措辞扩为「写入缓存标记或敏感扫描白名单条目」（正文两处同步）。汇报要求补一行「白名单跳过」。
  ② `skills/add/SKILL.md`：第 3 步 AI 语义扫描新增同一白名单读取（命中条目范围的内容块不进人工过目清单、报告列一行；gitleaks 命中不豁免）——否则 `/add` 会对同一批已确认内容重复拦截；第 6 步报告模板加「白名单跳过」可选行。
  ③ `.commit-cache.md` 格式段（commit skill 内）：新增白名单段的格式说明、写入门槛与五条边界（用户明确确认才追加 / 只覆盖描述范围 / 拿不准按不在 / 凭证不豁免 / 可删条目撤销），完整模板补「敏感扫描白名单」段。
- **镜像同步**：`claude/skills/commit/SKILL.md`、`claude/skills/add/SKILL.md` 已同步，diff 逐字节一致（`~/.pi/agent/skills` 为指向 `~/.claude/skills` 的符号链接，自动跟随）。
- **首次应用**：GrowthMarketerAgent `.commit-cache.md` 当日登记两条白名单条目（X 账号标识类 / 个人账号身份细节类，用户确认可公开）；项目侧登记结果记该项目 CHANGELOG。

### 变更（dev-workflow：测试任务的跨 agent 下发改为写入 Hopper 项目 TODO.md 并报编号）

- **为什么改**：2026-09-29 用户裁定——开发流程需要测试 Agent（Hopper）出题时，不再由用户人工转达（原第 3 步写「开发 Agent 向用户报告：请在测试 Agent 会话出测试——给它 worktree 路径 + Issue 链接」），改为**开发 Agent 直接把出题任务写入 Hopper 项目（TestEngineerAgent）根 `TODO.md` 并报告编号**（如「已写为 Hopper 的 T6」），用户在 Hopper 会话按 TODO 接活。首个真实用例：ghostty-launcher Issue #1（面板 New Window 偶发无反应、需测试先行，2026-09-29）。
- **改了什么**：
  ① `skills/dev-workflow/SKILL.md`：第 3 步第 1 条重写为「任务下发」——写入 Hopper 项目根 `TODO.md`（按该文件既有格式与全局 TODO 规范：编号顺延 = 扫该项目 `TODO.md` + `TODO-archive.md` 取最大编号 + 1、按紧急度入节、写 `（记录：YYYY-MM-DD HH:MM）` 时间戳；正文写清背景 + Issue 链接 + worktree 路径与分支名 + 要做什么 + 关联；同时在 Hopper 项目 CHANGELOG 记一条），写完向用户报告编号；「沿革」段补记 2026-09-29 修订。
  ② `skills/dev-workflow/references/test-cases.md`：「测试的三个来源」第 1 条（测试 Agent 主通道）同步改为 TODO 下发写法。
- **镜像同步**：`claude/skills/dev-workflow/SKILL.md`、`claude/skills/dev-workflow/references/test-cases.md` 已同步，`diff -r` 逐字节一致（`~/.pi/agent/skills` 为指向 `~/.claude/skills` 的符号链接，自动跟随）；description 长度自检 PASS（549/1024，未改 frontmatter）。
- **关联记录**：TestEngineerAgent（Hopper）`TODO.md` 新增 T6 + 该项目 `CHANGELOG.md` 同日条目。

## 2026-09-25

### 变更（anysearch / agent-reach 两 skill 分工切割：消除搜索路由重叠区）

- **为什么改**：用户询问两个 skill 是否存在重复。逐项核查后确认：两者不是互为子集，但重叠四块——通用网页搜索（anysearch `search` ↔ agent-reach 的 Exa）、网页正文提取（anysearch `extract` ↔ Jina Reader）、X / Reddit / LinkedIn 公开检索（anysearch `social_media` 域 ↔ 平台 CLI）、股票行情（anysearch `finance.quote` ↔ 雪球）。更实际的问题是两者 description 都自称搜索首选（agent-reach 写「MUST USE … anything on the internet」，anysearch 只有一句英文、无中文触发词），中文请求「搜一下 X」几乎必被 agent-reach 抢走触发，anysearch 可能白装。用户决策：两个都保留（各自都有独占能力：agent-reach 独占小红书 / B站 / V2EX / YouTube 字幕 / RSS / gh CLI，anysearch 独占垂直域检索 / 批量并行搜索 / 微博知乎微信），按「anysearch 作检索层、agent-reach 作平台层」做分工切割，重叠区统一为首选 / 兜底两条路径。
- **改了什么**：
  ① `skills/anysearch/SKILL.md` 的 description 重写（121 → 854 字符，check_description.py 实测 PASS）：补中文触发词（查一下 / 搜一下 / 调研 / 最新消息 / 查行情 / 查财报 / 查论文 / 查专利）、写明垂直域结构化标识符检索规则、划定边界（平台内 / 账号级数据归 agent-reach）。
  ② 同文件「Social Media Source Workflow」段新增 Freshness note（用户提出「x_latest 混旧帖、能否按最新排序」的调查结论）：实测证实 `x_latest` / `x_top` 是热度 × 时间混合排序、非严格时间序（同一关键词拉 10 条可跨 3 周），且无服务端排序参数（官方文档未列出排序参数，实测传入 `sort=` 未观察到排序变化）；需要最新内容时拉满 `--max_results 10` 后按返回的 `Posted:` 时间自行重排 / 过滤，冷门关键词池内新帖少时回退通用搜索。
  ③ `skills/agent-reach/SKILL.md` 的 description 收窄（901 → 906 字符，实测 PASS）：触发面从「anything on the internet」收窄为「用户提到平台 / 分享平台链接」，去掉「shares any URL」这类通用网页触发（归 anysearch），新增【分工】段；正文常驻规则第 4 条「Exa 搜索」改「anysearch 搜索」、新增第 6 条「通用检索走 anysearch」，把 Exa / Jina Reader 降级为兜底。
  ④ 同 skill 的 `references/search.md` / `references/web.md` 顶部各加一行兜底标注（Exa、Jina Reader / web-reader 是 anysearch 不可用时的兜底路径；RSS 仍走本文档）。
- **实测依据**：anysearch 四类调用全部跑通（普通搜索 1.1s、社交域 X 搜索、金融域结构化行情、网页提取）；agent-reach `doctor --json` 体检——ok = YouTube / B站 / V2EX / RSS / web，warn = GitHub / Twitter / LinkedIn / 雪球 / Exa，off = Reddit / Facebook / Instagram / 小红书 / 小宇宙（后端未装）。
- **镜像同步**：`claude/skills/anysearch/SKILL.md`、`claude/skills/agent-reach/`（SKILL.md + references/search.md + references/web.md）已同步，diff 逐字节一致（anysearch 的 `.env` 属敏感例外）；`~/.pi/agent/skills` 为指向 `~/.claude/skills` 的符号链接自动跟随。
- **防回归提示（重要）**：两个 skill 均由上游维护（AnySearch 官方、Agent Reach 上游），核查确认**两者都不会自动升级**（无自更新逻辑、无定时任务；agent-reach 的 `check-update` 只查询远端版本、SKILL.md 规则 5 只要求 AI 顺带提醒用户，升级仍须用户一句话触发）；但以下动作会覆盖本地定制——`agent-reach install`、`agent-reach skill --install`、`agent-reach uninstall`（均 force 覆盖式写入）与 anysearch 手动下载覆盖目录；单纯升级 Python 包不碰 skill 文件。附注：update.md 称「doctor 会保留已有 skill」与本机 1.5.0 及上游 main 代码不符——doctor 实际只做体检、不安装 skill，且 `_install_skill` 的「已存在则保留」分支（force=False）无任何调用点、是死代码。升级后按 `MEMO.md` M1 的自检命令确认定制在否，丢了按本条记录重做。

### 新增（skill 定制自动恢复机制：launchd 监听 + 结构化重打，被覆盖后自动补回、无需记忆）

- **为什么改**：用户指出「升级后检查定制」靠记忆不可靠——会发生无感覆盖、事后遗忘，要求做成「升级后自动补上」的机制（参照 PatchClaudeAgent/Tinker 的自愈思路）。前一条已查明两个 skill 不会自动升级，但 `agent-reach install` / `agent-reach skill --install` / `agent-reach uninstall` 与 anysearch 手动覆盖会丢定制。
- **改了什么**：① 新建本机目录 `~/.claude/local/skill-custom/`（本机私有，不入 git、不入镜像）：`restore.py`（结构化重打引擎）、`snippets/`（7 个定制片段，权威内容源）、`README.md`、`restore.log`、`conflicts/`；② 新建 launchd 服务 `~/Library/LaunchAgents/com.xhq.skill-custom.plist`——WatchPaths 监听 4 个受管文件及其目录（变动即跑，实测延迟约 10 秒）+ 登录时一次 + 每小时兜底；③ 引擎对每个定制点按结构定位（frontmatter 键 / 定制段首行 / 插入锚点）做幂等 upsert：缺失则重插、片段更新则同步目标、锚点丢失则留现场 + 桌面通知不硬写。设计过程：先试 3-way merge（git merge-file），实测发现 version 行随上游发版必变、与紧邻的 description 定制必然冲突，遂改结构化重打（不受 version 变化干扰）。
- **验证**：端到端实测——4 个受管文件全部回退到上游原版，launchd WatchPaths 自动触发重打回定制版，与镜像逐字节一致；片段更新同步（改 snippet → 目标同步 → 改回 → 复原）通过；幂等（重复运行零动作）；`--check` 全 ok；服务已加载。
- **边界**：上游大改结构致锚点消失时不硬写、桌面通知、现场存 `conflicts/`（人工处理）；机制只在本机，不进镜像。

### 新增（hooks 纳入开源镜像：`claude/hooks/` 建立，镜像范围升为四部分）

- **为什么改**：用户要求把全局 `~/.claude/hooks/` 的强制守卫脚本也同步到本项目 `claude/hooks/`。此前镜像范围只有三部分（skills / CLAUDE.md / docs），而全局 `hooks/` 已被「规矩必须配套工具强制」元规则作为硬约束的落地点（杀 VSC 进程前必问、远程连接禁用当前窗口、commit 授权标记、X/Twitter 账号隔离、测试文件写保护五条拦截全在其中），却只存在于本机全局、不随开源仓出去——clone 本项目的人看不到这些强制工具的实现。
- **改了什么**：① 新建 `claude/hooks/`，镜像全局两个脚本 `pre-tool-use-guard.sh`（PreToolUse 规则 1~4）与 `test-cases-guard.py`（dev-workflow 测试文件写保护），内容逐字节一致、执行位保留；**不含**本机产物 `__pycache__/`（字节码缓存）与 `pre-tool-use-guard.sh.bak-20260923`（编辑备份），并把这两类明确写进范围陈述的排除项。② 镜像范围由「三部分」升为「四部分（skills / CLAUDE.md / docs / hooks）」：全局权威侧改四处——`~/.claude/docs/capability-sync.md`（指针节 + 范围节 + 验证节，并写明 hooks 由 `settings.json` 的 `hooks.PreToolUse` 注册）、`~/.claude/docs/agents-registry.md`（Prometheus 行）、`~/.claude/docs/new-agent-scaffold.md`（单一出口段）、`~/.claude/CLAUDE.md`（团队结构参考指针行）；镜像侧 `claude/CLAUDE.md` 与 `claude/docs/` 三文件 `cp` 覆盖、逐字节一致。③ 项目级同步：根 `CLAUDE.md`（四部分表述 + hooks 纳入日期）、`.claude/README.md`（写明通用守卫 hook 的镜像在 `claude/hooks/`、项目级 `.claude/` 不放它，并修正指向已不存在的「底层通用能力开源」节的悬空引用）、capability-manager skill（SKILL.md 6 处：description + 范围/镜像/步骤/引用共 5 处正文；`references/content-lifecycle.md` 4 处，判断矩阵新增 hooks 行；`references/sync-flow.md` 12 处：范围表述、双向同步命令、diff 命令、合法差异表、巡检脚本，hooks 比对统一用 `diff -r -x '__pycache__' -x '*.bak*'` 排本机产物）。
- **验证**：四部分 diff 全过——`CLAUDE.md` 逐字节一致、`docs` 逐字节一致、`hooks`（排本机产物后）逐字节一致、`skills` 仅剩既有本机敏感例外（anysearch `.env`、backup endpoints、scroll-reverser local、skill-creator `__pycache__`）；capability-manager 的 `check_description.py` 实测 PASS（531/1024）；全仓库搜索无残留的「三部分」范围陈述（全局侧 0 处）。
- **边界**：hooks 纳入镜像只解决「开源分发」，不改变本机加载方式——CC 端仍由全局 `~/.claude/settings.json` 的 `hooks.PreToolUse` 按绝对路径注册生效；pi 端对应实现是 `~/.pi/agent/extensions/*.ts`，不在镜像范围。

### 新增（`local/skill-custom` 技能定制自动恢复器纳入开源镜像）

- **为什么改**：用户要求把全局 `~/.claude/local/` 的内容同步到本项目 `claude/local/`。全局该目录目前只有一份内容——今天下午新建的 `skill-custom/`（skill 定制自动恢复机制：结构定位重打引擎 + 定制片段 + launchd 触发器），此前被明确记为「本机私有、不进镜像」，本次用户决定改为公开。
- **改了什么**：① 新建 `claude/local/skill-custom/`，镜像三类内容——`restore.py`（236 行重打引擎）、`snippets/`（7 个定制片段：anysearch / agent-reach 的 description、Freshness note、常驻规则第 4 / 6 条、两处兜底标注）、`README.md`；`diff -r` 逐字节一致。② **不镜像运行产物**：`.lock`（并发锁）、`restore.log` / `launchd.out.log` / `launchd.err.log`（动作日志）、`conflicts/`（锚点丢失现场快照）——随时变动、含本机运行轨迹，属本机产物。③ 全局 `~/.claude/local/skill-custom/README.md` 两处修正：标题的「本机私有」改为「本机机制；代码与片段已开源镜像」，边界段的「本机制只在本机存在，不进 git、不进开源镜像」改为写明镜像去向与本机产物排除项——否则镜像里会出现一句自我否定的说明。
- **与前序记录的关系（重要）**：本条推翻今天早些时候「新增（skill 定制自动恢复机制…）」条目里的边界结论「机制只在本机，不进镜像」。该结论已被用户本次指令取代，旧条目按历史保留、不再有效；本机制代码与片段的权威源仍是全局 `~/.claude/local/skill-custom/`（改定制先改全局、再镜像）。
- **待定（等用户拍板，未做）**：① 镜像范围表述——现文档口径仍为「四部分（skills / CLAUDE.md / docs / hooks）」，是否把 `local/` 列为第五部分、以及「整个 `local/`」还是「只点名 `skill-custom/`」纳入镜像，取决于用户对 `local/` 隐私边界的决定（`local/` 是全局的本机私有区，若整体纳入镜像，以后放进去的任何文件都会直接进公开仓库）。② `README.md` / `restore.py` 里的 launchd 标签 `com.xhq.skill-custom` 与 `~/Library/LaunchAgents/…plist` 路径含本机个人标识，是否泛化为占位符（保持原样则为逐字节一致）。
- **验证**：`diff -r -x '*log' -x '.lock' -x 'conflicts'` 全目录逐字节一致；敏感扫描（token / key / cookie / 账户 / `/Users/xhq` 绝对路径）全目录无命中——脚本统一用 `~` 展开、无硬编码个人路径。

### 变更（`local/` 改名 `patch/`：目录语义从「本机私有」纠正为「自研可公开补丁层」）

- **为什么改**：用户指出 `local` 这个目录名与其真实目的不符——该目录不是「本机私有区」，而是「自研机制的开源实现区」（放进去就是要公开的）。改名消除语义误导，避免以后有人（包括 AI 自己）按「local = 本机私有」的惯例把隐私内容放进去。
- **改了什么**：① 全局目录 `~/.claude/local/` → `~/.claude/patch/`；② 项目镜像 `claude/local/` → `claude/patch/`（逐字节一致）；③ 引用点全量更新：launchd 配置 `~/Library/LaunchAgents/com.xhq.skill-custom.plist`（ProgramArguments 脚本路径 + StandardOutPath / StandardErrorPath 共 3 处）并重载服务、`~/.claude/patch/skill-custom/README.md` 2 处（tail 路径、镜像去向）、项目根 `MEMO.md` M1（2 处路径 + 更新时间戳）；④ 镜像范围表述由「四部分」升为「五部分（skills / CLAUDE.md / docs / hooks / patch）」，同步更新全局权威侧 4 文件（capability-sync.md 四段、agents-registry.md、new-agent-scaffold.md、CLAUDE.md）与项目侧 5 文件（根 CLAUDE.md、.claude/README.md、capability-manager SKILL.md 6 处、content-lifecycle.md 4 处、sync-flow.md 13 处），hooks / patch 的 diff 命令统一带排除本机产物的 `-x` 参数；⑤ CHANGELOG 历史条目里的 `local/` 路径按「历史不改写」保留（本条即对其的更新说明）。
- **验证**：① 机制侧——`restore.py --check` 从新路径运行四项全 ok；launchd 服务重载后 `launchctl print` 确认 program / arguments / stdout 均指向新路径，`kickstart` 实测 runs +1、退出码 0；② 五部分 diff 全过（CLAUDE.md / docs / hooks / patch 逐字节一致，skills 仅既有本机敏感例外）；③ 全仓「四部分」残留扫描为空、「claude/local」引用扫描为空（CHANGELOG 历史除外）；④ capability-manager description 实测 PASS（539/1024）。
- **边界**：改名只动目录与路径引用，不改机制行为；`patch/` 下的运行产物（`*.log`、`.lock`、`conflicts/`）仍不进镜像。另：上一轮遗留的「launchd 标签 `com.xhq.skill-custom` 是否泛化」仍未决，本轮保持原样（逐字节一致优先）。

### 新增（项目根 `TODO.md` 建立：记 capability-manager 参考文档的过时项 T1）

- **为什么改**：本项目此前没有 `TODO.md`（只有 `MEMO.md`），而本轮核对镜像时发现 `.claude/skills/capability-manager/references/sync-flow.md` 有两处与现状不符，属「待办」而非本轮能定的事（涉及口径选择）。按全局 CLAUDE.md「待办一律写入项目根 TODO.md、禁止写到其它地方」的规矩，建该文件并把发现问题记为 T1。
- **改了什么**：新建项目根 `TODO.md`（活跃待办清单；头部写明条目格式、编号规则、四级紧急度与归档去向）；T1 记入 🟠 橙色节——① 文档举例仍用已下线的 `find-skill`（全局 `~/.claude/skills/` 已无该 skill，现存合法差异为 anysearch `.env`、backup `endpoints.json`、scroll-reverser `local/config.md`、skill-creator `scripts/__pycache__` 四项）；② sync-flow.md 的「全局 → 各 agent 项目副本（分发）」章节及对应巡检，与权威文档 `~/.claude/docs/capability-sync.md`「分发层已终结」矛盾（2026-09-25 实测各 agent 项目 `.claude/skills/` 只剩专属 skill，无通用 skill 副本）。
- **验证**：`TODO.md` 已建、内容已回读确认；各 agent 项目 `.claude/skills/` 实测清单已记入 T1 作依据。

### 新增（pi 端扩展纳入开源镜像：`pi/agent/extensions/` 建立，镜像范围升为六部分）

- **为什么改**：用户要求把全局 `~/.pi/agent/extensions/` 的内容同步到本项目 `pi/agent/extensions/`。pi 端的四个工具强制扩展（git-commit-guard / git-status-guard / test-cases-guard / twitter-guard，与 `hooks/` 是同一套工具强制的 pi 侧实现）此前只存在本机、不随开源仓出去。
- **改了什么**：① 新建 `pi/agent/extensions/`，镜像四个 `.ts`（git-commit-guard 1.8K、git-status-guard 6.4K、test-cases-guard 4.9K、twitter-guard 3.0K），`diff -r` 逐字节一致；敏感扫描无命中（无绝对路径、无凭证值、无个人标识；`TWITTER_AUTH_TOKEN` 等只是环境变量名，`token` 字样指命令行词元）。② 镜像范围由「五部分」升为「六部分（skills / CLAUDE.md / docs / hooks / patch / pi 扩展）」，权威源变为两个：`~/.claude/`（前五部分）+ `~/.pi/agent/extensions/`（pi 扩展）；同步更新全局权威侧 4 文件（capability-sync.md 4 处、agents-registry.md、new-agent-scaffold.md、CLAUDE.md 指针行）→ 镜像侧 `claude/CLAUDE.md` 与 `claude/docs/` 逐字节一致；项目侧 5 文件（根 CLAUDE.md、`.claude/README.md`、capability-manager SKILL.md 6 处、content-lifecycle.md 4 处含判断矩阵新增 pi 扩展行、sync-flow.md 13 处含权威源表、双向同步命令、diff、巡检）。
- **与前序记录的关系（重要）**：本条推翻此前多处「pi 端扩展不在 Prometheus 镜像范围」的结论（2026-09-23 twitter-guard 条目、2026-09-22 git-status-guard 条目，以及本日 hooks 条目边界段的「pi 端对应实现是 `~/.pi/agent/extensions/*.ts`，不在镜像范围」）。旧条目按历史保留、不再有效。
- **路径说明**：镜像目录为 `pi/agent/extensions/`（不带点，与 `claude/` 镜像目录同惯例）；pi 实际加载的是用户级 `~/.pi/agent/extensions/`，项目内 `.pi/` 目录（`skills` 软链接）是另一回事，两者不混。
- **验证**：`diff -r ~/.pi/agent/extensions pi/agent/extensions` 逐字节一致；六部分巡检全过（skills 仅既有本机敏感例外）；全仓「五部分」扫描仅剩「前五部分」等正确表述（无过时范围口径）；capability-manager description 实测 PASS（573/1024）；sync-flow.md 代码围栏 16 个配对。
- **边界**：pi 扩展无本机产物（4 个 `.ts` 全部参与比对）；pi 端生效仍是用户级加载（新会话生效），镜像只解决开源分发，不改加载方式。

### 变更（add skill 修正 gitleaks 调用方式：多路径会导致扫描范围失控）

- **为什么改**：2026-09-25 实测发现 `gitleaks dir` 的用法是 `gitleaks dir [flags] [path]`、**只接受单个路径**；把多个候选路径拼在一条命令里时扫描范围会失控（实测扫了约 70MB，把指定路径之外的目录也带了进来），既慢、又会让无关命中混进结果。原 add skill 第 2 步命令写作 `gitleaks dir <候选文件所在目录或文件清单>`，「文件清单」的措辞会诱导多路径用法——同日 GrowthMarketerAgent 的 /add 流程中已实际踩到。
- **改了什么**（2026-09-25）：`skills/add/SKILL.md` 第 2 步——命令示例改为单路径形式（`gitleaks dir <候选文件或目录>`）；说明行重写为「一次只传一个路径（gitleaks dir 只接受单个 [path]；多路径拼在一条命令里会让扫描范围失控——实测会扫描远超指定路径的内容，既慢、又可能混入无关命中）；候选多时逐个跑」。
- **验证**：同一批候选文件改为逐个单路径复扫，全部零命中；多参数对照实测确认范围失控（70MB 扫描量、tmp/ 探针文件的命中混入结果）。
- **镜像同步**：`claude/skills/add/SKILL.md` 已同步、diff 逐字节一致（`~/.pi/agent/skills` 为指向 `~/.claude/skills` 的符号链接自动跟随）。

## 2026-09-23

### 新增（全局规则「X / Twitter 查询必须带账号隔离」+ 两端钩子硬拦截）

- **为什么改**：用户在 GrowthMarketerAgent 会话里发现——`twitter-cli` 的取值顺序是「环境变量 → 浏览器 cookie」，且**浏览器侧会遍历所有 Chrome profile**（`Default` → `glob("Profile *")`，取第一个有 x.com cookie 的）。本机查询专用号在 Default、运营号在 Profile 1，因此存在一条静默风险路径：查询号的 cookie 一旦失效，工具会**自动落到运营号**，让正在运营发帖的号承担自动化访问风险；且 `get_cookies()` 在环境变量验证失败时也会回退扫浏览器，同样可能落到运营号。用户此前的「另一个 Chrome 账号/profile 登运营号」挡不住该扫描。用户要求：这条规矩很常用，只写项目 CLAUDE.md 不够，**要用全局 hook 工具强制**（配套全局「规矩必须配套工具强制」元规则）。
- **改了什么**：① 全局 `~/.claude/CLAUDE.md` 工作规则节新增「X / Twitter 查询必须带账号隔离（钩子已硬拦截）」——要求跑任何 `twitter` / `opencli twitter` 命令前先 `. ~/.x-isolation.env && twitter status` 确认账号；确需不带隔离时加标记 `# AI_AUTHORIZED_X_UNSAFE`。② CC 端 `~/.claude/hooks/pre-tool-use-guard.sh` 新增**规则 4**：拦截未带隔离的 twitter CLI 调用（子命令白名单 + 命令位兜底两段判定，避免 `grep twitter file.txt`、`which twitter`、`~/.twitter-cli/` 路径等误报）与 `opencli twitter`（浏览器会话通道、无隔离机制）；放行条件为命令含 `x-isolation.env` / `TWITTER_CHROME_PROFILE` / `TWITTER_AUTH_TOKEN` / `AI_AUTHORIZED_X_UNSAFE`。③ 新建 pi 端 `~/.pi/agent/extensions/twitter-guard.ts`，判定逻辑与 CC 规则 4 **逐条对齐**（同一套正则、同一放行标记）；14 条用例两端实测结果完全一致（拦截 6 / 放行 8，含误报用例全过）。④ 本机 `~/.x-isolation.env`（0600，不在镜像范围）：设 `TWITTER_CHROME_PROFILE=Default` + 从 `~/.agent-reach/config.yaml` 提取查询号 cookie 注入环境变量，把工具钉在查询号上（失效即报错、不静默切号）；`~/.zshenv` source 之（用户终端全局生效，agent 的 bash 工具为非交互式 shell 不读 `.zshenv`，需显式 source——该约束已写入规则文本）。
- **镜像同步**：`claude/CLAUDE.md` 已用全局版本覆盖同步、diff 逐字节一致（本次同步同时带上了镜像此前落后的「Language」节——全局早已扩写「输出到会话的回复 + 写入磁盘的落盘文件」两类出口，镜像停在旧版，属分叉回正）；`claude/docs/` diff 无差异。**钩子与 pi 扩展不在镜像范围**（capability-sync 三部分为 skills / CLAUDE.md / docs），故本机文件不入开源仓库。

## 2026-09-22

### 变更（add skill 过目粒度修订：人工过目以内容 change block 为单位，文件类型不再触发强制过目）

- **为什么改**：用户定规（2026-09-22）：新增文档 / 配置 / 记录类文件扫描之后内容没有敏感信息就不需要人工过目——「是否要过目」不以文件 / 文档为单位，而以具体的内容 change block 为单位。原第 4 步「高风险类型强制人工」按文件类型一刀切（新增 `*.md` 等即使两层扫描干净也进人工清单），与该口径冲突，且让用户肉眼过目的量变大（每个新增文档都要点一次头），稀释「少而精」。
- **改了什么**：① 第 3 步引入「内容 change block」为最小判断单位（修改类看 diff hunk、新增类按逻辑段落 / 配置项分块），判断纪律同步从「拿不准的文件」改为「拿不准的块」；② 第 4 步整体重写：取消类型强制人工——新增文档 / 配置 / 记录类所有内容块干净即直接进暂存区，触发过目的唯一理由是具体内容块疑似敏感，报告理由精确到块（行号 + 片段）；保留「这些类型是敏感叙述高发区、逐块扫描格外仔细」的警觉要求（把关强度落在扫描质量而非类型一刀切）；③ 第 5 步分流口径同步（「干净文件」条件从「不属强制人工类型」改为「所有内容块均无敏感信息」，可疑侧从「可疑 / 高风险文件」改为「含可疑内容块的文件」）；④ 第 6 步报告示例去掉「新增文档类双保险」类型理由行、理由示例落到内容块；⑤ description 同步（449/1024 实测 PASS）。
- **镜像同步**：`claude/skills/add/SKILL.md` 已同步 diff 逐字节一致；`~/.pi/agent/skills` 为指向 `~/.claude/skills` 的符号链接自动跟随。

### 变更（dev-workflow 预发布供料自动化：新增 auto-rc workflow 模板，main CI 绿后自动发 rc 预发布）

- **为什么改**：用户提出把 dev-workflow 的 release 部分改成「CI 通过 + auto-merge 进 main 后自动发布」。分析后裁定：完全自动正式发版不可取——它架空「正式发布的版本必须是用户使用验收过的」这条根基（CI 只能断言客观回归，断言不了「好用」），且与 VERSION 唯一权威（自动发版要自动 bump，bump 须经 PR 进 main，结构上套娃）、CHANGELOG 纪律（自动生成满足不了「为什么改 + 改了什么」）冲突，还会让每个 PR 合并都出一个正式版、版本节奏失控。真正繁琐且值得自动化的是**预发布的供料**：采纳折中方案——「CI 绿 + auto-merge 后自动发 rc 预发布，正式发版仍由用户触发 /bump + /release」，验收供料自动化、发版裁决权保留。
- **改了什么**：① 新建 `skills/dev-workflow/assets/auto-rc.yml`（可复制模板）：GitHub Actions workflow_run 监听 main 的 CI workflow（success 才进入）、concurrency 串行防撞号、排队期间 main 前进则旧运行跳过、目标版本 = CHANGELOG 顶部第一条未发布的语义版本否则 VERSION patch+1、rc 号查 tag 递增、notes 自动列自上个正式 tag 以来的提交、打 tag + `gh release create --prerelease`；两个定制点（workflow 名与 ci.yml 一致、构建命令按项目改）以注释标注，构建步 exit 1 兜底防未定制直接用。② dev-workflow SKILL.md 六处：核心逻辑段验收来源补自动供料说明、沿革补 2026-09-22 预发布供料自动化一笔、流程总览第 9 条补「配 auto-rc 时随合并自动发」、第 1 步远端门禁新增可选项「自动预发布 workflow」、第 8 步合并后收尾补自动 rc 时序（比合并完成晚一个 CI 周期）、第 9 步预发布主通道改写为自动（主）+ 手动（辅）两条供料通道。③ dev-workflow `references/acceptance.md` 两处：预发布主通道一节重写（自动 / 手动两通道的机制、时序、版本号推导、防重复手发）、「main 与发布的语义闭环」补自动 rc 定位句（自动化的是供料，不是「替用户决定满意」，不碰发版裁决权）。④ release SKILL.md 两处：预发布通道「触发」条补 auto-rc 分工（配了的项目合并后 rc 自动发，手动主要用于合并前提前试用；用户要 rc 先报告最近的自动 rc 避免重复手发），顺带修正两处过时的「dev-workflow 第 8 步」引用为第 9 步（验收步骤号早已变更）。frontmatter description 两 skill 均未动（触发语义不变；dev-workflow 549/1024、release 458/1024 实测在限）。
- **镜像同步**：`claude/skills/dev-workflow/`（SKILL.md + acceptance.md + 新建 assets/auto-rc.yml）、`claude/skills/release/SKILL.md` 已同步 diff 逐字节一致；`~/.pi/agent/skills` 为指向 `~/.claude/skills` 的符号链接自动跟随。验证：workflow 模板 YAML 语法实测合法（PyYAML 解析，on/workflow_run/concurrency/if 断言全过）。

### 变更（敏感信息防护体系升级：新建 add skill 预检分流 + gitleaks 工具层双层落地）

- **为什么改**：用户原有防泄漏流程 = 人工肉眼过内容 + `/commit` 时 AI 扫描两层，文件多时人工「扫看过去」效率低且不可靠；且唯一自动防线由 AI 按指令执行（文本规矩非工具强制，存在简化步骤风险），无确定性工具交叉验证、无平台兑底。用户决策：把「人工全量过 + 亲自 add」升级为「工具 + AI 双引擎预检分流——干净文件 AI 自动 add，可疑文件留工作区人工过目（少而精）」。
- **改了什么**：① 新建 `skills/add/SKILL.md`（~430 字符 description）：`/add` 触发预检分流——候选收集（含删除类直接 add）→ 不入库检测（cache / 二进制 / 大文件）→ gitleaks 工具扫描（缺則降级 AI 正则并标注）→ AI 语义扫描（财务 / 隐私 / 敏感叙述三类，拿不准即按可疑）→ 高风险类型强制人工（新增文档 / 配置 / 记录类）→ 干净文件批量 add，可疑留工作区输出三段式报告（✅已加入 / 👁需过目附理由 / 🚫不建议入库）；授权边界：触发即授权当次 add 预检通过文件，对暂存区只增不改。② 本机 `~/.gitleaks.toml` 全局规则配置（[extend] useDefault = true 保留内置约 200 种密钥规则 + 自定义公网 IPv4 规则含私有段 / 文档段 / 公共 DNS allowlist；服务商词表留注释占位由用户自行补充；不入镜像范围）。③ 本机 `~/.config/git/hooks/pre-commit` + `git config --global core.hooksPath`：commit 前对暂存区再扫一道（含仓库级逃生门 `git config hooks.gitleaks false`、行级豁免 `gitleaks:allow`、gitleaks 缺失时放行防卡死；不入镜像范围）。④ 全局 CLAUDE.md「Git 暂存区禁止 AI 自主增删改」第 2 条修订为「删改禁」，新增第 3 条 add 授权例外（把关方式升级而非取消）。⑤ commit skill 六处「用户已自行 git add」口径改为「经 /add 预检加入或用户手动 add」（description 944→952 字符，行为零变化）。
- **验证**：gitleaks 三路径实测——自定义规则命中（公网 IP）、内置规则命中（AWS 假 key，证明 extend 生效）、allowlist 正确放行（私有段 / 公共 DNS / 文档示例 key）；hook 四场景实测——脏暂存区拦截（exit 1）、干净放行（exit 0）、行级豁免、仓库级逃生门；RE2 兼容性坑已踩平（Go 正则不支持 lookbehind）。git commit 集成路径未直接测试（git-commit-guard 正确拦截 AI 测试性 commit，属预期行为，待用户真实提交流程自然验证）。
- **镜像同步**：`claude/skills/add/SKILL.md`（新建）、`claude/skills/commit/SKILL.md`、`claude/CLAUDE.md` 已同步 diff 逐字节一致；`~/.pi/agent/skills` 为指向 `~/.claude/skills` 的符号链接自动跟随。

### 变更（skill-creator 新增 description 长度硬关卡：事前预算 + 事后实测脚本双关卡）

- **为什么改**：commit skill 当日新增 9z 步时 description 顶到 1027 字符、超出 Agent Skills 规范 1024 上限（pi 端报 Skill conflicts），且此类超限已发生多次——根因是长流程型 skill 的 description 常驻离上限一步之遥（commit 现 944、agent-reach 901），任何增量修改都可能顶爆，而长度靠肉眼估算从不可靠。按「规矩必须配套工具强制」元规则补机器判定。
- **改了什么**：① 新建 `scripts/check_description.py`：解析 SKILL.md frontmatter description（单行带/不带引号、`|`/`>` 块标量均支持），按 UTF-16 code unit 计量（`len(s.encode('utf-16-le')) // 2`，与 pi 加载器 JS `string.length` 完全同语义，含 emoji 也不偏），逐文件报 PASS/FAIL/ERR（超限报超多少、达标报余量），exit 0/1 作关卡判定；支持多文件批量巡检；② SKILL.md「Write the SKILL.md」章 description 要点后新增「description length hard gate」条目：改前先跑脚本看现长与余量、写完改完必跑脚本且 exit 0 才算交付，超限时优先把流程机制细节从 description 挪进正文（Progressive Disclosure）而非削弱触发短语；附限制出处（Agent Skills spec / pi `[Skill conflicts]` 警告行为）。验证：全量 15 个 skill 巡检全 PASS（commit 944、agent-reach 901 为仅有的两个贴顶项）；构造用例（超限 FAIL / 块标量解析 / 缺 description ERR）全部符合预期。
- **镜像同步**：`claude/skills/skill-creator/`（SKILL.md + 脚本）已同步 diff 逐字节一致；`~/.pi/agent/skills/skill-creator/` 与权威源同 inode 硬链接自动跟随。

### 变更（commit skill 新增 9z 步：等待 PR 合并后自动对齐本地 main，/commit 当次闭环不留分叉尾巴）

- **为什么改**：2026-09-22 pi 仓库 /commit 实战——PR 被 CI squash 合并后本地 main 与远端产生「内容相同但哈希不同」的分叉，对齐只能靠下次 /commit 的 0a 步兑底（分叉场景还要人工 rebase），每次都留一步手动尾巴。用户立规：把「等 CI 绿 + auto-merge 合并进 remote main + 合并后自动对齐本地 main」加进 commit skill 末尾，当次闭环。
- **改了什么**：commit/SKILL.md 共 8 处：① 新增「9z. 等待 PR 合并并对齐本地 main」步（插在第 9 步之后、第 10 步之前；仅第 8 步走了 PR 通道的场景执行；轮询 `gh pr view --json state,mergedAt` 上限 15 分钟，超时不阻塞交 0a 兑底；CI 失败 / PR 被关 / 异常即停均如实报告；合并后对齐分两场景——功能分支场景 `git switch main` → `git merge --ff-only origin/main` → `git branch -D`，main 兑底通道场景 `git branch -f main origin/main` → `git switch main` → `git branch -D <chore分支>`，全部非破坏性命令、绝不自动 rebase；删分支用 -D 的原因：squash 合并后无祖先关系，内容已进 squash commit、不丢信息）；② 第 8 步两处「不等 CI」「对齐方式由用户决定」改为指向 9z；③ 0a 步补与 9z 互补说明；④ 「注意」段、⑤ 「汇报」段两处、⑥ frontmatter description 同步更新。回归检查：与 2026-09-21「远端 main 对齐前置检测 + PR 兑底通道」条目无冲突——0a 保留不变（兑底跨会话 / 9z 超时 / 异常即停场景），9z 纯增量当次闭环，两者互补不替代。
- **镜像同步**：`claude/skills/commit/SKILL.md` 已同步 diff 逐字节一致；`~/.pi/agent/skills/commit/SKILL.md` 为硬链接自动跟随。**修复**：初版 description 1027 字符超出 pi 端 skill 加载器 1024 上限（加载报 Skill conflicts），当日精简 9z 段（206→123 字符，砍掉场景 A/B 具体命令细节——正文 9z 步全有，description 留行为概要）至 944 字符并重新同步三端。

### 变更（镜像范围口径对齐：全面统一为三部分 skills / CLAUDE.md / docs，清理 rules 时代残留）

- **为什么改**：docs/ 早在 2026-09-12 已纳入镜像为第三部分，但 2026-09-14 的 rules 残留口径清理把「三部分」当成 rules 时代旧说法（skills / rules / CLAUDE.md）统一改成了「两部分」，误伤了 docs 口径，造成多处漂移：本 CHANGELOG 头部、agents-registry 的 Prometheus 行、「capability-sync.md『怎么验证』节数词与括号列举自相矛盾（写两部分却列了三个）」、capability-manager skill 的 SKILL.md 场景 A 步骤与两个 references。用户要求对齐。
- **改了什么**：① `CHANGELOG.md` 头部列举改三部分；② `claude/docs/agents-registry.md` Prometheus 行「两部分」→「三部分」（权威源 `~/.claude/docs/agents-registry.md` 同步修改，逐字节一致）；③ `claude/docs/capability-sync.md`「怎么验证」数词改三部分（权威源同步）；④ `.claude/skills/capability-manager/SKILL.md`：场景 A 步骤 3 的旧「skills / rules / CLAUDE.md」改「skills / CLAUDE.md / docs」、脚手架步骤「复制通用 skills / rules / settings」去掉已废弃的 rules；⑤ `references/content-lifecycle.md`：通用原则改三部分、判断矩阵补 docs 参考文档行、结尾同步范围列举补 docs；⑥ `references/sync-flow.md`：同步范围改三部分、同步情形 1 / 3 的 cp 命令补 docs、一致性核对与巡检的 diff 命令补 docs、数词全部改三部分。

### 变更（项目定位口径去「Claude Code」限定：智能体团队/舰队已不限于单一 harness）

- **为什么改**：智能体舰队如今不仅建立在 Claude Code 之上，也包含其它 harness（如 pi、DSH），「Claude Code 智能体团队/舰队」的限定词以偏概全，用户要求不再强调 Claude Code。
- **改了什么**：去掉「Claude Code」限定词，统一改为中性的「智能体团队/舰队」表述，共 6 处：① 本 CHANGELOG 头部项目定位句；② `claude/docs/capability-sync.md`（权威源 `~/.claude/docs/capability-sync.md` 同步修改，全局与镜像保持逐字节一致）；③④ `README_cn.md` 两处 + `README.md` 两处（双语同步）；⑤⑥ `.claude/skills/capability-manager/SKILL.md` 的 description 与正文各一处。

### 变更（icon-design skill 新增文字边界硬校验：事前预算公式 + 事后实测脚本双关卡）

- **为什么改**：codef 项目 `assets/logo.svg` 副标题文字超出画布被裁切（渲染像素检测证实文字像素顶到画布右边缘），且用户反馈该问题「经常出现」。根因：skill 原自检清单三项（外轮廓 / 配色 / 构图）全为**主观项**，没有任何文字宽度的量化关卡；而 `<text>` 实际渲染宽度是逐字符 advance width 之和、随字体字号变化，凭直觉给 x 坐标与 font-size 经常偏差 20% 以上，且文字超出 viewBox 被直接裁切、看 SVG 源码发现不了——必须实测。按「规矩必须配套工具强制」元规则补机器判定。
- **改了什么**：① SKILL.md 新增「六、文字边界硬校验（含 `<text>` 的 SVG 必做）」：事前预算公式（英文比例字体平均字符宽 ≈ 0.55 em、全角 ≈ 1.0 em，`起点 x + 预估宽度 ≤ 画布宽 × 95%`，超了优先缩短文字其次降字号）+ 事后实测硬性关卡（跑校验脚本 exit 0 才算过，肉眼与源码检查不算数）+ 口径说明（5% 边距是防裁切硬底线，与构图留白 10%–15% 审美要求独立并行）；② 自检清单由三项扩为四项，第 ④ 项指向实测脚本；③ 骨架要点行提示文字必须过边界校验；④ 原「六、为什么」顺延为第七章；⑤ 新建 `scripts/check-text-bounds.py`（渲染完整 SVG 与「移除全部 `<text>`」两版图像逐像素相减得纯文字包围盒，校验落在 5% 边距安全区内；依赖 `rsvg-convert` + Pillow；支持 `--margin-pct` / `--scale` 参数）。校验器自身已双向验证：对 codef 旧 logo（长副标题）FAIL、修复后 PASS。
- **镜像同步**：`claude/skills/icon-design/` 已同步 diff 逐字节一致；`~/.pi/agent/skills/` 为硬链接自动跟随。

### 变更（dev-workflow skill 修订：commit 一律由用户亲自执行，AI 不申请授权不代行）

- **为什么改**：2026-09-22 用户裁定——commit 动作由用户亲自完成（自行 `git add` 后触发 `/commit` skill，commit + push + PR auto-merge 一条龙），AI 不再申请 commit 授权、不代行；AI 职责收敛为「交付报告列明应 `git add` 的路径与改动摘要 + 确保 `/commit` skill 覆盖所需功能（缺口先补 skill）」。dev-workflow 原表述（2026-09-21 用户立规「commit 须用户明确授权后执行、当轮授权后 AI 带 `# AI_AUTHORIZED_COMMIT` 标记执行」）与新裁定冲突。
- **改了什么**（2026-09-22）：全局权威源 `~/.claude/skills/dev-workflow/` 修订并同步镜像 `claude/skills/dev-workflow/`：SKILL.md 五处（杂事通道 `git add` 主语明确为用户；第 3 步测试 Agent 出题交接改为「交付自检后报告用户列明 add 路径，commit 由用户执行」；第 7 步 CI 红修复循环改走用户 `/commit`；流程内授权说明改为「commit 一律由用户亲自执行」；「git / gh 授权边界」段整体改写——`git commit` 从「须用户明确授权后 AI 执行」收敛为「AI 一律不代为执行，用户自行 `git add` + `/commit`，暂存区由用户亲自把关、skill 只提交暂存区内容」）；`references/test-cases.md` 两处（出题动线与 Hopper 主通道描述同步）。pi 端 `~/.pi/agent/skills/` 副本与权威源同文件，自动一致。

## 2026-09-21

### 变更（commit skill 第 10 步新增工具强制：git status 收尾必须真实执行，pi 端 git-status-guard 扩展兑底）

- **为什么改**：当日 pi 会话 /commit 汇报收尾时 AI 没有实际执行 `git status`，凭上下文手工拼了一段假输出贴进代码块——既猜错工作区状态（实际 working tree clean，拼的是有未暂存改动），还拼出真实 git 不会输出的 `git cast -A` 提示语，被用户自己执行 git status 后发现不一致。用户裁决：按「规矩必须配套工具强制」元规则补工具强制，防「忘执行 / 贴错 / 编造」三种失守。
- **改了什么**：① 新建 pi 端扩展 `~/.pi/agent/extensions/git-status-guard.ts`：强制锚点为带 `# AI_AUTHORIZED_COMMIT` 标记的 `git commit`（与 git-commit-guard 授权判定同源），三层防线——commit 的工具结果追加提醒（收尾必须实际执行 `git status` 并原样贴出）；assistant 最终消息里的 `>> git status` 代码块与扩展实测输出逐字比对（规范化换行与行尾空白），不符即替换为真实输出并加警示行（编造 / 贴过期输出 / 贴 `--short` 变体都会被纠正）；run 结束（agent_settled）仍无 status 代码块时实测 git status 直接 notify 用户曝光。状态生命周期 agent_start 重置、tool_call 置位、settled 清除；判定与执行全程防御性 catch 不阻塞会话；敏感扫描 / cache 检测命中即终止的场景无 commit 无锚点、仍靠文本纪律。冒烟测试 8 场景通过（编造替换 / 真实放行 / 行尾空白差异规范化后放行 / 漏贴兑底 notify / 非授权全链路不触发），pi print 模式真环境加载无错；② commit/SKILL.md 第 10 步增补「工具强制」说明（代码块内容必须来自真实执行、不得凭推断拼造，含事故记录），「注意」段加对应条目；CC 端 Stop hook 配套待补，文本已注明。
- **镜像同步**：`claude/skills/commit/SKILL.md` 已同步 diff 逐字节一致；`~/.pi/agent/skills/commit/SKILL.md` 为硬链接自动跟随；pi 端扩展不在 Prometheus 镜像范围。

### 变更（commit skill 两项流程新增：远端 main 对齐前置检测 + main 禁推时自动走 PR 兜底通道）

- **为什么改**：当日 pi 仓库 /commit 实战暴露两个流程缺口——① 本地 main 落后 origin/main（PR 被 CI squash 合并后没跟上）时直接走到 push 必撞 non-fast-forward，push 被拒后只能人工指引建分支，每次都要用户手动补一步；② remote main 已锁定直推（分支保护），skill 原行为是「如实报告 + 指引 PR 通道」，但指引后的建分支 / push / 建 PR / auto-merge 全套动作要用户重新驱动，体验断裂。用户立规补两条：流程最前面加远端对齐检测、最后面加 main 禁推时自动走分支 PR + CI 自动合并通道。
- **改了什么**：① 新增第 0a 步「远端 main 对齐检测」（原第 0 步分支感知顺延为 0b）：`git fetch origin` 后用 `git rev-list --count main..origin/main` / `origin/main..main` 判领先关系——远端领先且本地不领先（纯落后）直接拉取对齐（main 上 `git pull --ff-only origin main`，其它分支上 `git fetch origin main:main` 快进 main 引用不动工作区）；两边分叉或拉取失败等矛盾 → 暂停询问用户（流程内决策点，非敏感扫描类终止，答复后可继续不须重新 /commit），不自行改写历史；② 第 8 步 main push 被分支保护拒绝或 non-fast-forward 拒绝时，不再只作指引，自动执行 PR 兜底通道：`git switch -c chore/<事项>` 带上本地 main 领先提交 → push 分支 → `gh pr create` → `gh pr merge --squash --auto --delete-branch` 启用 auto-merge（CI 绿自动合并）；本地 main 与远端对齐方式仍由用户决定（AI 不执行 reset / force）；③ description / 导语 / 「核心定位」/ 0 步 main 分流 / 「注意」/ 「汇报」段同步对齐新行为（汇报段加 PR 兜底场景的报告项：拦截原因 / 分支名 / PR URL / auto-merge 状态 / 本地 main 对齐提醒）。
- **镜像同步**：`claude/skills/commit/SKILL.md` 已同步 diff 逐字节一致；`~/.pi/agent/skills/` 为硬链接自动跟随。

### 变更（全局 TODO 新规：TODO 与 GitHub Issue 不得重复，转移到 Issue 的条目必须归档）

- **为什么改**：dev-workflow 已定 GitHub Issue 为需求端（问题随手开 Issue、fixes #N 合并自动关闭），同一待办事项容易同时挂在项目 TODO.md 与 Issue 两处，状态会漂移（一边关了另一边还挂着）；用户立规：两边不得重复，TODO 条目转移到 Issue 后必须归档。
- **改了什么**：全局 CLAUDE.md「待办（TODO）管理」章节新增一条「TODO 与 GitHub Issue 不得重复（同一事项单一在途源）」：同一事项只允许在一个地方在途；为某条待办建了对应 Issue（或决定改由 Issue 追踪）后，该条目移入 TODO-archive.md、标 `✅**已转移**` + 指向 Issue（如 `（已转移至 Issue #42）`），不留在 TODO.md；反向同理——已在 Issue 追踪的事项不再写进 TODO.md，建 Issue 前查 TODO.md、记 TODO 前查 Issue 列表。归档动作沿用现有「移出 TODO 一律进归档」闭环，未新增其它机制。
- **镜像同步**：`claude/CLAUDE.md` 已同步 diff 逐字节一致；顺带修复该镜像落后全局的既有分叉（「待办无可选项」句此前只改了全局未同步镜像，本次 cp 整体覆盖一并对齐）；`~/.pi/agent/CLAUDE.md` 为软链接指向全局文件、自动生效，无需同步。

### 变更（commit 授权收紧：不论分支/worktree/流程一律须用户明确授权，hook 硬拦截配套）

- **为什么改**：pi 会话中开发 Agent 依 dev-workflow 旧表述「流程内授权功能分支 commit」未经用户确认直接执行了 `git commit`，与全局铁律「commit 唯一授权入口 `/commit`」直接冲突；用户裁决：铁律优先，commit 不论哪个分支、哪个 worktree、哪条流程都必须用户明确授权，并按「规矩必须配套工具强制」元规则补 hook 硬约束。
- **改了什么**：① 全局 CLAUDE.md 铁律第 1 条修订——明确授权仅两种形式（用户主动发起 `/commit`，或用户当轮消息明确授权 commit；AI 列命令后用户点头不算），配套 `# AI_AUTHORIZED_COMMIT` 授权标记机制（仅上述两场景使用）；② dev-workflow/SKILL.md「git / gh 授权边界」将 `git commit` 移出授权清单（含测试 Agent 出题后与 CI 红修复循环的 commit），第 3 步、第 7 步及 references/test-cases.md 同步对齐；③ commit/SKILL.md 串联命令模板 `git commit -m "<msg>" && git push` 尾部带 `# AI_AUTHORIZED_COMMIT` 标记 + 标记语义说明（`/commit` 触发即明确授权）；④ hook 两份：`~/.claude/hooks/pre-tool-use-guard.sh` 新增规则 3（无标记 `git commit` 一律 deny），新建 `~/.pi/agent/extensions/git-commit-guard.ts`（pi 端，与 CC 端判定对齐：`git commit` / `git -C <path> commit` / 选项带参数形态全覆盖，`git log --grep=commit`、`git checkout`、`git commitfoo` 等不误伤，含字样即拦属明确取舍宁误拦不漏拦；正则单测 13 组 + CC 端实测 8 组通过，TS 语法检查通过）。
- **镜像同步**：`claude/CLAUDE.md`、`claude/skills/dev-workflow`、`claude/skills/commit` 已同步 diff 逐字节一致；`~/.pi/agent/skills/` 为硬链接自动跟随；CC 端 hook 与 pi 端 extension 不在 Prometheus 镜像范围。CC 端 hook 每次调用新进程即时生效；pi 端 extension 新会话加载生效。

### 变更（全局注册表超集映射表加行：Wright 新增子项目 agent-team-playbook-src）

- **为什么改**：用户为 The Agent Team Playbook 付费产品建专门私有仓库做版本管理（tag + gh release 附分语言 zip），作为 ProductProducerAgent（Wright）的子项目登记。
- **改了什么**：`agents-registry.md` 超集映射表在 Wright → GitComic 行后加一行：Wright → agent-team-playbook-src（产品私有源仓库；与公开落地页仓 agent-team-playbook 区分）。
- **镜像同步**：`claude/docs/agents-registry.md` 已同步，diff 与全局逐字节一致。

### 变更（同日三次修订：Issue 作需求端，测试开发分离 + 测试先行，hook 护测试文件全量）

- **为什么改**：同日用户三次修订 dev-workflow 需求端与测试权属——① GitHub Issue 作为需求端（平时遇到问题随手开 Issue、有空再解决，主流开源模式；Issue open/closed 替代 test-cases 的 pending/passed 状态机，fixes #N 合并自动关闭，归档动作整体消失）；② 测试开发分离 + 测试统一先行（用户推演：小改动不写测试则回归防护网有缺口、后补测试会写成快照式断言、同会话自己写隔离太薄——测试文件对开发物理可见可改，纪律墙不硬）；③ 测试 Agent（Hopper）主通道出题（读 Issue 在功能分支写测试、自跑见红、commit；独立会话降为无测试 Agent 环境的代行——先行时序下实现尚不存在，出题上下文天然无实现）；④ 开发对测试文件全量只读可运行（hook 从只护 test-cases/ 扩展到测试目录段 + 测试文件名全量）。
- **改了什么**：① dev-workflow/SKILL.md 十一步重写（第 1 步门禁改为 Issue + 远端门禁就位；新第 3 步测试先行——测试 Agent 出题先红、开发才开工；第 4 步纪律改为测试文件全量只读；第 5 步对齐后改查 Issue 与测试 commit 变更；第 6 步口径简化为全绿；第 7 步 PR 带 fixes #N；第 8 步收尾无归档；核心逻辑与角色分立重写：用例定义权归测试 Agent、实现权归开发、合并裁决权归 CI、发布裁决权归用户）；② references/test-cases.md 重写（Issue 需求端与状态机、先红后绿时序及「分支内先行、不先进 main」论证、三源出题、hook 全量保护、存量 test-cases/ 迁移指引、Hopper 外部权威源镜像机制随目录体系取消）；③ references/acceptance.md 与 merge-discipline.md 对应更新（修复循环改为「开 Issue → 测试 Agent 先写失败测试 → fix 分支」，需求变更走 Issue 更新通道）；④ commit/SKILL.md 清理归档分支措辞、PR body 加 fixes #N；⑤ hook 两份同步扩展：`~/.claude/hooks/test-cases-guard.py`（四端共用）与 `~/.pi/agent/extensions/test-cases-guard.ts` 判定逻辑逐条对齐——保护对象扩展为测试目录独立段（test / tests / __tests__ / __snapshots__ / spec / e2e）+ 测试文件名（*.test.* / *.spec.* / test_*.py / *_test.py / *_test.go / conftest.py / *.snap）+ 存量 test-cases/，整段 / 全名匹配不误伤 latest / contest / testcase，重定向目标判定泛化，Bash 预筛扩展；Python 版 23 组判定用例全部通过（应拦 11 路径 + 11 命令，放行 8 路径 + 12 命令），TS 版语法转译与模块加载验证通过（pi 端新会话生效）。
- **镜像同步**：`claude/skills/` 五文件已同步 diff 一致；`~/.pi/agent/skills/` 为硬链接自动跟随；pi extension（`~/.pi/agent/extensions/test-cases-guard.ts`）为 pi 端专属、不在 Prometheus 镜像范围。

### 变更（同日二次修订：合并去人工门禁，验收过程化，人工门禁落点移到正式发版）

- **为什么改**：同日用户二次修订 dev-workflow 门禁分工——「CI 绿即 auto-merge 合并」的合并环节去掉用户验收条件（合并由 CI 独裁，不等人工）；用户验收是过程而非瞬时门禁：复杂项目 CI 较慢，等待窗口正好先从功能分支预发布，用户体验预发布版本就是在验收，需要一段时间；试用满意、且功能已合并进 main 后才正式发版——人工门禁从「合并前」移到「发版前」，发现问题走修复循环（fix 分支 + PR + CI + 新 rc），发版推迟到满意为止。
- **改了什么**：① dev-workflow/SKILL.md 十步重排（第 6 步 push+建 PR+enable auto-merge 一体化，合并即 CI 绿自动执行；新第 7 步合并后收尾；新第 8 步使用验收（过程：预发布试用、修复循环、需求变更通道）；新第 9 步正式发版（/bump + /release 由用户触发，触发即验收通过的表达）；删「验收后冻结 PR head」纪律；授权边界改为 auto-merge 标准动作；核心逻辑改为「main 必须永远绿，正式发布的版本必须是用户使用验收过的」）；② merge-discipline.md：门禁分工改为「合并裁决权归机器（分支保护 + CI 独裁）、发布裁决权归用户（试用满意才发版）」，删验收冻结段、新增合并后修复循环段，门禁精确含义分两层表述；③ acceptance.md 重写为「预发布试用与发版验收」（验收为何过程化、预发布主通道 + 本地测试包轻量选项、修复循环、main 与发布语义闭环：main = CI 绿集合、正式发布 = 用户试用过的 main 快照、预发布是桥）；④ test-cases.md：归档安全性依据改为「CI 机器裁决完成即归档，试用发现问题开新用例组新编号、旧组不复活」；⑤ commit/SKILL.md：建 PR 后统一顺手 enable auto-merge（gh pr merge --squash --auto --delete-branch），不手动 merge，汇报节提醒改为「发版前确认用户已预发布试用满意且 PR 均已合并」；⑥ release/SKILL.md：预发布 tag 落点扩展（合并前功能分支 / 合并后 main 两阶段均可，体验即验收），试用后处置（问题 → 修复循环递增 rc；满意 → 正式发版）；⑦ bump/SKILL.md：第 6 步改为确认 auto-merge（commit skill 建 PR 时已顺手 enable，未启用则补）。
- **镜像同步**：`claude/skills/` 七文件已同步，diff 与全局逐字节一致；`~/.pi/agent/skills/` 为硬链接自动跟随。

### 变更（dev-workflow 改回远端主流模式：main 分支保护 + PR + CI 门禁 + 预发布，四 skill 联动改版）

- **为什么改**：用户 2026-09-21 裁定，开发流程回归主流形态——remote main 分支锁定直推（分支保护）、一切经 PR、CI 通过才能合并进 main、回归防护网放 CI 里；正式发布必须在功能合并进 main 之后，合并前可从功能分支预发布。取代 2026-09-07 的本地裁决版（无 PR 无 CI、main 可直推、本地快进合并）。旧版把裁决全部压在本地（本地全量测试 + 本地超集校验 + 快进合并），「绿」与「可合并」无结构绑定，依赖纪律而非平台机制；新版把机器门禁移到远端 CI + 分支保护 required checks，合并条件由 GitHub 结构性强制。
- **改了什么**（全局 `~/.claude/skills/` 四个 skill + 根 CLAUDE.md）：
  1. **dev-workflow/SKILL.md 全面改写**：十步新流程（定性 → 开工门禁（用例组 + 远端门禁就位）→ worktree + 功能分支 → 开发纪律 → 对齐 origin/main → 本地全量测试（预检）→ push + 建 PR 远端 CI 裁决（权威）→ 用户验收（人工门禁，可选预发布安装来源，验收后冻结 PR head）→ 合并 PR（CI 绿 + 验收过，squash + 可 auto-merge）→ 收尾（归档小 PR、删分支、清 worktree））。杂事不再「main 直改直推」，同样经 chore 分支 + PR + CI；第 1 步新增远端门禁就位检查（分支保护配置 + ci.yml 最小规范，含首次启用顺序「先 ci.yml 进 main、再开保护设 required」防死锁）；git/gh 授权边界扩展（push 功能分支 / gh pr create / gh pr merge / 预发布 tag + --prerelease 属流程内授权）。
  2. **references/merge-discipline.md 重写**：超集校验 + 快进合并论证 → 三重门（分支保护结构性门 / 远端 CI 机器门 / 用户验收人工门）+ 验收冻结（验收后不 push 新 commit）+ squash 树等价（merge 后 main 的树 == PR head 的树，物理基础从本地快进换成平台 merge 语义）+ up-to-date / update-branch 并行循环 + 复验口径。
  3. **references/test-cases.md**：新增「CI 集成」一节（ci.yml 最小规范：pull_request + push main 触发、单测 + test-cases 全量 + 类型检查、required checks、存量仓库恢复启用、CI 红处置）；同步机制落地改为「同步分支 + PR」；归档改为「归档分支 + 小 PR + CI 绿 auto-merge」；强度边界段更新（CI 恢复后的增益：回归网持续生效 + 干净环境独立复核，防 hack 仍靠人工验收 + Hopper）。
  4. **references/acceptance.md**：验收安装来源两选项（本地测试包 / 预发布 Release）；验收期间 main 变动改为 up-to-date 自动挡 + 复验口径；main 语义闭环更新（main = CI 绿 + 功能类验收过的集合；预发布是 main 外的前瞻快照）。
  5. **commit/SKILL.md**：分支感知三通道（main 仅无保护仓库可直推，被保护拒绝时如实报告 + 指引建分支走 PR；功能 / 杂事 / bump 分支 push 后顺手建 PR 若无；不 merge）；汇报节同步更新；description 改写。
  6. **bump/SKILL.md 重写**：main 直改直推 → 建 `chore/bump-v<版本>` 分支改齐版本号 → /commit（push + 建 PR）→ enable auto-merge（CI 绿自动 squash 合并进 main）；三段式发版表格更新（② 段从「/commit 直推」变为「CI 绿 auto-merge」）。
  7. **release/SKILL.md**：新增「预发布通道」一节（功能分支打 `v<目标版本>-rc.N` / `-beta.N` tag 发 --prerelease Release，不 bump 版本文件，供合并 main 前验收 + 早期尝鲜；迭代递增 N，旧预发布保留）；第 0 步改「路径分流 + 对齐 remote main」（正式版只从 main、功能须已合并；预发布走专属通道跳过版本就绪校验）；「注意」节补预发布必带 --prerelease。
  8. **全局 CLAUDE.md**：「/commit 例外」段的 /commit 定义补一句「在非 main 分支上 push 后顺手建 PR（remote main 已锁定直推，2026-09-21 起）」。
- **镜像同步**：`claude/skills/` 四 skill + `claude/CLAUDE.md` 已同步，diff 与全局逐字节一致；`~/.pi/agent/skills/` 为硬链接自动跟随（CLAUDE.md 为符号链接）。

## 2026-09-20

### 变更

- **agents-registry.md 同步：ghostty 行改为独立分叉表述**（`claude/docs/agents-registry.md`）。为什么改：全局权威源同步更新——xhqing/ghostty 已于 2026-09-20 断开与原上游 ghostty-org/ghostty 的 fork 关系（GitHub 独立仓库状态），此后自主演进；原「个人 fork、跟上游版本 rebase 维护」表述过期。改了什么：ghostty 行改为「独立分叉仓库……断开 fork 关系、自主演进，v1.3.1 基线 + 贴图补丁」（源变更记 FullStackEngineerAgent CHANGELOG）。

- **agents-registry.md 同步：Atlas 职责行列举更新、映射表补 cmux-launcher 与 ghostty 两行**（`claude/docs/agents-registry.md`）。为什么改：全局权威源同步更新——cmux-launcher 纳入时漏改注册表（历史欠账，本次补齐）；ghostty（Ghostty 终端个人维护 fork，Cmd+V 粘贴剪贴板图片为临时文件路径补丁）正式成为 Atlas 第六个子项目；Atlas 职责行的项目列举已过时，改为概括式并指向映射表（源变更记 FullStackEngineerAgent CHANGELOG）。

## 2026-09-19

### 变更

- **agents-registry.md 的 pi 行改为独立分叉表述**（`claude/docs/agents-registry.md`）。为什么改：全局权威源同步更新——xhqing/pi 已于 2026-09-19 在 GitHub 断开与 earendil-works/pi 的 fork 关系，此后自主演进；原「个人 fork、跟上游同步并做个人维护」表述过期，会误导后续会话去做上游同步。改了什么：pi 行改为「独立分叉仓库……断开 fork 关系，自主维护演进」（源变更记 FullStackEngineerAgent CHANGELOG）。

### 变更（release skill 新增「产物惯例核查」防裸发）

- **为什么改**：2026-09-19 在 pi fork 发 v0.86.0 时，release skill 的产物探测（`*.vsix` / `dist/*` / `build/*` / `target/*.zip`）对「产物由 CI 或专用脚本构建、发布前本地不存在」的项目零命中（pi 的产物是 CI 构建的各平台二进制包），探测为空后安静走了无产物发布分支，GitHub Release 裸发无任何 assets、事后人工构建补挂。根因两层：① 探测模式偏 VSCode 扩展，对 CI 中心化项目形态覆盖不到；② 探测为空时无「本项目按惯例应有产物」的对照告警。另外 fork 仓库 CI 链不可用（GitHub 对 fork 默认抑制 workflow 运行、发布类 secrets 缺失），产物只能本地构建，本地核查必须补位。
- **改了什么**：全局 `~/.claude/skills/release/SKILL.md` 第 7 步新增「产物惯例核查（本地探测为空时必做）」：探测为空时核查三个信号（tag 触发的产物构建 workflow / fork 场景 upstream 同名 Release 挂有 assets / 本仓库历史 Release 挂过 assets），任一命中即暂停指引先构建再上传（优先仓库自带构建脚本 + 冒烟验证 + `gh release upload`），三信号皆不命中才照旧无产物发布；同时注明本地直接建正式 Release 与 CI「draft → 转正」编排的互斥关系。探测列表补入 `*.tgz`。「注意」节同步增补对应提醒。镜像同步：`claude/skills/release/SKILL.md` 已同步，diff 与全局逐字节一致；`~/.pi/agent/skills/` 为硬链接自动跟随。

### 变更（dev-workflow description 修正适用前提歧义：无 test-cases 体系不是绕过的理由）

- **为什么改**：2026-09-19 在 pi 项目（无 `test-cases/` 验收用例体系）要求解决 Issue #1（cursorStyle 核心功能），开发会话未触发 dev-workflow，直接在 main 上开发并提交。排查定位到 description 开头「存在测试用例的软件开发项目的核心功能开发循环」被误读为项目现状前置筛选条件（项目尚无用例体系 → 前提不满足 → 不触发）。这与流程自身逻辑矛盾：第 1 步开工门禁本来就设计了「无用例组 → 阻塞并引导建立」的从零建系路径，若从未建过用例体系的项目永远不触发，该路径永远无法执行。溯源自 2026-09-07 用户裁定「只有存在测试用例的软件开发项目才走 dev-workflow」，政策实质是「纯杂事不走、核心开发走」，本次修正消除歧义、贴合政策原意，不改变政策本身。
- **改了什么**：全局 `~/.claude/skills/dev-workflow/SKILL.md` description 两处：① 开头定语「存在测试用例的软件开发项目」改为「软件开发项目」（适用范围按项目性质而非项目现状判定）；② 触发段新增「项目尚无 test-cases 验收用例体系不是绕过本流程的理由——此时同样必须使用，第 1 步开工门禁会阻塞并引导先建用例组」。正文未动（第 0 步、第 1 步逻辑本就自洽）。镜像同步：`claude/skills/dev-workflow/SKILL.md` 已同步，diff 与全局逐字节一致；`~/.pi/agent/skills/` 为硬链接自动跟随。关联：pi 项目根 `CLAUDE.md` 的 Development Rules 同日新增本地增补小节，明确该项目核心开发同样走 dev-workflow（pi 为 fork 仓库、无根 CHANGELOG，不另记）。

- **为什么改**：用户新建 GitComic 子项目（Git 漫画书产品线仓库，位于 `~/Developer/GitComic`）并由 ProductProducerAgent（Wright）负责；按「新增 / 变更子项目时以映射表为准」规则，在全局注册表映射表登记。
- **改了什么**（2026-09-19）：全局 `~/.claude/docs/agents-registry.md` 超集映射表新增一行：ProductProducerAgent（Wright）→ GitComic（Git 漫画书产品线仓库：试读 PDF + 引流图卡，en/zh 双语，后续全本迭代在该仓进行；制作资产与交付物在本机被忽略的 artifacts/）。镜像同步：`claude/docs/agents-registry.md` 已同步，diff 与全局逐字节一致。

### 变更（超集映射表新增 pi 子项目行）

- **为什么改**：用户将 pi（Pi agent harness 的个人 fork，fork 自 earendil-works/pi，位于 `~/Developer/pi`）变更为 FullStackEngineerAgent（Atlas）负责的子项目；按「新增 / 变更子项目时以映射表为准」规则，在全局注册表映射表登记。
- **改了什么**（2026-09-19）：全局 `~/.claude/docs/agents-registry.md` 超集映射表新增一行：FullStackEngineerAgent（Atlas）→ pi（Pi agent harness 的个人 fork，TypeScript monorepo：coding agent CLI / agent 运行时 / 统一多供应商 LLM API / TUI 组件库，跟上游同步并做个人维护）。镜像同步：`claude/docs/agents-registry.md` 已同步，diff 与全局逐字节一致。

### 变更（全局默认输出语言改回中文）

- **为什么改**：2026-09-18 应用户要求由中文改为英文默认；现用户再次调整，改回中文为默认输出语言。
- **改了什么**（2026-09-19）：全局 `~/.claude/CLAUDE.md`「Language」节第一条改为「默认使用**中文（简体中文）**回答用户」；例外为用户明确要求其他语言（用英语提问视为陪练场景，按「用户英语陪练」用英语回答）或上下文明显需要其他语言；普通话行文、排版、中文标点三条改为「约束中文输出——默认输出中文，故常态适用」。镜像同步：`claude/CLAUDE.md` 已同步，diff 与全局逐字节一致。

### 变更（新增「最终结论前先输出『==============』框线」输出规矩）

- **为什么改**：用户要求回复的最终结论与执行过程内容明确区分——过程内容之后、结论之前先单独一行输出「==============」框线，让用户一眼定位结论，不用在过程叙述里翻找。
- **改了什么**（2026-09-19）：全局 `~/.claude/CLAUDE.md`「输出风格」节新增条目（作为首条）：回复既有执行过程内容（读文件、跑命令、中间分析、逐项检测结果等）又有最终结论时，先输出完整过程内容，然后单独一行输出框线「==============」（14 个等号），紧接着输出最终结论；只有结论、没有过程内容的简短回复不硬加框线；框线行单独成行、上下留空行（避免被 Markdown 渲染成标题线）。镜像同步：`claude/CLAUDE.md` 已同步，diff 与全局逐字节一致。

## 2026-09-18

### 变更（全局默认输出语言改为英文）

- **为什么改**：用户要求把全局规则的默认输出语言设为英文（原为简体中文）。
- **改了什么**（2026-09-18）：全局 `~/.claude/CLAUDE.md` 「Language」节第一条改为「默认使用**英文（English）**回答用户」，例外不变（用户明确要求其他语言、或上下文明显需要其他语言时照用），并注明普通话行文、排版、中文标点三条仅在输出中文时适用。镜像同步：`claude/CLAUDE.md` 已同步，diff 与全局逐字节一致。

### 变更（新增「用户英语陪练」规则：意图不明先问、语言问题及时纠）

- **为什么改**：用户英语不算好但正在主动学习，会尽量用英语交流；需要配套规则保证：意图看不清时不瞎猜，同时随手纠错帮助提升。
- **改了什么**（2026-09-18）：全局 `~/.claude/CLAUDE.md` 「Language」节新增一条「用户英语陪练」：① 意图不确定就先问，不要凭猜测动手；② 发现用户用词、搭配、语法问题当场指出并给出更地道的说法（原句 → 建议写法），纠错简短友好、不喧宾夺主。镜像同步：`claude/CLAUDE.md` 已同步，diff 与全局逐字节一致。

## 2026-09-16

### 变更（QSAgent 体系概念修正：删「公开门面 / 私有本体」表述，QuantStrategistAgent 确立为 Agent 项目、Intraday / Swing / gridtrader 为其子项目）

- **为什么改**：用户裁定——只有以 Agent 结尾命名的仓库才是真 Agent 项目，「私有本体 / 公开门面」这套两分概念作废。原注册表把 Intraday（原 QuantStrategistAgent 改名而来）当 Agent 项目、仅挂 gridtrader 一个子项目，Swing 与 Intraday 的归属悬空，体系口径与用户口径（QuantStrategistAgent 是 Markowitz 的 Agent 项目）不一致。
- **改了什么**（2026-09-16）：① 全局 `~/.claude/docs/agents-registry.md` 超集映射表：删「Intraday（Markowitz 量化私有本体，原名……）| gridtrader」行，改为「QuantStrategistAgent（Markowitz）→ Intraday / Swing / gridtrader」三行；② 全局 `~/.claude/CLAUDE.md` QSAgent 缩写定义同步改为「主仓库 QuantStrategistAgent + 子项目 Intraday、Swing、gridtrader」。镜像同步：`claude/CLAUDE.md` 与 `claude/docs/agents-registry.md` 已同步，diff 与全局逐字节一致。

## 2026-09-14

### 变更（清除已废弃 `~/.claude/rules/` 目录的过期描述：README 中英 + capability-manager skill 全链）

- **为什么改**：全局 `~/.claude/rules/` 目录已废弃删除（全局规则现只存在于 CLAUDE.md，见全局 CLAUDE.md「新增全局规则直接写入全局 CLAUDE.md 对应章节」），但本仓库多处文档仍把它当现存功能描述：README 中英的结构表、capability-manager skill 的同步操作指引与 references 流程（甚至教「在 `~/.claude/rules/` 建文件 + CLAUDE.md 加 @ 引用」的完整操作）——不删会误导后续同步操作指向不存在的目录。镜像目录本身已与全局一致（两侧 `rules/` 均已不存在），本次仅文档修正。
- **改了什么**（2026-09-14）：① `README.md` / `README_cn.md`——正文列举给 rules 标注载体（in `CLAUDE.md`）、结构表删 `~/.claude/rules/` 行、`CLAUDE.md` 行描述补 working rules；② `.claude/skills/capability-manager/SKILL.md`——同步操作指引删 `~/.claude/rules/` 路径，注明全局规则在 CLAUDE.md 章节内；③ `references/content-lifecycle.md`——同步范围「三部分」改「两部分（skills / CLAUDE.md）」、判断矩阵删 rules/ 行、整章删除「改 rules/」操作流程；④ `references/sync-flow.md`——同步范围改两部分并注明目录已废弃、cp / diff / 核对清单删 rules 项；⑤ 本 CHANGELOG 头部描述同步改「两部分」。注：本次只改本项目自有文件（README + 项目级 skill），不动 `claude/` 镜像内容（全局侧对应文件无 `~/.claude/rules/` 现存性描述，无需同步）。

## 2026-09-13

### 变更（分发层终结：删除「全局 ↔ 各项目 anysearch 副本」同步规则，只保留单一出口）

- **为什么改**：单一出口模式落地后，各 agent 项目已陆续清除通用 skill 副本（2026-09-13 核验：`~/Developer/*/.claude/skills/` 下无任何 anysearch 副本），但全局 CLAUDE.md 指针节、capability-sync 文档、new-agent-scaffold 边界条款里仍保留「维护各项目 anysearch 副本」「既有项目副本按需维护」的分发层规则，指向已不存在的副本，用户指出过时并授权清理。现行规则收敛为：只有 Prometheus 镜像全局并开源，其余项目零分发。
- **改了什么**：① 全局 `~/.claude/CLAUDE.md` 指针节删「维护各项目 anysearch 副本」职责，补「Prometheus 是通用能力开源的单一出口」表述；② `~/.claude/docs/capability-sync.md`——标题「跨项目同步」→「镜像同步」、「何时读」删副本维护项、删「与下方各 skill 同步小节的关系」条、删「anysearch skill 同步（全局为权威副本）」整节（留一行去向说明指向 git 历史）；③ `~/.claude/docs/agents-registry.md` Prometheus 行「新建项目不再分发副本，既有项目副本按需维护」→「只有本项目镜像全局，其余 agent 项目不再分发副本」；④ `~/.claude/docs/new-agent-scaffold.md` 边界条款由「既有项目不做强制回退清理、副本按 capability-sync 同步小节维护」改为「单一出口已全量落地、副本已全部清除、分发层终结」；⑤ 本项目 README 中英两版目录表全局 skill 举例删去已不存在的 find-skill。镜像同步：`claude/CLAUDE.md` 与 `claude/docs/` 三文档已同步，diff 与全局逐字节一致。

## 2026-09-12

### 变更（test-cases-guard 补挂 pi 端 + 需求组编号规则）

- **为什么改**：① 上一条 dev-workflow 减重落地后发现 pi 端未挂载 test-cases-guard（工具强制只覆盖 CC / ZCode / CodeBuddy / Trae 四端，pi 会话里用例目录写保护只靠文本纪律），用户要求补挂；② 用户要求需求组带编号（#123 风格），给跨会话沟通与 CHANGELOG 引用提供稳定锚点。
- **改了什么**：① 新建 `~/.pi/agent/extensions/test-cases-guard.ts`——pi 的拦截机制与 CC 不同（进程内 tool_call 事件、非外部 PreToolUse 脚本），故将 Python 版判定逻辑逐条移植为 TS extension（拦截范围、授权标记、拆段判定一致），`pi -p` 实测三项通过（无标记写操作被拦、纯读放行、`# TEST_CASES_WRITE_OK` 放行）；② dev-workflow 需求组目录命名升级为 `<编号>-<需求名>`（如 123-login-timeout）：编号项目内全局递增、永不复用（新号 = pending + passed 最大编号 + 1，与 TODO 编号同构），沟通用 `#编号` 指代，目录名不带 #（shell 与正则判定友好），出用例方定号——SKILL.md 三处占位符、test-cases.md 目录结构与三通道、acceptance.md 一处同步更新；③ test-cases.md hook 节挂载清单收录 pi 端（五端）；④ Python 版 DENY_REASON 文案同步（豁免用途补「独立会话出用例、用户授权的归档挪动」，与新流程对齐）。镜像同步：`claude/skills/dev-workflow/` 四文件已同步，diff 与全局逐字节一致；`~/.pi/agent/skills/` 为硬链接自动跟随。

### 变更（dev-workflow 测试环节减重：出用例改独立会话主通道、Hopper 转可选强化、归档授权化）

- **为什么改**：dev-workflow 原设计每次核心开发都必须经测试 Agent（Hopper）供用例 + 验收后 Hopper 归档，用户反馈对日常开发太重——用户当人肉中继传需求、等供用例、验收后再传归档，跨 Agent 往返成本大于日常开发的收益。与用户对齐后确认：重的根源是载体（专门 Agent 的协作环节）而非分权结构（用例与实现隔离，防「自己出题自己答」与「改用例迁就实现」），故保结构换载体，三个减重方案全部采纳。
- **改了什么**：全局 `~/.claude/skills/dev-workflow/`：① SKILL.md 三权分立总述改写——用例定义权泛化为「出用例方」（任何上下文里没有实现代码的独立出题者：日常独立会话、重要项目可选 Hopper），实质是上下文隔离而非人格化专门 Agent；② 第 1 步开工门禁：无用例时请用户以独立会话出用例（新开会话只喂需求文本与必要背景、带 `# TEST_CASES_WRITE_OK` 标记写入 pending），并新增「用例规模与需求体量匹配」分级（小需求轻量用例组、大功能完整用例组）；③ 第 8 步收尾：归档从「Hopper 验收归档」改为「用户授权 + 开发 Agent 带标记 `git mv` pending → passed」（hook 豁免通道原已存在，本次是规矩追上工具），重要功能可选 Hopper 独立归档验收；④ references/test-cases.md：「权威源与镜像」节改写为「用例来源与权威源」（独立会话日常主通道 / Hopper 可选强化 / 用户手写三通道，Hopper 镜像规则收为子节，「同步机制」节标注为 Hopper 通道），删「过渡期口径」节（概念随独立会话转正而取消），归档节改写（授权化通道 + diff 校验标注仅适用有外部权威源的项目），hook 强度边界补「日常靠第 6 步用户实物验收兜底」；⑤ acceptance.md / merge-discipline.md 的 Hopper 指名表述改泛称。hook 脚本 `test-cases-guard.py` 本身未动（豁免标记通道已有，无需改）。镜像同步：`claude/skills/dev-workflow/` 四文件已同步覆盖，diff 验证与全局逐字节一致；`~/.pi/agent/skills/` 为硬链接自动跟随。

### 变更（超集映射表新增 Atlas → ghostty-launcher 行，2026-09-12 晚）

- **为什么改**：用户新建 ghostty-launcher（VSCode 状态栏一键唤起外部 Ghostty 终端的扩展）并交由 Atlas（FullStackEngineerAgent）管理，按「Agent 项目与子项目的 `.claude/` 超集关系」规则，新增子项目须同步全局映射表。
- **改了什么**：全局 `~/.claude/docs/agents-registry.md` 超集关系映射表 FullStackEngineerAgent（Atlas）名下新增 ghostty-launcher 行，并按全局为权威同步覆盖本项目 `claude/docs/agents-registry.md` 镜像，`diff` 核对逐字节一致。

### 变更（全局 find-skill 提及清理：skill 已删，文档与 commit skill 联动去提及）

- **为什么改**：用户已删除全局 find-skill skill（实际使用中从未用到），但全局 CLAUDE.md、capability-sync.md、new-agent-scaffold.md、commit SKILL.md 仍多处提及（含一整节 find-skill 同步规则），全部失效，2026-09-12 清理。
- **改了什么**：①全局 `~/.claude/CLAUDE.md`「团队结构参考」指针「anysearch / find-skill 副本」→「anysearch 副本」；②`capability-sync.md`：删「## find-skill skill 同步」整节，「何时读」与「小节关系」两处表述去 find-skill，敏感信息举例由 find-skill 的 `.env` / `cache/` 换为 `settings.local.json`；③`new-agent-scaffold.md`：通用 skill 举例、边界小节表述、`.gitignore` 必含清单（删「`find-skill/.env` 与 `cache/`」）去 find-skill（第 11 行历史叙述保留——陈述的是过去事实，不指向现存物）；④commit SKILL.md cache 检测举例去 find-skill。镜像同步：`claude/` 下四个对应文件已同步，diff 验证逐字节一致。各 agent 项目 CLAUDE.md 的 find-skill 提及联动清理记各自 CHANGELOG。

### 变更（全局 CLAUDE.md 三层分流重构：592→171 行，占比 14%~20%→4%~6%）

- **为什么改**：接上午的零风险瘦身（仅 -3.4%，收益不足），用户点头执行三层分流方案——红线全量在场、低频参考资料拆独立文档、触发式规则并入对应 skill，把每个会话固定占用的上下文真正压下来（红线遵守的信号噪声比同步提升）。
- **改了什么**：①新建全局 `~/.claude/docs/`（并纳入开源镜像为第三部分）：`agents-registry.md`（注册表+流水线三小组+自动维护规则+超集关系及映射表）、`new-agent-scaffold.md`（通用能力单一出口+脚手架全套+徽章规范+双语 README 同步细则）、`capability-sync.md`（底层通用能力开源+anysearch/find-skill 同步）；②全局 CLAUDE.md 重写为 171 行：红线全保留（Git 三条、敏感信息、TODO/CHANGELOG/版本纪律、工作规则压缩版），新增「团队结构参考」指针节（四类场景→对应文档）；③Logo 双条规则并入 icon-design skill（新增「五、Logo 专项规范」节）；④Windows SSH 规范细则并入 win-ai-monitor skill（「SSH 连接」节新增「操作规范」小节，全局留 3 行红线）；⑤杀 VSC / 远程窗口压缩为钩子已拦的红线短条；⑥commit skill 四处注册表引用改指 `~/.claude/docs/agents-registry.md`；⑦capability-manager skill 与本项目 `.claude/CLAUDE.md` 的「三部分」过时说法（rules 已删）修正为「skills / CLAUDE.md / docs」。镜像同步：claude/CLAUDE.md、新增 claude/docs/、icon-design / win-ai-monitor / commit 三 skill（`~/.pi/agent/skills/` 为硬链接自动跟随）。效果：估算 token 27,408~39,485 → 7,900~11,400（占 200K 窗口 13.7%~19.7% → 约 4%~6%）。
- **并行改动找回**：重写底稿取自本会话开头快照，覆盖了同日两个并行会话的未提交改动，已按 CHANGELOG 记录与 Kit 项目子项目清单精确补回——①缩写表 DTAgent = DayTradingAgent（13:47 条目）；②超集映射表 Kit → blog 行（15:36 条目）。多会话并行改同一权威文件时此风险仍在，提醒：并行会话改全局后应尽快 commit 落库。

### 变更（超集映射表新增 Kit → blog 行，2026-09-12 15:36）

- **为什么改**：用户 2026-09-12 把 blog 仓库（docsify 静态博客）交由 Kit（ExecutiveAssistantAgent）负责，按「Agent 项目与子项目的 `.claude/` 超集关系」规则，新增子项目须同步全局 CLAUDE.md 的超集关系映射表。
- **改了什么**：全局 `~/.claude/CLAUDE.md` 超集关系映射表 ExecutiveAssistantAgent（Kit）名下新增 blog 行，并按全局为权威同步覆盖本项目 `claude/CLAUDE.md` 镜像，`diff` 核对逐字节一致。

### 变更（全局 CLAUDE.md 缩写表新增 DTAgent = DayTradingAgent，2026-09-12 13:47）

- **为什么改**：用户定义新缩写「DTAgent」代表 DayTradingAgent（Victor 的日内交易盯盘项目），持久约定需落盘到全局缩写表才可靠（否则新会话不记得）。
- **改了什么**：全局 `~/.claude/CLAUDE.md`「语言」节缩写约定段追加 DTAgent 条目（含大小写不敏感列表同步），并按全局为权威同步覆盖本项目 `claude/CLAUDE.md` 镜像，`diff` 核对逐字节一致。

### 变更（全局 CLAUDE.md 零风险瘦身：删除立规日期与修订过程叙述）

- **为什么改**：全局规则经两个多月积累已 592 行、约 2.7万~3.9 万 token（占 200K 上下文窗口 14%~19%），用户咨询是否值得瘦身，选定「零风险表述压缩」方案——只删立规日期、修订过程叙述等溯源信息，所有规则语义、边界、核心教训全部保留在场，不动任何规则的适用条件。
- **改了什么**：①35 个章节标题里的「（2026-XX-XX 用户立 / 修订 / 增补……）」历史堆叠全部删除（TODO 节标题堆叠最多，约 90 字符）；②正文内联的「（2026-XX-XX 用户修订：……）」类日期标注删除，语义并入正文；③事故叙述压缩为去日期的短句（敏感信息双事故、CC-BRIDGE 发版误判、GLM 文档优先等），教训核心全部保留；④注册表表格里的改名 / 移交 / 立规历史叙述压缩（Kit、Hopkins、Gatsby、Hopper、Prometheus 行）；⑤修复一处失效引用（`verify-before-report.md` 已随 rules 目录删除，改指本文件「工作规则」节）；⑥「临时产物存放规则」小节混入的半角标点统一为中文标点。结果：100,231 → 96,801 字节（-3.4%），估算 token 占比 13.7%~19.7% → 13.3%~19.1%。用户已知晓本次瘦身幅度有限（正文重复表述少），后续若仍需压到 200 行级别需走三层分流方案（红线在场 + 低频指针化 + 并入 skill），另行决策。本项目 `claude/CLAUDE.md` 镜像同步（diff 一致）；`~/.pi/agent/CLAUDE.md` 为软链接自动跟随。

### 变更（全局 CLAUDE.md 新增「Logo 视觉区分：拟人实体用拟人头像，项目用项目象征 logo」）

- **为什么改**：用户裁定视觉区分原则：门面 QuantStrategistAgent 与私有本体 Intraday 重组后 logo 全同，用户区分两者定位——拟人实体给拟人头像，项目给项目象征意义的 logo（Intraday 已换 ⏱️ 项目象征 logo，见该仓 CHANGELOG），并立为全局规则。
- **改了什么**：全局 CLAUDE.md 在「Logo / 图标资产文字一律用英文」之后并列新增小节「Logo 视觉区分（2026-09-12 用户立）」：拟人实体（主仓库 / 门面）用拟人头像模板，子项目（研究本体 / 组件 / 工具）用项目象征图形（象征元素取项目主题、配色避开已用组合、副标题与 README 口径一致）；存量撞脸接触时顺手改。本项目 `claude/CLAUDE.md` 镜像同步（diff 一致）。

### 变更（全局 CLAUDE.md 新增「Logo / 图标资产文字一律用英文」）

- **为什么改**：用户在 Swing 仓库指出 logo.svg 副标题混入中文（「日K趋势跟随策略」），要求 logo 内不放中文，并立为全局规则。logo 是面向全球读者的视觉标识，中文受众已有 README_cn.md 双语通道；且 SVG 中文依赖查看环境字体回退，渲染不可控（字体缺失显示方块），英文用通用字体族在哪个环境都稳定。
- **改了什么**：全局 CLAUDE.md 新增小节「Logo / 图标资产文字一律用英文（2026-09-12 用户立）」，适用于所有项目的 logo / 图标类视觉资产文件，插入位置在「中英双语 README 内容自动同步」之后；副标题口径与 README 英文版标题对齐；既有存量按「接触一处改一处」顺手清理。本项目 `claude/CLAUDE.md` 镜像同步（diff 一致）。

### 变更（全局 CLAUDE.md：QSAgent 仓库重组体系标注）

- **为什么改**：用户启动 Markowitz 量化项目仓库重组（求职展示与资产保密分层）：私有仓库 QuantStrategistAgent 更名 **Intraday**（日内研究本体），原名让给新建公开门面仓库；Swing 策略另立公开仓库。全局规则里的缩写释义与超集映射表需随仓库重组同步，否则指向旧结构。
- **改了什么**：①缩写约定 QSAgent 释义更新为体系结构（公开门面 QuantStrategistAgent + 私有本体 Intraday + 公开组件 Swing）；②超集映射表「QuantStrategistAgent（Markowitz）」行改为「Intraday（Markowitz 量化私有本体，原名 QuantStrategistAgent）」并注重组说明。本项目 `claude/CLAUDE.md` 镜像同步（diff 一致）。同日新建本地仓库 Swing 与 QuantStrategistAgent（门面）待用户 `/commit` 发布。

### 变更（全局 CLAUDE.md 缩写约定新增 QSAgent）

- **为什么改**：用户裁定 QuantStrategistAgent（Markowitz 的量化策略项目）以后简称为「QSAgent」，方便日常沟通指代，避免每次复述全名。
- **改了什么**：全局 `~/.claude/CLAUDE.md`（权威源）「缩写约定」新增一条：输入「**QSAgent**」即指 QuantStrategistAgent（2026-09-12 立），大小写不敏感清单同步补入（qsagent 同义）；本项目 `claude/CLAUDE.md` 镜像同步（diff 一致）。

### 变更（全局 CLAUDE.md：五条全局规则全文并入，全局级 @ 引用机制废止）

- **为什么改**：`@` 引用只有 Claude Code 会自动展开，pi / ZCode 等不解析——五条「必须遵守」级规则（SSH 远程操作、文件操作优先级、临时产物、汇报前验证、运行版隔离）在这些 agent 里只剩一句话摘要，全文是否在场全靠 agent 自觉（2026-08-24「非 CC agent 开场逐一读取全文」纪律属软约束，2026-09-12 在 pi 会话实测即被跳过，直到用户问起才补读）。用户裁定：全文并入 CLAUDE.md 本体，一处修改、所有 agent 同时生效。
- **改了什么**：① 文末「工作规则」节从 @ 引用摘要清单改写为五条规则原文全文（标题降级：`#`→`###`、`##`→`####`）；② 「rules 文件必须在 CLAUDE.md 中 @ 引用」规则条改写为「rules 文件的加载机制」——@ 引用纪律仅适用项目级，全局级新增规则直接写入 CLAUDE.md 对应章节、不放 `~/.claude/rules/`；③ `~/.claude/rules/` 五文件保留为归档、头部加归档说明（不再是加载链路的一环、不再同步维护）；④ 镜像同步：`claude/CLAUDE.md`、`claude/rules/` 覆盖后 diff 一致；⑤ 顺带对齐存量分叉——win-ai-monitor SKILL.md 镜像落后全局 2026-09-04 版（桌面代理机制停用改写），以全局覆盖镜像，并删除镜像侧残留的旧部署脚本 `scripts/`（全局侧 2026-09-04 已清除、镜像当时漏删），skills 两边现仅余 endpoints.json 与 local/config.md 两处本机数据预期差异。

### 变更（全局 rules/ 目录整体删除：并入后的收尾清零）

- **为什么改**：五条全局规则已全文并入 CLAUDE.md「工作规则」节（见上一条），`~/.claude/rules/` 目录在加载链路上零依赖，且历史版本已由本仓库 git 历史完整留痕，本机归档副本属第三份冗余；用户裁定一并删除并清理全部引用表述。
- **改了什么**：① 删除全局 `~/.claude/rules/`（五文件）与镜像 `claude/rules/` 目录（git 历史保留全部版本可回溯）；② 全局 CLAUDE.md 十处表述更新——「底层通用能力开源」节从三部分改为两部分（skills / CLAUDE.md）、「rules 文件的加载机制」与「工作规则」节的「保留为归档」改为「已删除（历史见 git 历史）」、注册表 Prometheus 行同步、「临时产物存放规则」内两个指向已删文件的 file:// 交叉链接改为同文档指代；③ 更新 8 个存量项目 CLAUDE.md 里「见全局 ~/.claude/rules/」类指路为「见全局 ~/.claude/CLAUDE.md『工作规则』节」（AgentCortex、ApplyOptimizerAgent、CommunityManagerAgent、ExecutiveAssistantAgent、TestEngineerAgent、gridtrader、Intraday、QuantStrategistAgent；后三者的「权威源见 .claude/rules/」同步改为「claude/CLAUDE.md」）；④ 核验：全局与镜像两部分（skills / CLAUDE.md）逐字节一致，pi 软链接自动跟随，各 CLAUDE.md 中 `~/.claude/rules` 引用清零。项目侧改动在各项目仓库待用户自行提交。

## 2026-09-09

### 变更（commit skill：功能分支撤 PR 链，对齐 dev-workflow 2026-09-07 无 PR 无 CI 版）

- **为什么改**：2026-09-09 在 zcode-cli 功能分支上 `/commit` 时仍自动创建了 PR——commit skill 第 8 步的功能分支逻辑停留在 2026-09-06 版「功能分支自动走 PR 链（push → 建 PR → 等 CI 绿 → squash 合并）」，而 dev-workflow 已于 2026-09-07 改版为「全程本地、无 PR 无 CI」（合并回 main 是用户验收后本地超集校验 + 快进合并），两个 skill 脱节，commit skill 照旧走了已废止的 PR 链。误建的 PR（xhqing/zcode-cli#3）已关闭。用户裁定：功能分支上 `/commit` 到「commit + push 分支」即止，不建 PR、不等 CI、不合并。
- **改了什么**：commit skill（SKILL.md）共 6 处——frontmatter description 功能分支段改为「commit → push 分支本身即止，不建 PR、不等 CI、不合并」；第 0 步功能分支括注同步；第 7 步「功能分支 PR 链场景」措辞改「功能分支推送场景」；第 8 步整段重写（标题改「执行推送」，功能分支子流程从三步 PR 链改为「只推送分支本身——远端分支仅作备份，合并回 main 属 dev-workflow 第 7 步，存量仓库 ci.yml 保留不动」）；「注意」段同步；「汇报」段改「功能分支场景加报分支推送结果 + /release 前确认功能分支已合并回 main + 下次 /commit 继续推送同一分支」。全局 `~/.claude/skills/commit/`（与 `~/.zcode/skills/commit/` 为同一文件）改毕，本项目 `claude/skills/commit/` 镜像同步（diff 一致）。教训：dev-workflow 2026-09-07 改版撤 PR/CI 时未同步排查引用它的 skill——被其它 skill 引用的流程改版时，须排查交叉引用方同步修订。

### 变更（commit skill 镜像：敏感行为记录段对齐全局脱敏版）

- **为什么改**：同步 commit skill 时发现本项目 `claude/skills/commit/` 镜像第 36-49 行仍是旧版——敏感行为记录段含代理服务商与拒单报文的**字面词**（服务商名、节点代号、报文错误码原文），而全局权威源早已改为中性释义（不写字面词）；镜像落后于全局脱敏修订，属「敏感信息禁止写入未被 .gitignore 忽略的文件」的存量违规（历史 commit 中的旧字面词无法通过本次覆盖清除，如需彻底清除须重写历史，由用户另行决定）。
- **改了什么**：随上一条 commit skill 修订同步，以全局权威版整体覆盖本项目 `claude/skills/commit/SKILL.md`（PR 链修订与脱敏对齐同一次 cp 完成），diff 一致。

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
