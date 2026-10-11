# pi 第三方 npm 包清单（备份与迁移）

本目录是**本机 pi 在用第三方 npm 包的「声明 + 精确锁 + 人读清单」**，由全局
`~/.claude/patch/npm-manifest/refresh.py` 生成同步。

**用途：备份与换机迁移。** 新机器按本目录的清单即可找回并**精确重建**本机 pi 的第三方
能力（换笔记本、重装系统等场景）。它**不是**对第三方源码的镜像——包内容不放进来，
原因：源码可从 npm / GitHub 按清单重新获取；整目录体积大（本机实测 96 MB，含平台
二进制）、与平台和 Node 版本耦合、每次装包升级都要重新复制、仓库会持续膨胀。
「声明 + 锁」是 npm 生态标准的恢复凭据：体积小（约 45 KB）、平台无关、可精确复现。

## 文件

| 文件 | 来源 | 作用 |
|---|---|---|
| `package.json` | 本机 `~/.pi/agent/npm/package.json` 副本 | 直接依赖声明（版本范围） |
| `package-lock.json` | 本机 `~/.pi/agent/npm/package-lock.json` 副本 | 精确版本 + 下载地址 + 完整性哈希（可复现安装） |
| `PACKAGES.md` | `refresh.py` 生成 | 人读清单：包名 / 精确版本 / 来源 / License / 用途 |
| `README.md`（本文件） | 手工维护 | 用途说明与迁移指引 |

## 迁移到新机器

1. **装 pi 本体**：本机使用 fork `github.com/xhqing/pi`（git 克隆 `~/Developer/pi`），
   从该仓库 Releases 下载 `pi-coding-agent-<版本>.tgz` 后 `npm install -g <tarball>` 安装；
   当前版本 **v0.0.4**（2026-10-11 时点；升级 pi 后请顺手更新此数）。
2. **恢复第三方包**：按 `PACKAGES.md` 逐个安装（精确版本），例如：
   ```bash
   pi install npm:pi-intercom@0.17.0
   pi install npm:pi-mcp-adapter@5.2.0
   pi install npm:pi-provider-volcengine-agent-plan@0.4.1
   pi install npm:pi-workspace-history@0.5.0
   ```
   安装后 pi 会自动把它们写进本机 `~/.pi/agent/settings.json` 的 `packages`。
3. **恢复自研能力**（本仓库就是镜像源）：
   - `pi/agent/extensions/*.ts` → `~/.pi/agent/extensions/`
   - `claude/skills`、`claude/CLAUDE.md`、`claude/docs`、`claude/hooks`、`claude/patch`
     → `~/.claude/` 对应位置
4. **凭证与数据（不在本机制范围）**：登录凭证（`~/.pi/agent/auth.json` 等）、会话数据
   （`~/.pi/agent/sessions/`）、工作区历史状态（`~/.pi/agent/state/`）属于本机隐私数据，
   不入库；按需从密码库或云盘备份恢复，或在新机器重新登录。

## 更新与校验

装 / 删 / 升级 pi 包后，在本机运行：

```bash
python3 ~/.claude/patch/npm-manifest/refresh.py          # 刷新本目录
python3 ~/.claude/patch/npm-manifest/refresh.py --check  # 校验镜像与当前本机是否一致
```

刷新后按规矩记本仓库 CHANGELOG 并提交。
