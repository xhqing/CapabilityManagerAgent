# macmini git 只读约束（2026-10-31 用户立规）

> 用户原话：「禁止 macmini 这台设备进行 git 写操作，git add / git commit / git push 等等
> 写操作全部禁止。」

## 一、为什么

本机（MacBook Air）与 macmini 的 `~/Developer` 与 `~/.pi/agent` 是**逐字节双向镜像**
（Syncthing，详见 `~/.pi/agent/docs/macmini-mirror.md`），`.git` 目录也一起同步。

于是出现两个问题：

1. **两边同时写会互相破坏。** git 的写操作会改 `refs/`、`index`、对象库；两台机器同时写
   同一个仓库时，这些文件会被对方版本覆盖——轻则一方的提交变成「游离对象」（`git log`
   里看不见、只能靠 `git fsck` 捞），重则索引 / ref 直接损坏。
2. **写了也没用。** macmini 已切断 GitHub（push / PR / Release / clone / fetch 全只在
   MacBook 做），在 macmini 上提交出来的东西最终仍得回本机重做一遍、重新推送，纯属
   多余的风险来源。

所以 macmini 的定位明确为：**只读镜像 + 算力**。它只跑计算、只产出文件；提交 / 发版 /
建 PR 一律回 MacBook 做，macmini 上的文件改动经镜像自动回流本机。

## 二、两层工具强制

规矩不能只写在文档里（「规矩必须配套工具强制」是全局元规则），所以做了两层：

| 层 | 位置 | 覆盖 | 拦得住什么 |
|---|---|---|---|
| ① pi 扩展 | `~/.pi/agent/extensions/git-readonly-guard.ts` | macmini 上所有 pi 会话（含值班会话与 Mark-\* 会话） | 全部 git 写子命令（白名单之外一律拦）+ `gh` 写操作；覆盖 `bash` 与 `background_run` 两条路径 |
| ② 全局 git hook | `core.hooksPath` → `~/.pi/agent/patch/macmini-git-readonly/hooks` | macmini 上**所有进程**（pi / CC / 用户手动 / 脚本） | git 自身有钩子的写操作：`commit`、`push`、`merge`、`rebase`、`am`、`gc --auto` |

两层都只在 macmini 上生效（pi 扩展按 hostname 判定，与 session-link 的 role 判定同口径；
hook 只在 macmini 的全局 git 配置里设置），**MacBook 零影响**。

**没有逃生门**：这是设备级只读约束，不设授权标记。AI 在 macmini 上遇到拦截时的正确做法
不是换写法绕过，而是回本机做——守卫的拒绝理由里也是这么写的。

## 三、判定规则（白名单）

pi 扩展采用**白名单**：只有明确的只读子命令放行，其余（含将来新增的冷门子命令）默认拦。

- **放行（只读）**：`status` `diff` `log` `show` `blame` `shortlog` `describe` `grep`
  `rev-parse` `rev-list` `ls-files` `ls-tree` `ls-remote` `cat-file` `for-each-ref`
  `show-ref` `name-rev` `merge-base` `merge-tree` `range-diff` `show-branch` `whatchanged`
  `cherry` `count-objects` `fsck` `verify-commit` `verify-tag` `check-ignore` `check-attr`
  `var` `version` `help` `archive` `format-patch` `diff-tree` `diff-files` `diff-index` 等；
  以及带条件的查询形态：
  - `branch`：列表 / `-a` / `-v` / `--show-current` / `--contains` / `--merged` 等查询放行，
    创建 / `-d` / `-m` / `-c` / `-u` 等一律拦；
  - `tag`：`-l` / `--list` / `-v` / `-n` 查询放行，创建 / `-d` / `-a` / `-s` / `-m` 一律拦；
  - `config`：`--get` / `--list` / 单键读取放行，带值写入 / `--unset` / `--add` 一律拦；
  - `remote`：`-v` / `show` / `get-url` 放行，`add` / `set-url` / `rename` / `prune` 等拦；
  - `stash`：`list` / `show` 放行，裸 `stash`（= push）/ `pop` / `apply` / `drop` 拦；
  - `notes`：`list` / `show` 放行；`worktree`：仅 `list`；`submodule`：`status` / `summary`；
    `reflog`：`show` / 裸命令放行，`expire` / `delete` 拦。
