# 测试体系：测试 Agent、测试先行、权限与 CI

本文件是 dev-workflow 第 1 / 3 步的支撑细节，回答五个问题：需求从哪来（Issue）、测试谁来写（测试 Agent）、什么时序写（先红后绿）、开发有什么权限（只读可运行 + hook 强制）、CI 怎么集成。

## Issue 作为需求端与状态机（2026-09-21 三次修订立，取代 test-cases 目录体系）

- **遇到问题 / 想要功能随手开 Issue**：正文写清**复现步骤 / 预期行为**——bug 给复现，功能给预期。它同时是需求文档、验收标准、测试的雏形（复现步骤天然就是测试脚本的骨架：构造场景 → 断言预期）。有空再解决，Issue 池就是 backlog（标签排优先级、milestone 分组、跨设备随手记）。
- **状态机由 Issue open / closed 承担**：开发 → 测试 → PR 描述带 `fixes #<N>` → CI 绿合并 → GitHub 自动关闭 Issue。原 `pending/ → passed/` 目录状态机与「归档挪动」动作整体取消——需求做完没有（open / closed）、测试守着没有（在正式测试位置常跑），两个问题各归其位，不再需要目录挪动表达状态。
- **需求变更 = 更新 Issue**：编辑正文或评论补充新验收标准 → 测试 Agent 按新 Issue 重出 / 改测试 → 迭代走新一轮分支循环。讨论与澄清沉淀在 Issue 评论里，随时可翻。

## 角色分工与测试先行（谁写测试、什么时序）

**测试开发分离是原则**：写测试的不是开发。同仓库里测试文件对开发物理可见可改，「开个新会话自己写」的隔离只靠自觉（纪律墙太薄）——测试 Agent + hook 是双层硬墙：角色墙（出题与解题不是同一个 Agent，出题上下文没有「想把断言改软」的动机）+ 权限墙（hook 对开发会话的测试写入直接 deny）。

**先红后绿的时序（分支内先行）**：

1. 功能分支建好后，测试 Agent 读 Issue → 用项目现有测试框架写测试 → **自跑确认红**（实现还不存在，断言必红——这一跑验证「断言真的在测东西」，防永真断言）→ 交付自检全过后报告用户（列明应 `git add` 的路径与改动摘要），commit 由用户亲自执行（自行 `git add` + `/commit`，见 SKILL.md「git / gh 授权边界」，2026-09-22 用户定）。
2. 开发接手同分支写实现 → 本地全量绿 → PR（测试与实现**同 PR** 进 main）。
3. **测试先行是分支内的先行，不是 main 上的先行**：实现不存在时测试单独进 main 会让 CI 全量必红、auto-merge 体系崩掉——main 永远只见「红绿闭环过」的完整状态，先行的价值（断言有效性验证、出题先于解题、开发全程只读）一点不少。

**为什么必须先写而不是后补**：后补测试最大的风险是「快照式测试」——跑一遍当前行为、断言当前行为，连 bug 一起固化进断言，测试永远绿、防护等于零（LLM 写完实现后补测试尤其容易这样）。先写时实现不存在，只能按 Issue 预期出题；先红验证过断言会咬人。

**测试规模与需求体量匹配**：小 bug 一条聚焦断言（Issue 的复现步骤直接翻译），大功能成组用例——两头失衡都不行（五分钟改动配半小时用例是失衡，大功能配三条浅断言同样是失衡）。

### 测试的三个来源（都满足「不归开发写」）

- **测试 Agent（Hopper / TestEngineerAgent，主通道）**：用户在 Hopper 会话中给它 worktree 路径 + Issue 链接，它写测试（带 `# TEST_CASES_WRITE_OK` 标记）、自跑见红、commit 由用户亲自执行（自行 `git add` + `/commit`，见 SKILL.md「git / gh 授权边界」，2026-09-22 用户定）。项目仓库就是唯一记录（Issue + 测试都在 GitHub 上）——不再需要外部权威源镜像（原 Hopper cases/ 仓库的单向分发机制随目录体系一并取消，2026-09-21）。
- **独立会话（代行，无测试 Agent 环境时）**：新开会话（同模型即可），只喂 Issue 链接与 worktree 路径，不喂任何实现——测试先行的分支上实现尚不存在，出题上下文天然无实现可见（这是先行时序的结构优势：想看实现都没有）。产出同样带标记写入、自跑见红。
- **用户手写**：同样带 `# TEST_CASES_WRITE_OK` 标记写入。

## 测试文件的位置与权限

