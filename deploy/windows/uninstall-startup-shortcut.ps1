<#
.SYNOPSIS
  Removes the auto-start shortcut created by install-startup-shortcut.ps1.
  Does not stop an already-running instance — use stop-run-loop.ps1 for that.
#>

$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "ExpenseBillingApp.lnk"

if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
    Write-Host "Removed $shortcutPath"
} else {
    Write-Host "No shortcut found at $shortcutPath — nothing to do."
}

Write-Host "If run-loop.ps1 is currently running, stop it separately with .\deploy\windows\stop-run-loop.ps1 (run from the project root)"
