<#
.SYNOPSIS
  Dumps the production Postgres database to a timestamped .sql file and
  deletes backups older than -RetentionDays. For the native-Windows-Service
  deploy path (deploy\windows\install-service.ps1) — docker-compose's own
  deploy path already has this automated via the `backup` service (see
  backup.sh at the project root).

.DESCRIPTION
  Requires pg_dump.exe on PATH (installed alongside PostgreSQL itself —
  same requirement as running `psql`/`prisma migrate deploy` by hand).
  Performs one backup per invocation; run it on a schedule via Windows
  Task Scheduler (see the registration example below), it does not loop
  or daemonize itself.

.PARAMETER DatabaseUrl
  Full Postgres connection string — same value used for
  install-service.ps1's -DatabaseUrl, e.g.
  postgresql://expense_billing:REAL_PASSWORD@localhost:5432/expense_billing

.PARAMETER BackupDir
  Folder to write timestamped .sql backups into. Created if missing.
  Defaults to a `backups` folder at the project root (matching where
  docker-compose's own `backup` service puts its dumps, and where
  `.gitignore`'s `/backups` rule expects them to be).

.PARAMETER RetentionDays
  Backups older than this many days are deleted after each successful run.

.EXAMPLE
  # Run from the project root:
  .\deploy\windows\backup-postgres.ps1 -DatabaseUrl "postgresql://expense_billing:secret@localhost:5432/expense_billing"

.EXAMPLE
  # One-time setup: register this script to run daily at 02:00 via Task Scheduler.
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\path\to\expense-billing-app\deploy\windows\backup-postgres.ps1" -DatabaseUrl "postgresql://expense_billing:secret@localhost:5432/expense_billing"'
  $trigger = New-ScheduledTaskTrigger -Daily -At 2am
  Register-ScheduledTask -TaskName "ExpenseBillingAppBackup" -Action $action -Trigger $trigger -Description "Daily pg_dump backup of the expense-billing-app database" -RunLevel Highest
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,

    # This script lives in deploy\windows\ — the project root is TWO levels up.
    [string]$BackupDir = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "backups"),
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    throw "pg_dump.exe not found on PATH. Install it alongside PostgreSQL (or just the PostgreSQL client tools), then re-run this script."
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $BackupDir "backup-$timestamp.sql"

Write-Host "Dumping database to $dest..."
# pg_dump accepts a full connection URI directly as its one positional
# argument (supported since Postgres 9.2) — no need to split DatabaseUrl
# into separate -h/-U/-d flags.
& pg_dump $DatabaseUrl --file $dest
if ($LASTEXITCODE -ne 0) {
    Remove-Item -Path $dest -ErrorAction SilentlyContinue
    throw "pg_dump failed with exit code $LASTEXITCODE"
}
$sizeKB = [math]::Round((Get-Item $dest).Length / 1KB, 1)
Write-Host "Backup complete: $dest ($sizeKB KB)"

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "backup-*.sql" |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
        Write-Host "Removing old backup: $($_.Name)"
        Remove-Item -Path $_.FullName -Force
    }
