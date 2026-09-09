# 测试用例体系：目录结构、权威源、权限、同步与归档

本文件是 dev-workflow 第 1 步（开工门禁）与第 8 步（归档）的支撑细节。回答四个问题：用例放在哪、归谁管、怎么同步、跑绿了怎么归档。

## 目录结构（项目侧，固定命名）

```
test-cases/
  passed/                      # 已通过：用例 + 对应的过往需求文档
    <需求名>/
      requirement.md           # 自然语言需求文档（人读，描述意图）
      <用例文件…>              # 验收用例（机器裁决，用项目现有测试框架写）
  pending/                     # 未通过：用例 + 对应的当前需求文档
    <需求名>/
      requirement.md
      <用例文件…>
```

- **需求名**：英文短横线命名（如 `login-timeout`），一个需求一个子目录、一组用例。
- **按需求组分子目录的三个理由**：「本次需求组」从此有物理边界，第 5 步门禁口径（本次组必须绿、其它组不阻塞）从主观判断变成机械判定；归档就是一次 `git mv` 整目录从 pending 挪到 passed；需求文档与用例在同一个目录里版本绑定，「这个需求对应哪些用例」一目了然，永不失配。
- **requirement.md 与用例的分工**：文档描述需求意图（验收时用户按它逐条核对），用例是需求的机器翻译（测试时机器按它裁决）。两者配套构成 ATDD 的标准结构。
- **用例怎么写**：用项目现有测试框架写、能被项目测试命令执行。「全量测试」= 项目原有单元测试 + `test-cases/` 验收用例全部。

## 权威源与镜像（单向分发）

- **权威源**：测试 Agent（Hopper / TestEngineerAgent）自己的仓库，按项目分子目录：`cases/<项目名>/passed/<需求名>/`、`cases/<项目名>/pending/<需求名>/`，结构与项目侧同构、一一对应。全团队所有项目的用例全景在一个仓库里，统一规范、统一模板、跨项目沉淀经验。
- **项目侧 `test-cases/` 是运行时镜像**：开发 Agent 在项目里只读 + 运行它。分发方向**严格单向**（权威源 → 项目），永远不存在反向回流——镜像端只读，不存在双向编辑，唯一可能的分叉是「漏同步」，而漏同步天然被开工门禁兜住（pending 没用例 → 阻塞上报 → 用户找测试方 → 同步即解决）。
- **为什么镜像要放进项目仓库（被 git 跟踪）**：用例目录被项目 git 跟踪后，「哪份用例验证了哪份代码」在同一个仓库的同一个提交里绑定。如果用例只活在测试 Agent 的仓库，就得跨仓库对齐版本（哪次用例 commit 对应项目的哪次 main commit），既繁琐又易错；放进项目仓库后这份绑定是 git 天然保证的。

## 同步机制

- **时机**：测试方每次用例改动（新用例、改用例、归档挪动）后，把权威源的新版写进对应项目的工作区，每次改动同步一次。量小，不需要自动化。
- **落地**：同步产生的文件变更按全局 git 纪律走——用户 `git add` + `/commit`，CHANGELOG 记一笔「测试用例同步」。
- **窗口期交互**（重要）：同步会产生项目 main 上的新提交。如果落在某个功能分支的窗口期（main merge 进 dev 之后、dev merge 回 main 之前），超集被破坏——合并前的硬校验会拦住，该分支重新对齐、重跑全量即可（安全但浪费一轮）。所以纪律上：有分支处在窗口期时，用例同步避开，或同步后主动通知相关分支返工。

## 权限：只读 + 可运行，禁止增删改

