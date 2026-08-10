<#
.SYNOPSIS
  Assembles a runnable copy of the Next.js standalone build.

.DESCRIPTION
  `next build` (with `output: "standalone"` in next.config.ts) produces
  .next/standalone/server.js, but Next does NOT copy the static assets or
  public/ folder into it automatically (same requirement as the Docker
  build's COPY steps in the Dockerfile). This script does that copy so
  `.next/standalone` is a self-contained folder you can point a service at.

  Run this after every `npm run build`, before (re)installing/restarting
  the Windows service.
#>

$ErrorActionPreference = "Stop"
# This script lives in deploy\windows\ — the project root (where .next,
# public, etc. actually are) is TWO levels up.
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$standalone = Join-Path $root ".next\standalone"

if (-not (Test-Path (Join-Path $standalone "server.js"))) {
    throw "`.next/standalone/server.js` not found. Run 'npm run build' first."
}

function Copy-Dir($src, $dst) {
    Write-Host "Copying $src -> $dst"
    robocopy $src $dst /E /NFL /NDL /NJH /NJS /NP | Out-Null
    # robocopy exit codes 0-7 are success (files copied/skipped); 8+ is failure.
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed copying $src -> $dst (exit code $LASTEXITCODE)"
    }
}

Copy-Dir (Join-Path $root ".next\static") (Join-Path $standalone ".next\static")
Copy-Dir (Join-Path $root "public") (Join-Path $standalone "public")

Write-Host "Done. $standalone is ready to run: node server.js"
