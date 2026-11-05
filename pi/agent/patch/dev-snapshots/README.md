# dev-snapshots：受保护共享目录的改前快照

> 配套规则见全局 `AGENTS.md`「两个共享目录的『改前快照』」与
> 「跨机协作 · 删除红线」两节。守卫是 `~/.pi/agent/extensions/snapshot-guard.ts`。

## 保护对象

| target | 路径 | 打包内容 | 典型体积 |
|---|---|---|---|
| `pi-agent` | `~/.pi/agent` | `AGENTS.md` / `skills/` / `docs/` / `patch/` / `extensions/` / `prompts/` / `themes/` / `settings.json` / `mcp-adapter.json` | 约 0.5 MB |
| `private` | `~/.dev/private` | 全部（排除 `.state/`、`.DS_Store`） | 约 95 MB |

`~/.pi/agent` 里 1.3 GB 的运行时数据（`sessions/` `npm/` `bin/` `state/` `logs/` 等）全部排除，
所以它每次只有几百 KB。

## 命令

```bash
python3 dev-snapshots.py snapshot pi-agent     # 打包 + 上传飞书 + 保留 5 份 + 签发令牌
python3 dev-snapshots.py snapshot private
python3 dev-snapshots.py check [--fresh-min 30]
python3 dev-snapshots.py list                  # 本地与云端各有哪些
python3 dev-snapshots.py restore private       # 默认取最新一份（恢复前自动先快照现状）
```

## 保留策略

- 本地：`~/.dev/snapshots/<target>-YYYYMMDD-HHMMSS.tar.gz`，每个 target 只留最新 5 份。
- 云端：飞书 `<根备份文件夹>/dev-snapshots/<target>/`，同样只留最新 5 份；删完后会再 list 复核
  （飞书删除命令对 `--type` 很挑，错 type 会静默失败，所以必须复核）。

## 令牌与强制点

- 令牌：`~/.dev/private/.state/snapshot-token.json`，记录每个 target 的「时间 + 内容指纹 + 文件名」。
  它随 Syncthing 同步，所以**任一侧做的快照，另一侧也认**。
- `snapshot-guard.ts` 的判定：普通写入要求**30 分钟内的快照**；删除 / 移动类要求**指纹与当前内容完全一致**。
- 内容指纹 = 路径 + mtime + 大小（不读内容，168 MB 的目录也只要几十毫秒）。
- **上传失败不写令牌**：后续改动继续被拦，避免「以为备份了其实没有」。

## 依赖

- `lark-cli` 已授权（`lark-cli auth status` 显示 user ready）。
- 端点注册表 `~/.pi/agent/skills/backup/endpoints/endpoints.json` 里有 `root_folder_token`。
- 飞书域名必须直连：脚本内部已设 `NO_PROXY`（本机挂了全局代理时也不会握手超时）。

## 两台机器各自的准备（2026-11-05 实测）

| | MacBook（arm64） | macmini（x86_64） |
|---|---|---|
| lark-cli | `~/.local/bin/lark-cli`（arm64） | `~/.local/bin/lark-cli`（`lark-cli-<ver>-darwin-amd64.tar.gz`） |
| 应用 | 原有 app（`config init` 时配的） | `lark-cli config init --new` 生成的**另一个 app**（两台机器的 app id 不同） |
| 备份根文件夹 | 同一个（`endpoints.json` 的 `root_folder_token`） | **同一个**——实测两个 app 都能访问，用户是文件夹所有者 |

要点：

- **两个 app 没问题**：只要授权的是同一个飞书用户，云端文件夹对所有 app 都可见，`dev-snapshots/<target>/` 由脚本按名字查token、不会重复建。
- **macmini 的 PATH 坑**：非交互 shell（`ssh mac-mini '…'`）的 PATH 里**没有** `~/.local/bin`，直接调 `lark-cli` 会 `FileNotFoundError`。脚本已内置定位兜底（`shutil.which` → `~/.local/bin` → `~/bin` → homebrew 两个路径）。
- **github.com 在 macmini 上被限速**：下 release 资产经常截断（`gzip truncated`）。正确做法是**在本机下载、scp 过去**；顺带把 macmini 的 git 全局配置成 `http.version=HTTP/1.1` + `http.lowSpeedLimit/Time=0`，否则连 `git clone` 都会 75 秒超时。

## 指纹必须两端一致（否则「共享令牌」失效）

`tree_hash` 只算「路径 + mtime + 大小」，因此**必须排除两类东西**，脚本里已处理：

1. **同步元数据**：`.stignore`、`.stfolder`（Syncthing 不同步它们，两机天然不同；符号链接的 mtime 也不保留）。
2. **各机各自维护的本机配置**：`skills/anysearch/runtime.conf`、`patch/session-link/{config,local-links,chain-registry}.json`、`trust.json`、`mcp-project-approvals.json` —— 这些既会让指纹不等，也会把本机路径写进备份。
3. 依赖目录：`node_modules`（私有大目录里也可能藏着一个）。

验证两端一致：

```bash
python3 -c "import importlib.util as u;s=u.spec_from_file_location('d','dev-snapshots.py');m=u.module_from_spec(s);s.loader.exec_module(m);print(m.tree_hash('private'))"
ssh mac-mini 'cd ~/.pi/agent/patch/dev-snapshots && python3 -c "import importlib.util as u;s=u.spec_from_file_location("d","dev-snapshots.py");m=u.module_from_spec(s);s.loader.exec_module(m);print(m.tree_hash("private"))"'
```

两边输出相同，才说明「任一侧做的快照另一侧也认」。

## 坑（与 backup skill 的飞书文档一致）

1. 同名上传**不覆盖、会生成副本** → 我们用秒级时间戳命名，另外同一秒内重复触发要避免并发。
2. 删除必须 `--type file`（tar.gz 是普通文件）；删完 `list` 复核份数。
3. `--file` / `--output` 只接受当前目录内的相对路径 → 脚本统一 `cwd` 到文件目录再操作。
4. 上传 >20 MB 自动走 multipart（无需手工分片）。
