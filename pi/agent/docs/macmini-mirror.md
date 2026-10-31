# 本机 ↔ macmini 全量镜像（Syncthing 双向同步）

> 2026-10-28 用户要求建立：把本机注册表里的全部 Agent 项目与非 Agent 项目镜像到 macmini，
> 两机任一方改动都自动同步、保持逐字节一致；全局 `~/.pi/agent/` 同样镜像；并切断 macmini
> 与 GitHub 的连接，所有同步到 GitHub 的动作走本机。
>
> 本文是这套镜像的权威说明：拓扑、同步范围、排除项、断连方式、日常操作、已知边界。

## 一、拓扑

| 项目 | 本机 | macmini |
|---|---|---|
| 机器 | MacBook Air（arm64） | Mac mini（Intel x64） |
| 用户 | `/Users/xhq` | `/Users/mac` |
| 守护进程 | Syncthing 2.1.5（brew，`sh.brew.syncthing`） | Syncthing 2.1.5（独立二进制，`com.local.syncthing`） |
| Device ID | `HLAXNSF-OJSCYNT-PEOIRA3-3RHATRR-43IZWQK-NVDKOHP-HKYFJ4U-3GESEAO` | `STHSVVE-Y6ZQSUM-BNJBW7Q-P7QTZBQ-IL6QEYL-QJMYKFQ-TN5WWOV-5QYSTQ5` |
| 配置 | `~/Library/Application Support/Syncthing/config.xml` | 同左（用户 mac） |

两台机器在同一局域网，Syncthing 走 LAN 直连（`tcp://192.168.1.101:22000`），不依赖 GitHub、
不依赖中继；断网时各自继续工作，恢复后自动续传。

**两个共享目录（folder id 两机必须一致）：**

| folder id | 本机路径 | macmini 路径 |
|---|---|---|
| `developer` | `/Users/xhq/Developer` | `/Users/mac/Developer` |
| `pi-agent` | `/Users/xhq/.pi/agent` | `/Users/mac/.pi/agent` |

## 二、同步语义

- **双向**：folder 类型 `sendreceive`，任一方新增 / 修改 / 删除都会传播到另一方。
- **近实时**：`fsWatcherEnabled=true`、`fsWatcherDelayS=3`——文件改动约 3 秒后开始同步；
  另有每 10 分钟一次的全量重扫兜底（`rescanIntervalS=600`）。
- **冲突不覆盖**：同一文件在两台机器上都被改过时，Syncthing **不会**用一方覆盖另一方，
  而是在旁边生成 `*.sync-conflict-<日期>-<时间>-<设备>.ext` 副本，两份都保留。
  这类副本会被 `status.py` 统计，需要人工合并。
- **删除可恢复**：两个 folder 都开了 staggered 版本库（保留 30 天），路径在本机
  `~/.syncthing-versions/<folder>/`、macmini `~/.syncthing-versions/<folder>/`（在共享目录之外，
  不会被同步）。误删 / 被覆盖的文件可从版本库取回。
- **权限位随内容同步**（`ignorePerms=false`）：可执行位等在两机保持一致；文件属主不参与同步
  （本机 `xhq`、macmini `mac`，各自归属本机用户）。

## 三、同步范围与排除项（重要）

`~/Developer` 与 `~/.pi/agent` 下的**全部内容**都同步，**只有**下面这些明确排除。
排除项写在各自目录根的 `.stignore` 里（两机内容相同，模板在
`~/.pi/agent/patch/macmini-mirror/stignore-developer`、`stignore-pi-agent`）。

### `~/Developer` 排除

| 排除项 | 原因 |
|---|---|
| `node_modules` | 依赖目录，含原生模块；本机 arm64 与 macmini x64 不通用，拷过去也跑不起来（也很大、churn 多） |
| `.lake` | Lean 构建缓存（TradingProofs 里约 3.2GB），可重建、跨工具链不通用 |
| `.venv` / `venv` | Python 虚拟环境，含本机绝对路径与架构相关二进制 |
| `__pycache__` / `*.pyc` | Python 字节码缓存，可重建 |
| `.DS_Store`、`._*` | macOS 系统垃圾文件 |
| `**/.git/*.lock`、`**/.git/**/*.lock` | git 提交过程中的瞬时锁文件，同步过去会让对端误判「index 被锁」 |

以上排除项都已确认**没有被任何仓库跟踪**（`git ls-files` 核对过），因此不影响 git 内容一致性。

### `~/.pi/agent` 排除

