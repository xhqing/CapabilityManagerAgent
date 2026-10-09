# 同步与一致性核对（场景 B 详细流程）

本文件是 SKILL.md「场景 B」的详细展开。讲清楚**全局权威源 ↔ 本项目镜像 ↔ 各项目副本**之间怎么同步、怎么验证、哪些差异是合法的。同步范围只覆盖**六部分**（skills / CLAUDE.md / docs / hooks / patch / pi 扩展；全局规则随 CLAUDE.md 走，原 `~/.claude/rules/` 目录已废弃删除），不含 `commands/`、`settings.json`。

## 位置与角色速查

| 角色 | 路径 | 作用 |
|---|---|---|
| 权威源 | `~/.claude/`（前五部分）+ `~/.pi/agent/extensions/`（pi 扩展） | 唯一事实来源；所有项目运行时加载它；改动从这里开始 |
| 本项目开源镜像 | `~/Developer/CapabilityManagerAgent/claude/` + `pi/agent/extensions/` | 把全局开源出去的快照（六部分） |

> **单一出口说明**：各 agent 项目**不再**分发通用能力副本——分发层 2026-09-13 已终结、项目副本已全部清空；各 agent 运行时直接加载全局 `~/.claude/`。Agent 项目与其**子项目**之间的 `.claude/` 超集关系是另一回事（见 `agents-registry.md`），本文件不涉及。

下面把本项目根记作 `$AUTH`，即 `~/Developer/CapabilityManagerAgent`。

## 同步情形 1：全局 → 本项目镜像（最常见）

全局改好了六部分内容（前五部分在 `~/.claude/`，pi 扩展在 `~/.pi/agent/extensions/`），把它镜像到本项目。逐部分操作：

```bash
AUTH=~/Developer/CapabilityManagerAgent

# CLAUDE.md（元规范）
cp ~/.claude/CLAUDE.md "$AUTH/claude/CLAUDE.md"

# skills（逐个通用 skill 整个目录覆盖）
# 注：全局只放通用 skill；项目级专属 skill（如本项目的 capability-manager）
# 在各项目的 .claude/skills/ 里、不进全局、不进 claude/ 镜像。
for s in ~/.claude/skills/*/; do
  name=$(basename "$s")
  cp -R "$s" "$AUTH/claude/skills/$name"
done

# docs（参考文档：agents-registry / new-agent-scaffold / capability-sync）
mkdir -p "$AUTH/claude/docs"
cp ~/.claude/docs/*.md "$AUTH/claude/docs/"

# hooks（强制守卫脚本；只拷脚本本体，不拷 __pycache__ / *.bak-* 本机产物）
mkdir -p "$AUTH/claude/hooks"
cp ~/.claude/hooks/pre-tool-use-guard.sh ~/.claude/hooks/test-cases-guard.py "$AUTH/claude/hooks/"

# patch（自研辅助机制；只拷代码与说明，不拷 *.log / .lock / conflicts 运行产物）
mkdir -p "$AUTH/claude/patch/skill-custom"
cp -R ~/.claude/patch/skill-custom/snippets "$AUTH/claude/patch/skill-custom/"
cp ~/.claude/patch/skill-custom/restore.py ~/.claude/patch/skill-custom/README.md "$AUTH/claude/patch/skill-custom/"

# pi 扩展（pi 端工具强制扩展，与 hooks 是同一套工具强制的 pi 侧实现；无本机产物）
mkdir -p "$AUTH/pi/agent/extensions"
cp ~/.pi/agent/extensions/*.ts "$AUTH/pi/agent/extensions/"
```

**本机数据差异（重要）**：个别 skill 目录下有自己的本机数据（如 `scroll-reverser/local/` 的配置、`backup/endpoints/` 的端点注册表），**被 `.gitignore` 隔离、不参与「逐字节一致」核对**（属合法差异，见下文）。整目录 `cp -R` 时保留它们、不要删。

## 同步情形 2（已终结）：全局 → 各 agent 项目副本

早期曾有一个「把通用 skill 分发到各 agent 项目 `.claude/` 副本」的层，**2026-09-13 起已终结**——单一出口模式下各项目不再分发副本、副本已全部清空，各 agent 运行时直接加载全局 `~/.claude/`。本情形不再执行；如遇历史残留副本，按「清理而非同步」处理（删掉副本、回归加载全局）。

> 另一码事：**Agent 项目 `.claude/` → 其子项目 `.claude/`** 的超集同步（如 BackendEngineerAgent → CC-BRIDGE）**仍在**——那由各 Agent 项目自己的规则与 `agents-registry.md`「超集关系映射」管，不属本文件的通用能力同步范畴。

## 同步情形 3：本项目镜像 → 全局（反向对齐）

若本项目 `claude/` 镜像被临时直接改过、领先于全局（违反了「全局权威优先」，但既成事实），把镜像内容**覆盖回全局**一次性对齐，之后继续走全局优先：

