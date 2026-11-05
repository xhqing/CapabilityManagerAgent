# macmini-use（全局能力）

> 2026-11-03 用户立：给全团队加一个「macmini-use」能力——用户给 pi 下指令时，先判断这条
> 指令里的重活要不要放到 macmini 上跑；目的是**给本机减负、保证用户此刻的使用体验**。

## 一、为什么

本机是用户正在用的 MacBook Air（8 核 / 8GB），macmini 是 12 核 x64 / 32GB 的常驻算力机，
两机只共享 `~/.pi/agent` 与 `~/.dev/private`（见 `~/.pi/agent/docs/macmini-mirror.md`）；
`~/Developer` 自 2026-11-05 起不再同步——项目代码走 GitHub，两边各自 clone。
用户的痛点不是「算力不够」，而是「AI 在本机跑长任务时，用户自己也卡」。所以这套能力做三件事：

1. **每轮提示**：往系统提示里追加一段很短的分流判断要求，让 AI 在每条指令开始时先想一秒
   「这条要不要分流」，判断完直接做（不问用户）。
2. **两条顺手的通道**：`macmini_run`（远端执行，cwd 自动映射、长任务后台化）与
   `macmini_status`（两机负载概览），避免模型手写 ssh 时踩引号 / PATH 的坑。
3. **工具强制**：明显的重型本机命令直接拦下，要求改走 `macmini_run`；确需本机执行时用
   逃生标记 `# AI_LOCAL_OK: <理由>`。

## 二、文件

| 文件 | 作用 |
|---|---|
| `~/.pi/agent/extensions/macmini-use/index.ts` | 扩展入口：每轮注入分流判断、注册两个工具与 `/macmini` 命令、重型本机命令闸门 |
| `~/.pi/agent/extensions/macmini-use/classify.ts` | 纯判定逻辑：macmini 判定、重型命令识别、递归删除识别（`/tmp` 与两个共享目录内放行，根目录禁止） |
| `~/.pi/agent/extensions/macmini-use/remote.ts` | 远端执行层：路径映射、`ssh mac-mini bash -s`、后台任务、负载脚本 |
| `~/.pi/agent/skills/macmini-use/SKILL.md` | 给 AI 的操作手册（判断表、硬约束、常见重活跑法、故障排查） |
| `~/.pi/agent/patch/macmini-use/test-classify.ts` | 判定逻辑回归测试（49 个用例，`bun` 直接跑） |
| `~/.pi/agent/patch/macmini-use/test-remote.ts` | 远端连通性冒烟测试（需要能 ssh mac-mini） |

扩展目录是「目录 + index.ts」形态，`classify.ts` / `remote.ts` 不会被当成独立扩展加载。

## 三、行为细节

### 每轮分流判断

`before_agent_start` 追加到系统提示的文本基本固定（只有负载档位「轻 / 中 / 重」随 1 分钟
load 变化），因此不会每轮破坏 prompt 缓存。内容口径：本机 8 核 / 8GB、macmini 12 核 / 32GB、
什么该分流、什么留本机、硬约束（两个共享目录改前需快照、删根禁止、缓存落 /tmp）。

### 闸门拦什么

只拦「长耗时且 macmini 接得住」的类型，锚定命令段开头（`echo xcodebuild`、`git commit -m`
里的同名文字不会误伤）：

`swift build/test`、`cargo build/test/bench/run`、`rustc`、`go build/test/vet`、`cmake --build`、
`ninja`、`make -j`、`gradle / maven / dotnet` 构建、`ffmpeg`、`tesseract`、`whisper`。

明确**不拦**（这些要么几秒结束、要么本地依赖使然、要么 macmini 跑不了）：

`npm / pnpm install`、`npm run build`、单文件 `pytest`、普通 `make`、`xcodebuild`（macmini 没有
完整 Xcode）、`docker build`（macmini 的 Docker daemon 是坏的）。

### 定向提醒（只给 AI 看）

用户指令里出现「构建 / 编译、全量测试、转码、回测、下载、OCR、批量处理」这类特征时，
`before_agent_start` 额外注入一条 `display: false` 的自定义消息，提醒「这一轮像重活，先判断
一次」。它不显示在会话界面里，只在特征命中时出现，避免长对话把常态规则稀释掉。
命中不等于必须分流——几秒的短命令照样留本机，所以措辞里写明了「不要为了分流而分流」。

### 远端安全

- **git 写**：`macmini_run` 复用 `git-readonly-guard.ts` 的 `checkCommand` 判定，写操作直接拒绝。
  这一条比 macmini 侧的守卫更早——ssh 直接跑 bash 不经过 pi 的 `tool_call`，必须由本工具拦。
- **递归删除**：非 `/tmp` 的 `rm -r` 默认拒绝（远端删除会经 Syncthing 删到本机），
  带 `# AI_REMOTE_RM_OK` 才放行。
- 后台任务的脚本与日志都在远端 `/tmp/macmini-jobs/`（不在共享范围内，不会回流）。
- **2026-11-05 起**：macmini 上的项目目录是独立 clone，git 读写正常；只有 `~/.pi/agent` 与 `~/.dev/private` 是共享目录。

## 四、验证

```bash
# 判定逻辑（不联网）
bun ~/.pi/agent/patch/macmini-use/test-classify.ts

# 远端连通性与后台任务（需要 ssh mac-mini）
bun ~/.pi/agent/patch/macmini-use/test-remote.ts

# 工具确实注册进 pi（用最小工具集跑一次）
cd /tmp && pi --approve --no-session --tools macmini_status \
  -p "调用 macmini_status，把原始文本贴出来"
```

## 五、已知局限（诚实）

- 闸门按命令文本判断：`bash -c 'xcodebuild'`、写进脚本文件再执行、用 python / node 调起
  子进程，都拦不住。它是下限防线，不是沙箱。
- 远端工具链会随 macmini 变化（本文件按 2026-11-03 实测记录）；skill 里写的是当时事实，
  装 / 卸工具后以 `command -v` 实测为准。
- 用户的日常「十几秒级」命令（`npm run build`、整套 JS 测试）只在系统提示里提示判断，
  不硬拦——这些命令是否值得分流取决于远端有没有装好依赖，写死拦截反而更慢。
- 只在非 macmini 主机生效（hostname 判定）；在 macmini 上不注册任何钩子。
