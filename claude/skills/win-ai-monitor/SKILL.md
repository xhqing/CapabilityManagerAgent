---
name: win-ai-monitor
description: Win-AI 桌面操作可视化——把 AI 对 Windows 机器的操作过程实时显示在用户桌面。当需要操作同一局域网内的 Windows 机器（别名 win-ai / win-ai-admin）、用户要求看到操作过程、需要可视化 AI 在 Win 上的执行、或涉及桌面代理（win-ai-agent）时【必须】使用本 skill。遇到任何"在 Win 上执行操作给用户看"的场景都触发本 skill。
---

# Win-AI 桌面操作可视化

## 作用

用户只看屏幕，即可全程看到 AI 在 Windows 机器上的操作。核心机制是「**桌面代理**」：常驻用户会话（Session 2），执行命令时弹**最大化置顶终端窗口**显示输入输出，操作哪个程序就把哪个程序窗口**最大化置顶**。另有后台监视台记录全部日志（不抢焦点）。

## 前提（组件已在 Win 设备上就绪）

| 组件 | 路径（Win 设备） | 用途 |
|---|---|---|
| 桌面代理脚本 | `C:\Users\xhq\win-ai-agent.ps1` | 监听命令文件，弹置顶终端执行命令 / 任意窗口置顶 |
| 代理命令文件 | `C:\Users\xhq\win-ai-agent-cmd.txt` | AI 侧写入指令，代理轮询执行 |
| 代理输出文件 | `C:\Users\xhq\win-ai-agent-out.txt` | 命令与输出的实时记录 |
| 代理计划任务 | `WinAIAgent` | 登录自启 + 触发（XML，InteractiveToken） |
| 监视台脚本 | `C:\Users\xhq\monitor-gui.ps1` | 后台记录版 GUI，黑底绿字实时滚动日志（不置顶） |
| 监视日志文件 | `C:\Users\xhq\win-ai-console.txt` | 监视台滚动显示的日志 |
| 监视计划任务 | `WinAIMonitor` | 登录自启 + 触发监视台 |
| PsExec | `C:\Users\xhq\PSTools\psexec.exe` | 把任务投递到用户交互桌面（Session 2） |

> 组件若缺失或损坏，按「重建」一节恢复。组件属本机运行配置，不进任何 git 仓库。

## SSH 登录（命令习惯）

- **SSH 默认 shell 已设为 Git Bash**（`HKLM\SOFTWARE\OpenSSH\DefaultShell = C:\Program Files\Git\bin\bash.exe`），登录后直接用 bash 语法（`ls`、`pwd`、`cd`、`grep`、`cat` 等）。
- 需要 PowerShell 时显式调用：`powershell -NoProfile -Command "..."` 或 `powershell -EncodedCommand <base64>`（bash 里注意转义）。
- 写日志、写指令文件统一走 bash：`ssh win-ai-admin "powershell -NoProfile -Command \"Add-Content ...\""` 仍可用（显式 powershell）。

## 代理指令（核心操作）

AI 侧向 `C:\Users\xhq\win-ai-agent-cmd.txt` 追加指令，代理 1 秒轮询执行，输出追加到 out 文件：

| 指令 | 效果 |
|---|---|
| `EXEC <命令>` | 弹**最大化置顶**终端窗口（标题 AI-CMD-时间）执行命令，打印输入输出，窗口保持打开 |
| `TOP <进程名>` | 把该进程的窗口**最大化置顶**（如 `TOP Code` 置顶 VSCode、`TOP msedge` 置顶 Edge、`TOP Feishu` 置顶飞书） |

写指令示例：

```bash
ssh -o BatchMode=yes win-ai-admin "powershell -NoProfile -Command \"Add-Content -Path C:\\Users\\xhq\\win-ai-agent-cmd.txt -Value 'EXEC ipconfig' -Encoding utf8\""
ssh -o BatchMode=yes win-ai-admin "powershell -NoProfile -Command \"Add-Content -Path C:\\Users\\xhq\\win-ai-agent-cmd.txt -Value 'TOP Code' -Encoding utf8\""
```

