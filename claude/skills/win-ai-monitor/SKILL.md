---
name: win-ai-monitor
description: Win 设备（别名 win-ai / win-ai-admin，局域网 Windows 机器）远程操作的经验与坑——SSH 连接、GUI 程序投递到用户会话、浏览器 CDP 控制环境、编码注意事项。需要 SSH 操作 Win 设备、在 Win 上跑浏览器自动化、或排查 Win 远程执行异常时使用。
---

# Win 设备远程操作经验

> 历史说明：本 skill 原名「Win-AI 桌面操作可视化」，曾部署「桌面代理 + 置顶监视台」机制把 AI 操作过程实时显示在 Win 桌面（2026-08 建成）。2026-09-04 用户裁定该机制没有意义且置顶黑窗口干扰正常使用，已**彻底停用并删除**——Win 设备上的组件文件、WinAIAgent / WinAIMonitor / ZPAct / ZPAct2 / ChromeLaunch 计划任务、本 skill 内的部署脚本全部清除。本 skill 现只保留远程操作的通用经验。

## SSH 连接

### 操作规范（权限与保密红线）

- **默认以普通权限执行**：对这台 Windows 机器的操作，默认通过别名 `ssh win-ai` 执行（公钥免密、普通权限账户）。脚本、指令、文档里只写别名，不写真实 IP、用户名、密码。
- **需要管理员权限时先征求用户同意**：遇到需要管理员权限的操作（如安装 / 卸载软件、修改系统服务、改防火墙或系统设置等），先向用户说明要做什么、为什么需要管理员权限，**征得用户同意后**再以管理员身份（`ssh win-ai-admin`）执行本次操作；**默认不主动使用管理员权限**。拿不准某操作是否需要管理员权限时，按需要询问用户，宁可多问一次，不擅自提权。
- 管理员通道 `win-ai-admin` 与普通通道一样是公钥免密，无需也不应使用密码文件。
- 需要记录连接方式时，用别名加占位符（例如「`ssh win-ai`、`ssh win-ai-admin`，真实连接信息见本机 `~/.ssh/config`」），不把真实 IP、用户名写进任何会被 git 跟踪的文件。
- 边界：本规范只管「用什么身份、怎么连」；若本机没有 `win-ai` 别名（换机器、重装系统后未重新配置），不适用，先由用户重新配置连接。

### 连接经验

- 别名：`win-ai`（普通权限账户 aiworker）、`win-ai-admin`（管理员账户 xhq，仅在需要时使用）。IP 以 `~/.ssh/config` 实时配置为准（设备用 DHCP，IP 会变；连不上先 ping 扫描找新 IP 再更新 config）。
- **默认 shell 是 PowerShell**（2026-09-04 在 win-ai-admin 实测；旧文档误记为 Git Bash）。SSH 进去直接跑 PowerShell 语法；`ls /c/...`、`cmd //c`、`VAR=x cmd` 等 bash 习惯**全部无效**且常表现为「无输出、静默失败」，极易误判。
- 复杂命令（嵌套引号、中文、循环）不要经 SSH 命令行直传，**统一用 `powershell -NoProfile -EncodedCommand <base64(UTF-16LE)>`**，本机生成编码后拼接，杜绝转义地狱。

## GUI 程序必须在用户交互会话里启动（Session 0 隔离）

- SSH 服务跑在 Session 0，SSH 直起的进程都在 Session 0：窗口不可见、无人值守、行为异常。`schtasks /run` 从 SSH 直跑也在 Session 0 执行（任务卡 Queued）。
- 要启动带界面 / 与桌面交互的程序（浏览器等），必须经 PsExec 投递到用户交互会话：
  `C:\Users\xhq\PSTools\psexec.exe -accepteula -i <会话ID> -d <程序> <参数>`。
- 会话 ID 用 `quser` 查（console 会话通常为 1），或跑 `C:\Users\xhq\get-sid.ps1`。

## 浏览器 CDP 控制环境（2026-09-04 实测）

- **必须三个条件同时满足才稳定**：① psexec 投递到用户会话；② 非 headless（带界面）；③ 加 `--disable-gpu`（显示器关闭 / 远程状态下 GPU 初始化失败会让浏览器启动即崩或数分钟内静默退出，且无崩溃转储、无事件日志，极难排查）。
- Chrome 在该设备上即使满足条件也反复崩溃（版本 154.0.8025.0）；**Edge（Chromium 内核）同样方式稳定**，优先用 Edge：`msedge.exe --user-data-dir=C:\Users\xhq\ud-edge --remote-debugging-port=9223 --disable-gpu`。
- 控制脚本：本机零依赖 node 客户端（原生 WebSocket 连 CDP）已验证可用；项目内参考实现见 ExecutiveAssistantAgent 的 `tmp/cdp-control/zpc.js`（tabs / goto / shot / eval / clicktext 命令）。
- 注意：SSH 上传含中文的 JS/文本文件后，务必校验远程文件内容（`Get-Content -Encoding UTF8`）；中文字节损坏会让页面文本检测全部静默失效，且 PowerShell 终端显示乱码无法区分「显示问题」与「文件损坏」——用脚本回读比对。

## 其它坑

1. **脚本编码**：PowerShell 5.1 按 GBK 读 UTF-8 无 BOM 脚本会乱码闪退，写 .ps1 必须带 UTF-8 BOM。
2. **中文乱码**：SSH 里看到输出乱码先区分「显示编码问题」与「文件字节损坏」，用 `Get-Content -Encoding utf8` 或脚本回读验证。
3. **`$Args` 是 PowerShell 自动变量**：用作函数参数名会导致传参为空。
4. 排查浏览器静默退出的顺序：Crashpad dump（`<profile>\Crashpad\reports`）→ 应用事件日志 → Defender 检测记录（`Get-MpThreatDetection`）→ 内存/磁盘。全都干净时优先怀疑 Session 0 / GPU 问题。
