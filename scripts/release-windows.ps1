param(
  [string]$Version
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not $env:GH_TOKEN -and (Test-Path ".env")) {
  $tokenLine = Get-Content ".env" | Where-Object { $_ -match "^GH_TOKEN=" } | Select-Object -First 1
  if ($tokenLine) {
    $env:GH_TOKEN = ($tokenLine -split "=", 2)[1].Trim()
  }
}

if (-not $env:GH_TOKEN) {
  throw "GH_TOKEN is not set. Add it to .env or set it in your shell."
}

$currentVersion = (node -p "require('./package.json').version").Trim()
$newVersion = if ($Version) { $Version } else { $currentVersion }

if ($newVersion -notmatch "^\d+\.\d+\.\d+$") {
  throw "Version must be X.Y.Z (got '$newVersion')."
}

Write-Host "==> Version: $newVersion"

if ($newVersion -ne $currentVersion) {
  node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json','utf8')); pkg.version = '$newVersion'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');"
  Write-Host "==> Bumped package.json: $currentVersion -> $newVersion"
}

$tag = "v$newVersion"
git rev-parse $tag *> $null
if ($LASTEXITCODE -eq 0) {
  throw "Tag $tag already exists. Bump the version first."
}

Write-Host "==> Building Next.js + Electron Windows package..."
npm run electron:prepare
npx electron-builder --win --publish always

Write-Host "==> Committing and tagging $tag..."
git add package.json
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -m "chore: bump version to $newVersion"
} else {
  Write-Host "(nothing to commit -- version already at $newVersion)"
}

git tag $tag
git push origin HEAD
git push origin $tag

Write-Host ""
Write-Host "Done: released $tag"
Write-Host "Check: https://github.com/jaden0747/online-shop/releases"