- **位置：项目正式测试位置**——按项目测试框架的惯例放（`tests/`、`test/`、`__tests__/`、`packages/*/test/`、`spec/` 等），CI 的全量测试命令天然含它们，合并后常驻回归防护网。不再有专门的 `test-cases/` 目录与 pending/passed 结构。
- **开发对测试文件全量只读 + 可运行，禁止增删改**：包括新建（补测试也归测试 Agent——防「写完实现补快照式测试」）、修改、删除、移动，覆盖测试目录、测试文件名、测试基础设施（conftest、test helpers、fixtures——运行测试需要的伴生文件缺了不自己补，阻塞上报）。唯一豁免是测试运行自产的缓存（`__pycache__`、`.pytest_cache`、coverage 输出等——配合 .gitignore 兜底；知情清理走授权标记）。
- **hook 工具强制（2026-09-21 扩展为测试文件全量保护）**：按「规矩必须配套工具强制」元规则，本条已落跨端工具强制——Python 脚本 `~/.claude/hooks/test-cases-guard.py` 四端共用（CC / ZCode / CodeBuddy / Trae），pi 端为判定逻辑逐条对齐的 TS extension `~/.pi/agent/extensions/test-cases-guard.ts`：
  - **保护对象**：存量 `test-cases/` 目录 + 测试目录独立段（`test` / `tests` / `__tests__` / `__snapshots__` / `spec` / `e2e`）+ 测试文件名（`*.test.*` / `*.spec.*` / `test_*.py` / `*_test.py` / `*_test.go` / `conftest.py` / `*.snap`）——整段 / 全名匹配，不误伤 `latest`、`contest`、`testcase` 等含 test 字样的普通路径；
  - **拦截语义**：Write / Edit 写入上述目标、Bash 命令中显式指向上述目标的写类操作（rm / mv / touch / mkdir / tee / cp 目标 / sed -i / 重定向 / find -delete / git rm|mv|add|clean|restore|checkout|stash）一律 deny；一切读操作与跑测试命令天然放行；
  - 各端配置位置不变（CC `~/.claude/settings.json`、ZCode `~/.zcode/cli/config.json`、CodeBuddy `~/.codebuddy/settings.json`、Trae `~/.trae-cn/hooks.json` 的 PreToolUse matcher；pi 端 `~/.pi/agent/extensions/`，新会话生效）；
  - **授权标记 `# TEST_CASES_WRITE_OK`**：命令末尾带此标记则整条放行——测试 Agent / 独立会话出题写入、用户授权的例外操作（缓存清理等）走此通道（与杀 VSC 进程 hook 的 `# AI_AUTHORIZED_KILL_VSC` 同模式）。合法写入被 deny 时，应把写入内容先落到项目 `tmp/`、再用带标记的 Bash 命令拷入，或交用户手动操作——不做无标记的绕过。
- **测试命令配置的边界**：跑测试的命令配置（如 package.json 的 `test` script、CI 里的测试命令）开发不动——要改走用户 / 测试方（这些配置决定「跑什么测试」，属测试体系的一部分）。
- **强度边界（知情）**：hook 拦「显式路径的写命令」，拦不住命令内部代码的文件操作（python -c 里 open('w')）与 `git add .` 这类无显式目标的形式；拦测试写入防的是「改测试迁就实现」与「补快照式测试」，防不了「改实现 hack 骗测试」（在源码里 hack 让断言恰好通过）——这层靠用户实物验收（预发布产物是真实现的产物，hack 骗得过测试骗不过人手实测）+ 重要功能可选测试 Agent 复核兜底。

## CI 集成：回归防护网进 CI（2026-09-21 立）

远端 CI 是机器门禁的权威载体（本地全量测试是预检，CI 是合并前置）。`.github/workflows/ci.yml` 最小规范：

- **触发器**：`on: pull_request`（目标 main，机器门禁主通道）+ `on: push: branches: [main]`（合并后最终确认 + 回归网持续生效）。
- **执行内容**：与本地第 6 步同一口径——项目全量测试（正式测试位置的测试天然全含，含测试 Agent 先行写的新测试）+ 类型检查（如 `npm test` + `tsc --noEmit`）。
- **required status checks**：ci.yml 的 job 须在分支保护里设为 required（配置清单与首次启用顺序见 `merge-discipline.md`——先 ci.yml 进 main、再开保护设 required，反序死锁）。
- **存量仓库**：2026-09-07 ~ 2026-09-21 本地裁决期间「保留不动」的 ci.yml 恢复启用——检查触发器与执行内容是否覆盖上述规范，缺则经杂事 PR 补齐。
- **新项目**：首次走 dev-workflow 时由第 1 步开工门禁引导建立（同样先 CI 进 main、后开保护）。
- **CI 红的处置**：`gh pr checks --watch` 盯状态，`gh run view --log-failed` 拉失败日志，本地修复后 push，CI 自动重跑；本地与 CI 结果不一致时以 CI 为准（干净环境为权威）。红灯若是测试本身的问题（断言与 Issue 预期不符），走「终止上报」通道而不是改实现迁就或改测试。

## 存量 test-cases/ 目录的迁移（过渡指引）

- hook 保留对 `test-cases/` 的保护（存量项目不迁移也安全：旧用例留在原地继续被 CI 全量跑，等效于 passed 用例的回归防护）。
- 要迁移的项目：请测试 Agent 把 `test-cases/passed/` 下的用例按项目测试框架移进正式测试位置（带授权标记的整组搬移，适配 import 路径与运行命令），迁移本身经 PR + CI 验证全绿后删除旧目录——迁移全程是测试方操作，开发不参与搬移。`test-cases/pending/` 下未完成的用例组：对应的旧需求若仍要做，先开 Issue 承接（正文可用原 requirement.md 内容），用例由测试 Agent 按新体系重出；不做则随目录一并清理。
