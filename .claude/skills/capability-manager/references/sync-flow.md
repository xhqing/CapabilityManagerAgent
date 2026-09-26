# 同步与一致性核对（场景 B 详细流程）

本文件是 SKILL.md「场景 B」的详细展开。讲清楚**全局权威源 ↔ 本项目镜像 ↔ 各项目副本**之间怎么同步、怎么验证、哪些差异是合法的。同步范围只覆盖**六部分**（skills / CLAUDE.md / docs / hooks / patch / pi 扩展；全局规则随 CLAUDE.md 走，原 `~/.claude/rules/` 目录已废弃删除），不含 `commands/`、`settings.json`。

## 位置与角色速查

| 角色 | 路径 | 作用 |
|---|---|---|
| 权威源 | `~/.claude/`（前五部分）+ `~/.pi/agent/extensions/`（pi 扩展） | 唯一事实来源；所有项目运行时加载它；改动从这里开始 |
| 本项目开源镜像 | `~/Developer/CapabilityManagerAgent/claude/` + `pi/agent/extensions/` | 把全局开源出去的快照（六部分） |
| 各 agent 项目副本 | `~/Developer/<各 agent 项目>/.claude/` | 各 agent 运行时加载自己项目里的这份 |

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

**find-skill 的例外（重要）**：`find-skill/.env`（SkillsMP 密钥）和 `find-skill/cache/`（本机 catalogue、日志）是**本机数据**，不参与「逐字节一致」核对（属合法差异，见下文）。整目录 `cp -R` 不会丢它们（本机同一台机器两边一致），但同步后可单独核对全局里的 `.env` 还在：

```bash
ls ~/.claude/skills/find-skill/.env  # 应存在
```

## 同步情形 2：全局 → 各 agent 项目副本（分发）

某个通用 skill 在全局改好了，现在分发到各 agent 项目的 `.claude/`。

**第一步：判断该 skill 该分发到哪些项目。** 分两类：

- **全团队通用 skill**（分发到所有 agent 项目）：`anysearch`、`find-skill`，以及 `commit`、`release`、`vsce-install`、`icon-design`、`image-ocr`、`skill-creator`、`browser-use` 这类基础能力。
- **特定 agent 专属 skill**（**不**分发，只留在该 agent 项目自己的 `.claude/`）：`capability-manager`（只给 Prometheus 本项目，在 `CapabilityManagerAgent/.claude/skills/`）、`trade`（Victor/DayTradingAgent）、`vend`（Vendy/DigiVendAgent）、`patch-claude`（Tinker/PatchClaudeAgent）、`quant`（Markowitz/QuantStrategistAgent）、`site-builder`（Mason/SiteBuilderAgent）、`hot-trend`（Scout/ProductStrategistAgent）等。

**第二步：定位目标项目。** 本机所有 agent 项目都在 `~/Developer/`，目录名见全局 CLAUDE.md「智能体命名注册表」。先确认哪些项目装了该 skill：

```bash
for d in ~/Developer/*Agent; do
  [ -d "$d/.claude/skills/<skill名>" ] && echo "$(basename "$d")"
done
```

**第三步：分发（逐个项目覆盖）**：

```bash
for d in ~/Developer/*Agent; do
  if [ -d "$d/.claude/skills/anysearch" ]; then
    cp -R ~/.claude/skills/anysearch "$d/.claude/skills/"
  fi
done
```

同样注意 find-skill 的 `.env` / `cache/`：分发 find-skill 后，各项目的 `.env`（密钥）要保持该项目自己的，别用全局的覆盖丢。

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

**全局 vs 某项目副本**（以 anysearch 为例）：

```bash
diff -r ~/.claude/skills/anysearch ~/Developer/<项目>/.claude/skills/anysearch
```

### 合法差异（diff 报这些不算错）

| 差异 | 原因 | 处理 |
|---|---|---|
| `find-skill/.env` | 本机 SkillsMP 密钥，各机器不同 | 保留，不同步 |
| `find-skill/cache/` | 本机 catalogue、日志 | 保留，不同步 |
| `settings.local.json` | 本机配置（不入库） | 保留，不同步 |
| `commands/`、`settings.json` | 不在六部分同步范围（全局有、本项目镜像无） | 正常，不核对 |
| hooks 目录下的 `__pycache__/`、`*.bak-*` | 字节码缓存、编辑备份等本机产物（不进镜像） | 保留，不核对 |
| patch 目录下的 `*.log`、`.lock`、`conflicts/` | 动作日志、并发锁、锚点丢失现场等本机产物（不进镜像） | 保留，不核对 |

除这几类外，六部分（skills / CLAUDE.md / docs / hooks / patch / pi 扩展）的 diff 报任何差异都说明同步没做对，必须修到一致。

## 一致性巡检（一键扫全部）

改动影响面大时，跑这个巡检一次性看六部分 + 所有项目的状态：

```bash
AUTH=~/Developer/CapabilityManagerAgent
echo "=== 全局 vs 本项目镜像（六部分）==="
diff "$AUTH/claude/CLAUDE.md" ~/.claude/CLAUDE.md >/dev/null 2>&1 && echo "CLAUDE.md ✅" || echo "CLAUDE.md ❌"
for s in "$AUTH/claude/skills/"*/; do
  name=$(basename "$s")
  diff -r "$s" ~/.claude/skills/"$name" >/dev/null 2>&1 && echo "skills/$name ✅" || echo "skills/$name ❌（find-skill 的 .env/cache 差异属正常）"
done
diff -r "$AUTH/claude/docs" ~/.claude/docs >/dev/null 2>&1 && echo "docs ✅" || echo "docs ❌"
diff -r -x '__pycache__' -x '*.bak*' "$AUTH/claude/hooks" ~/.claude/hooks >/dev/null 2>&1 && echo "hooks ✅" || echo "hooks ❌"
diff -r -x '*.log' -x '.lock' -x 'conflicts' "$AUTH/claude/patch" ~/.claude/patch >/dev/null 2>&1 && echo "patch ✅" || echo "patch ❌"
diff -r "$AUTH/pi/agent/extensions" ~/.pi/agent/extensions >/dev/null 2>&1 && echo "pi 扩展 ✅" || echo "pi 扩展 ❌"
echo "=== 全局 vs 各项目（仅 anysearch / find-skill）==="
for d in ~/Developer/*Agent; do
  for sk in anysearch find-skill; do
    [ -d "$d/.claude/skills/$sk" ] || continue
    diff -r ~/.claude/skills/$sk "$d/.claude/skills/$sk" >/dev/null 2>&1 && echo "$(basename $d)/$sk ✅" || echo "$(basename $d)/$sk ❌（find-skill 的 .env/cache 差异属正常）"
  done
done
```

巡检结果里，`❌` 要人工判断是「同步漏了」还是「合法差异」——结合上面的合法差异表。
