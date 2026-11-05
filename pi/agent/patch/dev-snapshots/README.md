# dev-snapshots：受保护共享目录的改前快照

> 配套规则见全局 `CLAUDE.md`「两个共享目录的『改前快照』」与
> 「跨机协作 · 删除红线」两节。守卫是 `~/.pi/agent/extensions/snapshot-guard.ts`。

## 保护对象

| target | 路径 | 打包内容 | 典型体积 |
|---|---|---|---|
| `pi-agent` | `~/.pi/agent` | `CLAUDE.md` / `skills/` / `docs/` / `patch/` / `extensions/` / `prompts/` / `themes/` / `settings.json` / `mcp-adapter.json` | 约 0.5 MB |
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

## 坑（与 backup skill 的飞书文档一致）

1. 同名上传**不覆盖、会生成副本** → 我们用秒级时间戳命名，另外同一秒内重复触发要避免并发。
2. 删除必须 `--type file`（tar.gz 是普通文件）；删完 `list` 复核份数。
3. `--file` / `--output` 只接受当前目录内的相对路径 → 脚本统一 `cwd` 到文件目录再操作。
4. 上传 >20 MB 自动走 multipart（无需手工分片）。
