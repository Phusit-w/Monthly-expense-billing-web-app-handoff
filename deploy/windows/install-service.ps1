<#
.SYNOPSIS
  Installs (or reinstalls) the app as a Windows Service using NSSM.

.DESCRIPTION
  Requires nssm.exe on PATH (https://nssm.cc/download, or `choco install nssm`).
  Run `npm run build` and then `stage-standalone.ps1` before this.

  Safe to re-run after a rebuild: stops and removes any existing service
  with the same name, then reinstalls and starts it fresh.

.PARAMETER DatabaseUrl
  Full Postgres connection string for the production database, e.g.
  postgresql://expense_billing:REAL_PASSWORD@localhost:5432/expense_billing

.PARAMETER AuthUsername
  Shared HTTP Basic Auth username (proxy.ts) — this app has no per-user
  login, so one username/password pair gates the whole site. Put a reverse
  proxy with HTTPS in front of this service too (e.g. IIS with a
  certificate) — Basic Auth is unencrypted on its own.

.PARAMETER AuthPassword
  Shared HTTP Basic Auth password (proxy.ts).

.EXAMPLE
  # Run from the project root:
  .\deploy\windows\install-service.ps1 -DatabaseUrl "postgresql://expense_billing:secret@localhost:5432/expense_billing" -AuthUsername "office" -AuthPassword "a-real-password"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$AuthUsername,

    [Parameter(Mandatory = $true)]
    [string]$AuthPassword,

    [string]$ServiceName = "ExpenseBillingApp",
    [int]$Port = 3000,
    [string]$NssmPath = "nssm"
)

$ErrorActionPreference = "Stop"
# This script lives in deploy\windows\ — the project root (where
# .next\standalone and logs\ actually are) is TWO levels up.
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$standalone = Join-Path $root ".next\standalone"
$logDir = Join-Path $root "logs"

if (-not (Test-Path (Join-Path $standalone "server.js"))) {
    throw "`.next/standalone/server.js` not found. Run 'npm run build' then 'deploy\windows\stage-standalone.ps1' first."
}

if (-not (Get-Command $NssmPath -ErrorAction SilentlyContinue)) {
    throw "nssm.exe not found on PATH. Download it from https://nssm.cc/download (or 'choco install nssm -y'), then re-run this script."
}

$nodeExe = (Get-Command node -ErrorAction Stop).Source

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Service '$ServiceName' already exists — stopping and removing it before reinstalling..."
    & $NssmPath stop $ServiceName confirm | Out-Null
    & $NssmPath remove $ServiceName confirm | Out-Null
}

Write-Host "Installing service '$ServiceName'..."
& $NssmPath install $ServiceName $nodeExe "server.js"
& $NssmPath set $ServiceName AppDirectory $standalone
& $NssmPath set $ServiceName DisplayName "Expense Billing App"
& $NssmPath set $ServiceName Description "ระบบบิลค่าใช้จ่ายรายเดือน (Next.js) — Windows Service via NSSM"
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName AppStdout (Join-Path $logDir "service-out.log")
& $NssmPath set $ServiceName AppStderr (Join-Path $logDir "service-err.log")
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateBytes 10485760

$envBlock = "PORT=$Port`nHOSTNAME=0.0.0.0`nNODE_ENV=production`nDATABASE_URL=$DatabaseUrl`nAUTH_USERNAME=$AuthUsername`nAUTH_PASSWORD=$AuthPassword"
& $NssmPath set $ServiceName AppEnvironmentExtra $envBlock

Write-Host "Starting service..."
& $NssmPath start $ServiceName

Start-Sleep -Seconds 2
Write-Host ""
Write-Host "Status:"
& $NssmPath status $ServiceName
Write-Host ""
Write-Host "App should be reachable at http://<this-machine>:$Port"
Write-Host "Logs: $logDir\service-out.log / service-err.log"
