<#
.SYNOPSIS
  Registers run-loop.ps1 to launch automatically when THIS Windows account
  logs in — no Administrator rights required (unlike a real Windows Service).

.DESCRIPTION
  Writes a shortcut into this user's Startup folder
  (shell:startup = %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup).
  Windows runs everything in that folder automatically after login.

  Limitation: the app only starts once someone logs into this Windows
  account. It will NOT start before login (as a true Service would), so on
  a reboot with nobody logged in, the app stays down until the account logs
  in again (interactively, or via an RDP session left connected/disconnected).

.EXAMPLE
  # Run from the project root:
  .\deploy\windows\install-startup-shortcut.ps1 -DatabaseUrl "postgresql://expense_billing:secret@localhost:5432/expense_billing" -SessionSecret "a-long-random-value"
#>

param(
    [string]$DatabaseUrl,
    [string]$SessionSecret,
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
# run-loop.ps1 is a sibling of this script (both in deploy\windows\) — a
# plain $PSScriptRoot lookup is correct for that. The shortcut's own
# WorkingDirectory is set to the project root instead (one level up), since
# that's the more sensible default for anything a user runs manually from
# that shortcut's context — run-loop.ps1 itself resolves its own paths via
# its own $PSScriptRoot regardless, so this doesn't affect its behavior.
$scriptDir = $PSScriptRoot
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$runLoop = Join-Path $scriptDir "run-loop.ps1"

if (-not (Test-Path $runLoop)) {
    throw "run-loop.ps1 not found next to this script."
}

$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "ExpenseBillingApp.lnk"
$psExe = (Get-Command powershell).Source

$argList = "-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runLoop`" -Port $Port"
if ($DatabaseUrl) {
    $argList += " -DatabaseUrl `"$DatabaseUrl`""
}
if ($SessionSecret) {
    $argList += " -SessionSecret `"$SessionSecret`""
}

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $psExe
$shortcut.Arguments = $argList
$shortcut.WorkingDirectory = $projectRoot
$shortcut.WindowStyle = 7  # minimized
$shortcut.Description = "Expense Billing App - auto-start on login (no admin required)"
$shortcut.Save()

Write-Host "Shortcut created: $shortcutPath"
Write-Host "It will run automatically the next time this Windows account logs in."
Write-Host ""
$exampleArgs = "-Port $Port"
if ($DatabaseUrl) {
    $exampleArgs += " -DatabaseUrl `"$DatabaseUrl`""
}
if ($SessionSecret) {
    $exampleArgs += " -SessionSecret `"$SessionSecret`""
}
Write-Host "To start it right now without logging out/in, run:"
Write-Host "  .\deploy\windows\run-loop.ps1 $exampleArgs"
Write-Host "(Omitted params fall back to .env at the project root — see run-loop.ps1's own comment.)"