```bash
cp "$AUTH/claude/CLAUDE.md" ~/.claude/CLAUDE.md
for s in "$AUTH/claude/skills/"*/; do
  cp -R "$s" ~/.claude/skills/"$(basename "$s")"
done
mkdir -p ~/.claude/docs
cp "$AUTH/claude/docs/"*.md ~/.claude/docs/
mkdir -p ~/.claude/hooks
cp "$AUTH/claude/hooks/"*.sh "$AUTH/claude/hooks/"*.py ~/.claude/hooks/
mkdir -p ~/.claude/patch/skill-custom
cp -R "$AUTH/claude/patch/skill-custom/snippets" ~/.claude/patch/skill-custom/
cp "$AUTH/claude/patch/skill-custom/restore.py" "$AUTH/claude/patch/skill-custom/README.md" ~/.claude/patch/skill-custom/
mkdir -p ~/.pi/agent/extensions
cp "$AUTH/pi/agent/extensions/"*.ts ~/.pi/agent/extensions/
```

## 一致性核对（diff 验证）

每次同步后必跑，确认逐字节一致。只核对**六部分**（skills / CLAUDE.md / docs / hooks / patch / pi 扩展）。

**全局 vs 本项目镜像**：

```bash
AUTH=~/Developer/CapabilityManagerAgent
diff "$AUTH/claude/CLAUDE.md" ~/.claude/CLAUDE.md
diff -r "$AUTH/claude/skills" ~/.claude/skills
diff -r "$AUTH/claude/docs" ~/.claude/docs
# hooks：排除本机产物（__pycache__ / *.bak-*）后再比
diff -r -x '__pycache__' -x '*.bak*' "$AUTH/claude/hooks" ~/.claude/hooks
# patch：排除本机产物（*.log / .lock / conflicts）后再比
diff -r -x '*.log' -x '.lock' -x 'conflicts' "$AUTH/claude/patch" ~/.claude/patch
# pi 扩展（无本机产物，直接比）
diff -r "$AUTH/pi/agent/extensions" ~/.pi/agent/extensions
```

**全局 vs 某项目副本**：分发层已终结（见同步情形 2），此核对项取消。

### 合法差异（diff 报这些不算错）

| 差异 | 原因 | 处理 |
|---|---|---|
| skill 目录下的本机数据（`scroll-reverser/local/`、`backup/endpoints/` 等） | 本机私人 / 运行数据，被 `.gitignore` 隔离 | 保留，不同步 |
| `settings.local.json` | 本机配置（不入库） | 保留，不同步 |
| `commands/`、`settings.json` | 不在六部分同步范围（全局有、本项目镜像无） | 正常，不核对 |
| hooks 目录下的 `__pycache__/`、`*.bak-*` | 字节码缓存、编辑备份等本机产物（不进镜像） | 保留，不核对 |
| patch 目录下的 `*.log`、`.lock`、`conflicts/` | 动作日志、并发锁、锚点丢失现场等本机产物（不进镜像） | 保留，不核对 |

除这几类外，六部分（skills / CLAUDE.md / docs / hooks / patch / pi 扩展）的 diff 报任何差异都说明同步没做对，必须修到一致。

## 一致性巡检（一键扫全部）

改动影响面大时，跑这个巡检一次性看六部分的状态：

```bash
AUTH=~/Developer/CapabilityManagerAgent
echo "=== 全局 vs 本项目镜像（六部分）==="
diff "$AUTH/claude/CLAUDE.md" ~/.claude/CLAUDE.md >/dev/null 2>&1 && echo "CLAUDE.md ✅" || echo "CLAUDE.md ❌"
for s in "$AUTH/claude/skills/"*/; do
  name=$(basename "$s")
  diff -r "$s" ~/.claude/skills/"$name" >/dev/null 2>&1 && echo "skills/$name ✅" || echo "skills/$name ❌（本机数据差异属正常）"
done
diff -r "$AUTH/claude/docs" ~/.claude/docs >/dev/null 2>&1 && echo "docs ✅" || echo "docs ❌"
diff -r -x '__pycache__' -x '*.bak*' "$AUTH/claude/hooks" ~/.claude/hooks >/dev/null 2>&1 && echo "hooks ✅" || echo "hooks ❌"
diff -r -x '*.log' -x '.lock' -x 'conflicts' "$AUTH/claude/patch" ~/.claude/patch >/dev/null 2>&1 && echo "patch ✅" || echo "patch ❌"
diff -r "$AUTH/pi/agent/extensions" ~/.pi/agent/extensions >/dev/null 2>&1 && echo "pi 扩展 ✅" || echo "pi 扩展 ❌"
echo "=== 全局 vs 各项目副本：已取消（分发层 2026-09-13 终结、副本清空）==="
```

巡检结果里，`❌` 要人工判断是「同步漏了」还是「合法差异」——结合上面的合法差异表。
