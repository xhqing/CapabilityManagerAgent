# Win-AI 桌面代理 v7 - 支持任意窗口置顶 (TOP <进程名>)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32v7 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@

$cmdFile = 'C:\Users\xhq\win-ai-agent-cmd.txt'
$outFile = 'C:\Users\xhq\win-ai-agent-out.txt'
$lastLen = 0
$busy = $false
$HWND_TOPMOST = [IntPtr](-1)
$TOPMOST_FLAGS = 0x0001 -bor 0x0002
$SW_MAXIMIZE = 3

function Maximize-Topmost([IntPtr]$hWnd) {
    [Win32v7]::ShowWindow($hWnd, $SW_MAXIMIZE) | Out-Null
    [Win32v7]::SetWindowPos($hWnd, $HWND_TOPMOST, 0, 0, 0, 0, $TOPMOST_FLAGS) | Out-Null
    [Win32v7]::SetForegroundWindow($hWnd) | Out-Null
}

function Top-App([string]$procName) {
    $procs = Get-Process -Name $procName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
    if ($procs) {
        $win = $procs | Select-Object -First 1
        Maximize-Topmost $win.MainWindowHandle
        Add-Content -Path $outFile -Value "`n>>> [$(Get-Date -Format 'HH:mm:ss')] TOP $procName (置顶, $($procs.Count) 个窗口)" -Encoding utf8
    } else {
        Add-Content -Path $outFile -Value "`n>>> [$(Get-Date -Format 'HH:mm:ss')] TOP $procName (未找到窗口)" -Encoding utf8
    }
}

function Exec-Cmd([string]$cmd) {
    $global:busy = $true
    $stamp = Get-Date -Format 'HH:mm:ss'
    Add-Content -Path $outFile -Value "`n>>> [$stamp] $cmd" -Encoding utf8
    try {
        $title = "AI-CMD-$stamp"
        $p = Start-Process cmd -ArgumentList '/k', "title $title & $cmd" -WindowStyle Maximized -PassThru
        Start-Sleep -Seconds 2
        $win = Get-Process -Name cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -Last 1
        if ($win) { Maximize-Topmost $win.MainWindowHandle }
        $result = & cmd /c $cmd 2>&1
        $result | ForEach-Object { Add-Content -Path $outFile -Value "    $_" -Encoding utf8 }
        Add-Content -Path $outFile -Value "<<< exit=$LASTEXITCODE [$stamp]" -Encoding utf8
    } catch {
        Add-Content -Path $outFile -Value "<<< ERROR: $($_.Exception.Message)" -Encoding utf8
    }
    $global:busy = $false
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.Add_Tick({
    if (-not $global:busy -and (Test-Path $cmdFile)) {
        $content = Get-Content $cmdFile -Raw -Encoding utf8
        if ($content.Length -ne $global:lastLen) {
            $new = $content.Substring($global:lastLen)
            $global:lastLen = $content.Length
            $new -split "`n" | Where-Object { $_.Trim() } | ForEach-Object {
                $line = $_.Trim()
                if ($line -match '^EXEC\s+(.+)$') {
                    Exec-Cmd $Matches[1]
                } elseif ($line -match '^TOP\s+(.+)$') {
                    Top-App $Matches[1].Trim()
                }
            }
        }
    }
})
$timer.Start()
Add-Content -Path $outFile -Value "`n=== Win-AI 代理 v7 已启动 [$(Get-Date -Format 'HH:mm:ss')] ===" -Encoding utf8
[System.Windows.Forms.Application]::Run()