- **拦截（写）**：`add` `commit` `push` `pull` `fetch` `reset` `restore` `merge` `rebase`
  `cherry-pick` `revert` `rm` `mv` `checkout` `switch` `clean` `gc` `prune` `repack`
  `update-ref` `symbolic-ref` `update-index` `read-tree` `write-tree` `commit-tree`
  `hash-object -w` `filter-branch` `filter-repo` `init` `clone` `apply` `am` `bisect`
  `sparse-checkout` `bundle` `lfs` 等全部，以及 `gh` 的写操作（`pr create` / `merge`、
  `release create` / `upload`、`issue create`、`repo clone`、`api` 非 GET 等）。

## 四、安装与卸载（都在 macmini 上执行，本机不装）

```bash
# 安装（设 core.hooksPath；脚本会拒绝在 MacBook 上运行）
ssh mac-mini '~/.pi/agent/patch/macmini-git-readonly/install.sh'

# 卸载（仅在用户明确要求时）
ssh mac-mini '~/.pi/agent/patch/macmini-git-readonly/uninstall.sh'
```

`~/.pi/agent` 与 `~/Developer` 是镜像同步的，所以本目录与扩展文件在两台机器上内容一致；
差别只在**是否启用**：macmini 设了 `core.hooksPath`，MacBook 没设，扩展则靠 hostname 自动区分。

## 五、生效时机与验证

- **git hook**：执行完 `install.sh` 立即生效（不依赖重启）。
- **pi 扩展**：扩展在**会话启动时**加载——macmini 上**已经在跑的 pi 会话不会热加载**。
  要让它们也受拦截，需要重启对应会话：
  - 值班会话 `macmini` 由 launchd 守护、每 6 小时自动重启一次（`duty.conf`），最迟 6 小时内自然生效；
  - Mark 系会话（`Mark` / `Mark-Intraday` / `Mark-Swing` / `Mark-gridtrader`）设为「不重启」，
    需手动重启（`screen` 名见 `patch/duty-macmini/duty.conf`；kill 后 `duty.sh` 会在 2 分钟内自动重拉）。
    未重启期间，它们的 `commit` / `push` 一类仍被 git hook 拦，`add` / `tag` / `reset` 一类则有缺口。
- **验证**（在 macmini 上）：

```bash
ssh mac-mini 'cd /tmp && rm -rf ro-check && mkdir ro-check && cd ro-check && git init -q . && echo x > f && git add -A'
# 预期：git hook 阶段不拦 add（git 没有 add 钩子），但下面这条必然被拒：
ssh mac-mini 'cd /tmp/ro-check && git -c user.name=t -c user.email=t@t commit -m x'
# 预期：输出 [macmini-git-readonly] 拒绝执行……（exit 1）
```

pi 扩展那层则在 macmini 上的 pi 会话里直接验证：让它执行 `git status`（应放行）与
`git add .`（应被拦，理由里含「macmini 是只读镜像机」）。

## 六、已知边界（诚实说明）

1. **`git add` 没有 git 钩子可拦**——它只能靠 pi 扩展（pi 会话）拦。CC / 用户手动 / 脚本在
   macmini 上跑 `git add` 不会被 hook 拦（但 add 只动索引，风险远小于 commit / push；且
   `commit` 会被 hook 兜住，索引本身不会进历史）。
2. **静态文本判断**：pi 扩展只看命令文本，把命令写进 `.sh` 文件再执行、或用 python / node
   脚本调用 git 子进程，扩展看不到（hook 仍兜 commit / push 一类）。
3. **`core.hooksPath` 是全局的**：macmini 上所有仓库都会用本目录的钩子，仓库自带的
   `.git/hooks`（husky 等）在 macmini 上不生效——macmini 只做镜像、不跑开发流程，这个取舍可接受。
4. **不拦网络与其它写操作**：只读约束只管 git / gh 的写；普通文件写（含 `rm` / `mv`）不受限，
   那部分靠镜像的版本库与双向同步机制（详见 `docs/macmini-mirror.md`）。

## 七、相关文档

- 规则条文：`~/.pi/agent/CLAUDE.md`「跨机协作：macmini 值班会话」节的「macmini 严格 git 只读」条。
- 镜像说明：`~/.pi/agent/docs/macmini-mirror.md`（同步范围、排除项、冲突处理）。
- 扩展源码：`~/.pi/agent/extensions/git-readonly-guard.ts`。
