<#
.SYNOPSIS
  One-command redeploy of an already-installed ExpenseBillingApp Windows
  Service after a code change: back up the DB, stop the service, rebuild,
  restage the standalone bundle, start it again, and health-check.

.DESCRIPTION
  Use this for the routine case — you have extracted a fresh
  `git archive` zip over C:\Apps\expense-billing-app-deploy and only
  application code changed. It reuses the service's EXISTING environment
  (DATABASE_URL, SESSION_SECRET, PORT), so nobody is logged out and no
  secrets are retyped.

  It does NOT (re)install the service or change its environment. Run
  install-service.ps1 instead when:
    - installing the service for the first time, or
    - DATABASE_URL / SESSION_SECRET / PORT must change.

  Steps (0-7):
    0  pg_dump backup           (backup-postgres.ps1; skip with -SkipBackup)
    1  nssm stop
    2  npm ci                   (only if package-lock.json changed; see -ForceInstall / -SkipInstall)
    3  npx prisma migrate deploy
    4  npx prisma generate      (always — cheap, avoids a stale client)
    5  npm run build
    6  stage-standalone.ps1
    7  nssm start + HTTP health check

  If step 3 reports that it applied migrations, the database schema
  changed — the step-0 backup is the safety net; verify the app and data
  carefully afterwards.

  Rollback if a redeploy goes bad: the database is untouched unless step 3
  applied migrations, so restore the previous code folder, re-run this
  script (or install-service.ps1), and — only if migrations ran — restore
  the step-0 .sql dump.

.PARAMETER ServiceName
  NSSM service to redeploy. Default: ExpenseBillingApp.

.PARAMETER SkipBackup
  Skip the pg_dump backup step. Not recommended.

.PARAMETER SkipInstall
  Force-skip `npm ci` even if package-lock.json changed.

.PARAMETER ForceInstall
  Force-run `npm ci` even if dependencies look unchanged.

.PARAMETER NssmPath
  Path to nssm.exe. Default: "nssm" (expects it on PATH).

.EXAMPLE
  # From anywhere — the script locates the project root itself:
  C:\Apps\expense-billing-app-deploy\deploy\windows\update.ps1

.EXAMPLE
  # Quiet, quick redeploy (own risk): no backup, no dependency reinstall
  .\deploy\windows\update.ps1 -SkipBackup -SkipInstall
#>

param(
    [string]$ServiceName = "ExpenseBillingApp",
    [switch]$SkipBackup,
    [switch]$SkipInstall,
    [switch]$ForceInstall,
    [string]$NssmPath = "nssm"
)

$ErrorActionPreference = "Stop"

# This script lives in deploy\windows\ — the project root (package.json,
# .next\, etc.) is TWO levels up.
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Require-Command($name, $hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "$name not found on PATH. $hint"
    }
}

Require-Command $NssmPath "Download from https://nssm.cc/download (or 'choco install nssm -y')."
Require-Command "node" "Install Node.js."
Require-Command "npm"  "Install Node.js (npm ships with it)."

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
    throw "Service '$ServiceName' is not installed. Run deploy\windows\install-service.ps1 first — update.ps1 only redeploys an existing service."
}

