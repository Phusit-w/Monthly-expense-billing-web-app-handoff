<#
.SYNOPSIS
  Runs the app forever, restarting it if it crashes — no admin rights or
  Windows Service required. Pair with install-startup-shortcut.ps1 so this
  launches automatically whenever this Windows account logs in.

.PARAMETER DatabaseUrl
  Postgres connection string. If omitted, read from DATABASE_URL in a
  `.env` file at the project root.

.PARAMETER AuthUsername
  Shared HTTP Basic Auth username (proxy.ts) — this app has no per-user
  login, so one username/password pair gates the whole site. If omitted,
  read from AUTH_USERNAME in the same `.env` file as DatabaseUrl. Required
  one way or the other: proxy.ts refuses every request in production
  (NODE_ENV=production, which this script always sets) if these aren't
  set, rather than silently running without auth.

.PARAMETER AuthPassword
  Shared HTTP Basic Auth password (proxy.ts). Same fallback as
  AuthUsername — read from AUTH_PASSWORD in `.env` if omitted.

.EXAMPLE
  # Run from the project root:
  .\deploy\windows\run-loop.ps1 -DatabaseUrl "postgresql://expense_billing:secret@localhost:5432/expense_billing" -AuthUsername "office" -AuthPassword "a-real-password"
#>

param(
    [string]$DatabaseUrl,
    [string]$AuthUsername,
    [string]$AuthPassword,
    [int]$Port = 3000,
    [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = "Stop"
# This script lives in deploy\windows\ — the project root (where
# .next\standalone, logs\, and .env actually are) is TWO levels up.
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$standalone = Join-Path $root ".next\standalone"
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "run-loop.log"
$pidFile = Join-Path $logDir "run-loop.pid"

if (-not (Test-Path (Join-Path $standalone "server.js"))) {
    throw "server.js not found under .next\standalone. Run 'npm run build' then 'deploy\windows\stage-standalone.ps1' first."
}

# Shared helper: read one KEY=value line out of the project-root .env,
# used as a fallback for any of the three params below that weren't
# passed explicitly.
function Read-EnvValue([string]$key) {
    $envFile = Join-Path $root ".env"
    if (-not (Test-Path $envFile)) { return $null }
    $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line -split "=", 2)[1].Trim().Trim('"')
}

if (-not $DatabaseUrl) { $DatabaseUrl = Read-EnvValue "DATABASE_URL" }
if (-not $DatabaseUrl) {
    throw "DATABASE_URL not provided and not found in .env. Pass -DatabaseUrl explicitly."
}

if (-not $AuthUsername) { $AuthUsername = Read-EnvValue "AUTH_USERNAME" }
if (-not $AuthPassword) { $AuthPassword = Read-EnvValue "AUTH_PASSWORD" }
if (-not $AuthUsername -or -not $AuthPassword) {
    throw "AUTH_USERNAME / AUTH_PASSWORD not provided and not found in .env. Pass -AuthUsername/-AuthPassword explicitly, or the app will refuse every request once running (see proxy.ts)."
}

function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

# Own PID goes in first so stop-run-loop.ps1 can kill the loop itself even
# between restarts (when there's momentarily no node child to also list).
"$PID" | Set-Content $pidFile

Log "run-loop starting (loop PID $PID). Port=$Port"

while ($true) {
    $env:PORT = "$Port"
    $env:HOSTNAME = "0.0.0.0"
    $env:NODE_ENV = "production"
    $env:DATABASE_URL = $DatabaseUrl
    $env:AUTH_USERNAME = $AuthUsername
    $env:AUTH_PASSWORD = $AuthPassword

    $proc = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $standalone `
        -RedirectStandardOutput (Join-Path $logDir "server-out.log") `
        -RedirectStandardError (Join-Path $logDir "server-err.log") `
        -NoNewWindow -PassThru

    "$PID`n$($proc.Id)" | Set-Content $pidFile
    Log "node server.js started (PID $($proc.Id))"

    Wait-Process -Id $proc.Id -ErrorAction SilentlyContinue

    "$PID" | Set-Content $pidFile
    Log "node server.js (PID $($proc.Id)) exited. Restarting in ${RestartDelaySeconds}s..."
    Start-Sleep -Seconds $RestartDelaySeconds
}