| 排除项 | 原因 |
|---|---|
| `sessions/` | pi 会话记录，两台机器各自在写（活进程），同步会互相打架；macmini 保留自己的会话 |
| `state/` | 运行时状态（ai-edit-diff 快照、workspace-history、ark-key-pool 状态），本机专属 |
| `logs/`、`tmp/`、`*.log` | 运行日志与临时文件 |
| `intercom/` | 会话间通信的运行时数据（socket / 注册表） |
| `npm/` | pi 的 npm 包（含原生模块），架构相关；macmini 用自己的 x64 版本 |
| `bin/` | fd / rg 等辅助二进制，架构相关；macmini 用自己的 x64 版本 |
| `models-store.json`、`mcp-cache.json`、`mcp-npx-cache.json`、`mcp-last-seen-version.json` | 运行时缓存 |
| `trust.json`、`mcp-project-approvals.json` | 记录本机绝对路径的信任 / 审批清单 |
| `skills/anysearch/runtime.conf` | 含本机路径的运行时配置（两机各自维护） |
| `patch/session-link/config.json`、`local-links.json`、`chain-registry.json` | 按 hostname 区分 source / replica 角色，两机必须不同 |
| `__pycache__`、`*.pyc`、`.DS_Store`、`*.lock` | 缓存与系统垃圾 |

**为什么不把这些也做成逐字节一致**（诚实说明）：`sessions` / `state` / `logs` 是活进程正在写的
运行时数据，两边持续各自写入，强行同步只会制造无休止的冲突副本，反而破坏「一致」；`npm` / `bin`
是 arm64 与 x64 的二进制，逐字节一致就意味着 macmini 上的 pi 直接跑不起来。其余部分（技能、扩展、
文档、规则、补丁、模型配置、凭据等能力层）都是逐字节同步的。

## 四、macmini 与 GitHub 断连

2026-10-28 起，macmini **不再直连 GitHub**，所有 GitHub 操作（push / PR / Release / clone / fetch）
只在本机做。断连由三层保证（都在 macmini 上）：

1. **SSH 密钥移走**：`~/.ssh/id_rsa`、`id_rsa.pub` 已移到
   `~/.ssh/disabled-github-20261028/`（可逆，没有删除）。
2. **SSH 层拦截**：`~/.ssh/config` 里 `Host github.com` 指向 `127.0.0.1:9`（立刻拒绝，不出网）。
3. **git 层拦截**：`git config --global` 里用 `url.https://github.invalid/.insteadOf` 把
   `https://github.com/`、`http://github.com/`、`git@github.com:`、`ssh://git@github.com/`、
   `git://github.com/` 全部改写到不存在的域名——任何 fetch / push / clone 都会立刻失败。

**验证过**（2026-10-28）：`git ls-remote https://github.com/...`、`git ls-remote git@github.com:...`、
`ssh -T git@github.com` 全部失败；同步本身不依赖 GitHub，不受影响。

**要恢复 macmini 的 GitHub 访问**（一般不需要）：删除 `~/.ssh/config` 里的
`BEGIN/END macmini-github-cut` 段；`git config --global --unset-all
'url.https://github.invalid/.insteadOf'`；把 `~/.ssh/disabled-github-20261028/` 里的密钥移回 `~/.ssh/`。

## 五、日常操作

```bash
# 状态（链路、是否同步完、错误、冲突数）
python3 ~/.pi/agent/patch/macmini-mirror/status.py

# 逐字节校验（对全部文件算 SHA-256 比对；初始化或大改后跑一次，约 1~2 分钟）
python3 ~/.pi/agent/patch/macmini-mirror/verify.py

# 只看某个目录
python3 ~/.pi/agent/patch/macmini-mirror/verify.py pi-agent

# 重建 / 补齐 Syncthing 配置（幂等，可重复跑）
python3 ~/.pi/agent/patch/macmini-mirror/setup.py

# 看 macmini 的 Syncthing 面板（本机转发端口，不抢焦点）
ssh -L 8385:127.0.0.1:8384 mac-mini    # 然后浏览器打开 http://127.0.0.1:8385
```

- **暂停同步**：本机面板 127.0.0.1:8384 → 对应 folder → Pause；macmini 面板经上面的 SSH 转发。
- **冲突处理**：`status.py` 报冲突后，用 `find ~/Developer -name '*.sync-conflict-*'` 找到副本，
  人工比较后保留正确版本、删掉冲突副本；删除动作会同步到另一台（版本库保留 30 天）。
- **误删恢复**：去 `~/.syncthing-versions/<folder>/` 找对应日期的版本，拷回原位。
- **macmini 上没有 node_modules**：需要在 macmini 跑某个 JS 项目时，进项目目录 `npm ci` 或
  `npm install` 一次即可（依赖目录不参与同步，两边各自安装）。
- **健康检查**：本机 launchd `com.xhq.mirror-check` 每 10 分钟跑一次 `status.py --check`，
  异常（断链 / 同步未完成 / 出现冲突）时发系统通知；日志在 `~/Library/Logs/macmini-mirror.log`。
- **每日深度校验**：本机 launchd `com.xhq.mirror-verify` 每天 03:00 跑一次 `verify.py all`
  （全量 SHA-256 比对，约 25 秒），发现差异时发通知；日志在 `~/Library/Logs/macmini-mirror-verify.log`。
  这样即使出现「删除与写入竞争」留下的孤儿文件（Syncthing 自认为已一致、实际磁盘上多出一份），
  也会在当天被发现。

