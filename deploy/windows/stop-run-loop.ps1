<#
.SYNOPSIS
  Stops a run-loop.ps1 instance started on this machine (kills both the
  loop's own PowerShell process and the current node.exe child, if any).
#>

$ErrorActionPreference = "Stop"
# This script lives in deploy\windows\ — the project root (where logs\
# actually is) is TWO levels up.
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pidFile = Join-Path $root "logs\run-loop.pid"

if (-not (Test-Path $pidFile)) {
    Write-Host "No PID file at $pidFile — is run-loop.ps1 running?"
    exit 0
}

$ids = Get-Content $pidFile | Where-Object { $_ -match '^\d+$' }
foreach ($processId in $ids) {
    $p = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($p) {
        Write-Host "Stopping PID $processId ($($p.ProcessName))"
        Stop-Process -Id $processId -Force
    }
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Done."
