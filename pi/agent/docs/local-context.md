# 本机私有规则文件：`AGENTS.local.md`

`extensions/local-context.ts` 给 pi 补上「本机私有规则文件」这一层。2026-11-05 用户定。

## 为什么要它

pi 只认这几个上下文文件名（`dist/core/resource-loader.js` 的 `loadContextFileFromDir()`，每个目录只取**第一个**存在的）：

1. `AGENTS.override.md`
2. `AGENTS.md`
3. `AGENTS.MD`
4. `CLAUDE.md`（已弃用）
5. `CLAUDE.MD`（已弃用）

**没有 `.local.md` 这类「私有、不进 git」的变体。** 于是本机私有规则只有两条路：混进会被提交的 `AGENTS.md`（会泄露），或者每次手动点名去读（靠自觉）。这个扩展提供第三条：`AGENTS.local.md` 自动加载。

## 语义

- **追加，不替代**：`AGENTS.local.md` 与同目录的 `AGENTS.md` **并行生效**，两个都进上下文。功能上等价于 `.pi/APPEND_SYSTEM.md`（都往系统提示后面加），区别只在文件名——「local」把「私有不公开」写进名字里，比 `APPEND_SYSTEM` 更明确，也不占用 pi 的 `SYSTEM.md` / `APPEND_SYSTEM.md` 名额。
- **搜索范围与 AGENTS.md 同构**：
  - 先看全局 `~/.pi/agent/AGENTS.local.md`；
  - 再从 cwd 逐级向上到根，每个目录最多取一个（`AGENTS.local.md`，大小写敏感的文件系统上另认 `AGENTS.LOCAL.MD`）；
  - 拼接顺序：全局在前，祖先目录按「远 → 近」，当前目录在最后；
  - 按 realpath 去重，软链接不会重复加载。
- **注入位置**：系统提示的自定义 section `local_context`，排在 `project_context` / `skills` / `cwd` 之后。用结构化 section 而不是整段替换系统提示，pi 只 diff 变化的 section，**提示缓存不会被打穿**。
- **`-nc` / `--no-context-files` 时一并跳过**：用户显式要干净提示时，私有规则也不该溜进去。

## 安全闸门（重点）

「私有」意味着**不得进 git**，所以加载前强制检查，四步：

| 情形 | 判定 |
|---|---|
| 不在 git 工作树内（没有仓库） | 放行 |
| 已被 git 跟踪（`git ls-files --error-unmatch` 命中） | **拒绝** |
| 未被 `.gitignore` 忽略（`git check-ignore` 说「未忽略」） | **拒绝** |
| 在仓库里 + 未被跟踪 + 已被忽略 | 放行 |

为什么单独查「已被跟踪」：`.gitignore` 对**已跟踪**文件无效——文件明明匹配忽略规则，却仍会随仓库分发。这是最隐蔽的泄露路径。

拒绝加载时不会静默：被拒文件、原因、处置办法会作为一段 `<rejected …>` 注入系统提示，由当前会话转告用户去补 `.gitignore`（`git rm --cached` 属暂存区操作，AI 不得自行执行）。

git 检查结果按「文件 mtime + size」缓存 10 秒：改了 `.gitignore` 但文件本身没变时，靠这个 TTL 刷新，不用重启会话。

## 怎么用

1. 在项目根放一个 `AGENTS.local.md`，**确认它被忽略**：

   ```bash
   echo 'AGENTS.local.md' >> .gitignore   # 或 *.local.md
   ```

2. 内容推荐走「本体在私有目录、项目里放软链」的既定做法（见全局 AGENTS.md 的「私有内容目录 `~/.dev/private`」节）：

   ```bash
   # 在 ~/.pi/agent/patch/private-links/manifest.tsv 里登记一行
   #   <仓库名>	AGENTS.local.md
   python3 ~/.pi/agent/patch/private-links/private-links.py adopt
   ```

   别手建软链接：编辑器原子保存会把链接换成实体文件，`git clean -fdx` 也会把被忽略的链接删掉，一律用脚本重建。

3. 打开新会话即生效；改完文件不用重启（下一轮对话重新读取）。

## 与其它机制的关系

- **`AGENTS.md`**：并行生效，`AGENTS.local.md` 不顶掉它；`AGENTS.override.md` 的「顶掉同目录 AGENTS.md」语义不受影响，那是另一条路。
- **`.pi/APPEND_SYSTEM.md`**：功能等价，二选一即可。差别是 `APPEND_SYSTEM.md` 放 `.pi/` 下、按项目生效且属「需要项目信任」的资源；`AGENTS.local.md` 按目录层级生效、不需要项目信任（和 AGENTS.md 同级）、而且有 git 安全闸门。
- **`CLAUDE.local.md`**：**不认**（用户 2026-11-05 明确只要求 `AGENTS.local.md`）。存量项目要迁移就改名或加一个指向同内容的 `AGENTS.local.md` 软链。

## 局限（诚实）

- 只认 `AGENTS.local.md` 一个名字，不做通配、不做配置项。
- 单文件上限 64 KB，超出部分截断并注明（系统提示不该被文件撑爆）。
- git 检查靠 fork `git` 子进程，只在文件变化后才重跑；`git` 不可用时按「无法确认」处理（拒绝加载）。
- 判定全程防御性 `catch`：扩展失灵时不阻塞会话，但也就不加载——宁可没有私有规则，不能把会话搞挂。
- 手工验证方法：在目标目录跑 `pi -p "回复两个字：收到"`，然后看会话记录里 system 消息的 `sections.local_context`（`~/.pi/agent/sessions/<cwd-slug>/*.jsonl`）。