## 六、首次迁移记录（2026-10-28）

- macmini 原有内容**没有删除**，整体归档在
  `~/Archive-Migrated/mirror-seed-20261028-202611/`（约 910MB）：
  - `Developer/`：原有的 QuantStrategistAgent / Intraday / Swing / gridtrader 副本；
  - `pi-agent/`：原有能力层（CLAUDE.md / docs / skills / extensions / patch / 配置）。
  - 核对过：macmini 的 QuantStrategistAgent HEAD `ea9adf5` 是本机 `697e0db` 的祖先（本机已包含），
    Intraday 只有未跟踪的 `data_tick`，没有会丢失的独有提交。
- macmini 上 `sessions/`、`state/`、`npm/`、`bin/` 等本机专属目录**原地保留**，未参与迁移。
- 旧的单向同步（`patch/sync-to-macmini/watcher.js`，launchd `com.xhq.pi-sync-macmini`）已停用，
  launchd 配置移到 `~/Library/LaunchAgents/disabled/`；脚本移入 `patch/_retired/sync-to-macmini/`。
- macmini 的常驻会话（Mark / Mark-Intraday / Mark-Swing / Mark-gridtrader / macmini 值班）
  在迁移期间暂停，迁移完成后由 `com.xhq.pi-duty` 恢复。

## 七、已知边界与风险（务必知道）

1. **双机同时改同一文件** → 产生 `.sync-conflict-*` 副本，不会丢数据，但需要人工合并；
   `status.py` 会报出来。
2. **双机同时对同一个 git 仓库做写操作**（commit / rebase / gc）→ 有风险：`.git` 是逐文件同步的，
   两边同时写 ref 可能互相覆盖，导致一边的提交变成「游离对象」。**2026-10-31 起 macmini 侧已由
   工具强制只读**（pi 扩展 `git-readonly-guard.ts` + 全局 git hook，见
   `~/.pi/agent/patch/macmini-git-readonly/README.md`）：在 macmini 上任何 git 写操作都会被拦下，
   改动只留在工作区、经镜像回流本机后再提交。所以正常流程里不会再出现双机同时写；
   若发现 macmini 上的写操作没被拦住（例如新增的绕过方式），应修复守卫而不是继续操作。
3. **`.git` 同步存在短暂不一致窗口**：本机正在 commit 时，macmini 可能短暂看到「ref 已更新、
   对象还没到」的中间态；等同步完成即恢复。不要在这个窗口里在 macmini 上跑修复类 git 命令。
4. **架构差异**：macmini 是 Intel x64，本机是 arm64。依赖目录、原生二进制、Lean/Python 构建缓存
   都不同步，需要在 macmini 上各装各的；纯源码 / 文档 / 配置逐字节一致。
5. **macmini 上的 Mark 会话现在会回流**：过去「给 macmini 的 Mark-* 派活不会回流本机」的说法
   **已失效**——镜像建立后，macmini 上的改动会同步回本机。详见全局 `CLAUDE.md`「跨机协作」节的更新说明。
6. **`/Users/xhq` 与 `/Users/mac` 的绝对路径**：被排除的配置（trust / approvals / anysearch runtime /
   session-link）两机各自维护；同步过去的文档里如果写了 `/Users/xhq/...`，在 macmini 上不成立，
   属于「内容一致」的代价，按需在两机各自的机器上理解。

## 八、文件清单

| 文件 | 作用 |
|---|---|
| `patch/macmini-mirror/setup.py` | 幂等配置两机 Syncthing（设备、folder、版本库） |
| `patch/macmini-mirror/status.py` | 状态检查；`--check` 供 launchd 做异常通知 |
| `patch/macmini-mirror/verify.py` | 逐字节 SHA-256 校验 |
| `patch/macmini-mirror/stignore-developer` | `~/Developer/.stignore` 模板 |
| `patch/macmini-mirror/stignore-pi-agent` | `~/.pi/agent/.stignore` 模板 |
| `patch/macmini-mirror/verify-daily.sh` | 每日全量校验脚本（launchd 调用） |
| `patch/macmini-git-readonly/` | macmini 只读约束：全局 git hook（commit / push / merge / rebase 等写操作拒绝）+ `install.sh` / `uninstall.sh` + 说明；对应 pi 扩展 `extensions/git-readonly-guard.ts`（2026-10-31 立） |
| `~/Library/LaunchAgents/com.xhq.mirror-check.plist` | 本机每 10 分钟健康检查 |
| `~/Library/LaunchAgents/com.xhq.mirror-verify.plist` | 本机每日 03:00 全量逐字节校验 |
| macmini `~/Library/LaunchAgents/com.local.syncthing.plist` | macmini Syncthing 守护 |
