# Win-AI 操作监视台 (后台记录版) - 不置顶, 不抢焦点, 可被覆盖
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$global:monText = New-Object System.Windows.Forms.TextBox
$global:monLast = 0

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Win-AI 操作监视台 (后台记录)'
$form.Size = New-Object System.Drawing.Size(700, 480)
$form.TopMost = $false
$form.StartPosition = 'Manual'
$form.Left = 20
$form.Top = 20
$form.MinimizeBox = $true

$global:monText.Multiline = $true
$global:monText.ReadOnly = $true
$global:monText.ScrollBars = 'Vertical'
$global:monText.Dock = 'Fill'
$global:monText.Font = New-Object System.Drawing.Font('Consolas', 10)
$global:monText.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 20)
$global:monText.ForeColor = [System.Drawing.Color]::LimeGreen
$form.Controls.Add($global:monText)

$global:monText.Text = Get-Content 'C:\Users\xhq\win-ai-console.txt' -Raw -Encoding UTF8
$global:monLast = $global:monText.Text.Length
$global:monText.SelectionStart = $global:monText.TextLength
$global:monText.ScrollToCaret()

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.Add_Tick({
    if (Test-Path 'C:\Users\xhq\win-ai-console.txt') {
        $content = Get-Content 'C:\Users\xhq\win-ai-console.txt' -Raw -Encoding UTF8
        if ($content.Length -ne $global:monLast) {
            $global:monText.Text = $content
            $global:monText.SelectionStart = $global:monText.TextLength
            $global:monText.ScrollToCaret()
            $global:monLast = $content.Length
        }
    }
})
$timer.Start()
[System.Windows.Forms.Application]::Run($form)