读输出：

```bash
ssh -o BatchMode=yes win-ai-admin "powershell -NoProfile -Command \"Get-Content C:\\Users\\xhq\\win-ai-agent-out.txt -Encoding utf8 -Tail 20\""
```

> 注意：`EXEC` 的命令是 `cmd /c` 语法；多个指令可一次追加多条（每行一条），代理串行处理。命令窗口保持打开（`/k`），用完可清理。

## 启动/重启代理与监视台

代理和监视台都通过计划任务（XML，InteractiveToken）注册为**登录自启**。手动触发必须用 psexec 投递到用户会话（Session 2）：

```bash
# 重启代理（先杀掉旧代理进程——Session 2 的 powershell，再触发）
ssh -o BatchMode=yes win-ai-admin "taskkill /PID <旧代理PID> /F"
ssh -o BatchMode=yes win-ai-admin "C:\Users\xhq\PSTools\psexec.exe -accepteula -i 2 -d schtasks /run /tn WinAIAgent"
# 重启监视台同理（/tn WinAIMonitor）
```

验证：`ssh win-ai-admin "tasklist /v" | grep -i powershell` 应看到 `Console 2` 会话的 powershell 进程（内存约 65-90MB 为 GUI/代理已加载）。

## 清理残留 AI-CMD 窗口

每次 `EXEC` 会留下一个 `/k` 保持打开的 cmd 窗口。用 psexec 在用户会话清理：

```bash
ssh -o BatchMode=yes win-ai-admin "C:\Users\xhq\PSTools\psexec.exe -accepteula -i 2 -d powershell -NoProfile -Command \"Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { \$_.SessionId -eq 2 -and \$_.MainWindowHandle -ne 0 } | Stop-Process -Force\""
```

## 重建（组件缺失时）

1. 创建两个数据文件：`win-ai-agent-cmd.txt`、`win-ai-agent-out.txt`、`win-ai-console.txt`（`Set-Content -Encoding utf8`）。
2. 上传 `scripts/win-ai-agent.ps1`（代理 v7）与 `scripts/monitor-gui.ps1`（后台监视台）。
3. 下载 PsExec 到 `C:\Users\xhq\PSTools\`（`curl -L -o PSTools.zip https://download.sysinternals.com/files/PSTools.zip`，解压）。
4. 用 `scripts/winaimonitor-task.xml`、`scripts/winaiagent-task.xml` 注册两个计划任务（`schtasks /create /tn WinAIMonitor /xml ... /f`，`schtasks /create /tn WinAIAgent /xml ... /f`）。
5. 用「启动/重启」一节触发并验证。

## 关键坑（务必避开）

1. **Session 0 隔离**：SSH 服务跑在 Session 0，直接启动的窗口永远不可见，且 **Session 0 查不到用户桌面的任何窗口句柄**（任务栏、其他程序都查不到）。必须经计划任务 + psexec `-i 2` 投递到用户会话。
2. **`schtasks /run` 从 SSH 直跑会在 Session 0 执行**（任务卡 Queued）——必须用 `psexec -i 2 -d schtasks /run` 包一层；计划任务 XML 必须用 `LogonTrigger + InteractiveToken`。
3. **脚本编码**：PowerShell 5.1 按 GBK 读 UTF-8 无 BOM 脚本会乱码闪退，写 .ps1 必须带 UTF-8 BOM。
4. **GUI 事件作用域**：Timer 脚本块要访问全局变量（`$global:`），否则窗口不刷新内容。
5. **任务栏恢复**：隐藏任务栏（ShowWindow Shell_TrayWnd 0）可能让它失效，**不要隐藏任务栏**；万一任务栏消失，在用户会话（psexec -i 2）重启 explorer 或 ShowWindow 恢复。
6. **中文乱码**：终端显示乱码多因编码，文件本身是 UTF-8，用 `Get-Content -Encoding utf8` 读正常。
7. **`$Args` 是 PowerShell 自动变量**：用作函数参数名会导致传参为空，参数名用 `$ArgStr` 等。
