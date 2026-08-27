<#
.SYNOPSIS
  Stops and removes the Windows Service installed by install-service.ps1.
#>

param(
    [string]$ServiceName = "ExpenseBillingApp",
    [string]$NssmPath = "nssm"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command $NssmPath -ErrorAction SilentlyContinue)) {
    throw "nssm.exe not found on PATH."
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $existing) {
    Write-Host "Service '$ServiceName' is not installed. Nothing to do."
    exit 0
}

Write-Host "Stopping '$ServiceName'..."
& $NssmPath stop $ServiceName confirm | Out-Null
Write-Host "Removing '$ServiceName'..."
& $NssmPath remove $ServiceName confirm | Out-Null
Write-Host "Done."