# --- read the service's current environment (single source of truth so
#     the password / SESSION_SECRET never has to be retyped here) ---
$envRaw = & $NssmPath get $ServiceName AppEnvironmentExtra 2>$null
$envText = ($envRaw -join "`n") -replace "`r", ""
$dbUrl = ($envText -split "`n" | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', ''
$port  = ($envText -split "`n" | Where-Object { $_ -match '^PORT=' })         -replace '^PORT=', ''
if (-not $port)  { $port = "3000" }
if (-not $dbUrl) {
    throw "Could not read DATABASE_URL from service '$ServiceName' (nssm get $ServiceName AppEnvironmentExtra). Reinstall with install-service.ps1."
}

Write-Host "==> Redeploying '$ServiceName' on port $port" -ForegroundColor Cyan

Push-Location $root
try {
    # 0. DB backup ---------------------------------------------------------
    if ($SkipBackup) {
        Write-Host "==> [0/7] DB backup SKIPPED (-SkipBackup)" -ForegroundColor Yellow
    } else {
        Write-Host "==> [0/7] Backing up database..."
        & (Join-Path $PSScriptRoot "backup-postgres.ps1") -DatabaseUrl $dbUrl
    }

    # 1. stop ------------------------------------------------------------
    Write-Host "==> [1/7] Stopping service..."
    & $NssmPath stop $ServiceName confirm 2>&1 | Out-Null

    # 2. npm ci (only when dependencies actually changed) ---------------
    $nm     = Join-Path $root "node_modules"
    $lock   = Join-Path $root "package-lock.json"
    $marker = Join-Path $nm ".deploy-lock-hash"
    $needInstall = $false
    if ($ForceInstall) {
        $needInstall = $true
    } elseif ($SkipInstall) {
        $needInstall = $false
    } elseif (-not (Test-Path $nm)) {
        $needInstall = $true
    } elseif (Test-Path $lock) {
        # Compare CONTENT hash, not mtime: a fresh zip extract rewrites
        # package-lock.json's timestamp even when its bytes are identical.
        $lockHash = (Get-FileHash $lock -Algorithm SHA256).Hash
        $prevHash = if (Test-Path $marker) { (Get-Content $marker -Raw).Trim() } else { "" }
        if ($lockHash -ne $prevHash) { $needInstall = $true }
    }
    if ($needInstall) {
        Write-Host "==> [2/7] npm ci ..."
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed (exit $LASTEXITCODE)" }
        if (Test-Path $lock) {
            Set-Content -Path $marker -Value (Get-FileHash $lock -Algorithm SHA256).Hash -Encoding ASCII
        }
    } else {
        Write-Host "==> [2/7] npm ci SKIPPED (dependencies unchanged; -ForceInstall to override)"
    }

    # 3. migrations ----------------------------------------------------
    Write-Host "==> [3/7] npx prisma migrate deploy ..."
    $migOut = & npx prisma migrate deploy 2>&1
    $migOut | ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed (exit $LASTEXITCODE)" }
    if ($migOut -match "have been applied|following migration") {
        Write-Host "!!! Database migrations were applied — schema changed. Verify data against the step-0 backup." -ForegroundColor Yellow
    }

    # 4. regenerate client (cheap; guards against a stale generated client)
    Write-Host "==> [4/7] npx prisma generate ..."
    & npx prisma generate | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "prisma generate failed (exit $LASTEXITCODE)" }

    # 5. build -------------------------------------------------------
    Write-Host "==> [5/7] npm run build ..."
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit $LASTEXITCODE)" }

    # 6. stage standalone -----------------------------------------------
    Write-Host "==> [6/7] stage-standalone.ps1 ..."
    & (Join-Path $PSScriptRoot "stage-standalone.ps1")

    # 7. start --------------------------------------------------------
    Write-Host "==> [7/7] Starting service..."
    & $NssmPath start $ServiceName 2>&1 | Out-Null
}
finally {
    Pop-Location
}

# --- health check --------------------------------------------------------
Start-Sleep -Seconds 2
Write-Host ""
Write-Host ("Service status: " + (& $NssmPath status $ServiceName))

$url = "http://localhost:$port/login"
$ok = $false
foreach ($i in 1..15) {
    try {
        if ((Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) {
            $ok = $true; break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
if ($ok) {
    Write-Host "OK  $url returned 200 — redeploy complete." -ForegroundColor Green
    Write-Host "    Now spot-check https://psaidemo.icn21.local in a browser."
} else {
    Write-Host "WARNING  $url did not return 200 within ~30s." -ForegroundColor Red
    $errLog = Join-Path $root "logs\service-err.log"
    if (Test-Path $errLog) {
        Write-Host "--- last 20 lines of service-err.log ---"
        Get-Content $errLog -Tail 20 | ForEach-Object { Write-Host "  $_" }
    }
    throw "Health check failed — investigate before considering this deploy done."
}