- **允许**：读（Read / cat / diff）、运行（执行测试命令）。
- **禁止**：对 `test-cases/` 下任何内容的新建、修改、删除、移动——包括用例文件和 requirement.md。运行用例需要的伴生文件（fixture 数据、运行配置）也由测试方提供，缺了不自己补，阻塞上报。
- **唯一豁免**：测试运行自产的缓存（`__pycache__`、`.pytest_cache`、coverage 输出等）——这类由测试框架自己生成，配合 .gitignore 兜底，不算违规。
- **hook 工具强制（已落地 2026-09-07，同日扩展四端）**：按「规矩必须配套工具强制」元规则，本条已落跨端 hook——单一脚本 `~/.claude/hooks/test-cases-guard.py` 四端共用，各端挂载位置：
  - Claude Code：`~/.claude/settings.json` → PreToolUse，matcher `Bash|Write|Edit`；
  - ZCode：`~/.zcode/cli/config.json` → PreToolUse，matcher `Bash|Write|Edit`；
  - CodeBuddy：`~/.codebuddy/settings.json` → PreToolUse，matcher `Bash|Write|Edit`（官方声明 Hook 机制完全兼容 Claude Code Hooks 规范）；
  - Trae：`~/.trae-cn/hooks.json` → PreToolUse，matcher `RunCommand|Write|Edit`——**Trae 的标准化工具名里没有 Bash、叫 RunCommand**，matcher 不能照抄其它端；Trae 另兼容 Claude Code 配置（`~/.claude/settings.json` 启用后合并执行，双保险）。

  各端配置改动后新会话生效；CodeBuddy / Trae 首次实际触发时建议观察一次拦截日志，确认 matcher 命中。拦截语义：Write / Edit 写入 `test-cases/` 下的文件、Bash（Trae 为 RunCommand）命令中指向 `test-cases/` 的写类操作（rm / mv / touch / mkdir / tee / sed -i / cp 等目标写入、输出重定向、find -delete、git rm / mv / add / clean / restore / checkout / stash）一律 deny；一切读操作与跑测试命令（pytest / bun test 等不含写动词）天然放行。
- **授权标记 `# TEST_CASES_WRITE_OK`**：命令末尾带此标记则整条放行——测试方同步用例（cp / rsync 指向 test-cases）、用户知情的缓存清理（`find test-cases -name __pycache__ -exec rm -rf {} +`）走此通道（与杀 VSC 进程 hook 的 `# AI_AUTHORIZED_KILL_VSC` 同模式）。合法写入被 deny 时，开发 Agent 应把写入内容先落到项目 `tmp/`、再用带标记的 Bash 命令拷入，或交用户手动操作——不做无标记的绕过。
- **强度边界（知情）**：拦用例目录防的是「改用例迁就实现」，防不了「改实现骗用例」（在源码里 hack 让断言恰好通过）——这层只有测试方归档验收能把关，hook 无能为力。放弃 CI 后这是残存的风险面，靠归档环节的独立验收兜一部分。

## 过渡期口径

Hopper 供用例的能力就绪前，用户手工扮演测试方提供用例（结构照旧：`pending/<需求名>/requirement.md` + 用例）。流程不区分用例来源——开工门禁检查的是「pending 里有没有本次需求组」，谁供的不管。

## 归档：跑绿之后 pending → passed

- **归属**：开发 Agent 无权动用例目录，归档（整组 `git mv` 从 pending 到 passed）由测试方做。开发 Agent 在合并回 main 后只做一件事：向用户汇报「已合并，请让 Hopper 验收归档」。
- **归档第一步是 diff 校验（单向性的执法机制，2026-09-08 立）**：动权威源之前，先 diff 项目镜像 `test-cases/` 与权威源该项目子目录 `cases/<项目名>/`（排除 `__pycache__`、`.pytest_cache` 等运行缓存，只比 git 跟踪内容最稳）。同步是严格单向的、镜像端唯一合法写入口是测试方带 `# TEST_CASES_WRITE_OK` 标记的同步——所以不一致即可归因为异常（开发 agent 旁路偷改 / 流程错序 / 过渡期手工用例未补录），**一律停止上报、处置由用户裁决**。这道校验把「单向」从流程约定变成可验证的不变量：约定靠纪律，执法靠这道关卡。
- **为什么这是必要环节而不是可省的收尾**：一，它给了测试方一道独立验收——机器门禁 + 用户验收之外，用例的定义者自己确认「这组用例被满足了」；二，不归档则 pending 目录越积越大、状态失真，下次开工门禁检查「有没有未通过用例」就不可靠了。
- **归档本身也走同步**：测试方在权威源挪目录，再同步进项目（同上面的同步机制）。
