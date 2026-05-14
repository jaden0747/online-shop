$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoUrl = "https://github.com/jaden0747/online-shop.git"
$baseDir = (Get-Location).Path
$appDir = Join-Path $baseDir "shop-organizer"

function Test-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "==> Shop Organizer bootstrap (Windows)"

if (-not (Test-Command "winget")) {
  throw "winget is required on Windows. Install App Installer from Microsoft Store, then rerun this script."
}

if (-not (Test-Command "git")) {
  Write-Host "==> Installing Git..."
  winget install --id Git.Git --exact --accept-source-agreements --accept-package-agreements
} else {
  Write-Host "==> Git already installed"
}

if (-not (Test-Command "node")) {
  Write-Host "==> Installing Node.js LTS..."
  winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
}

if (-not (Test-Command "node")) {
  throw "Node.js is not in PATH yet. Restart PowerShell, then rerun this script."
}

Write-Host "==> Node $(node --version) / npm $(npm --version)"

if (Test-Path $appDir) {
  Write-Host "==> $appDir already exists, pulling latest..."
  git -C $appDir pull
} else {
  Write-Host "==> Cloning repo..."
  git clone $repoUrl $appDir
}

Set-Location $appDir

Write-Host "==> Installing npm dependencies..."
npm install

if (-not (Test-Path "data")) {
  New-Item -ItemType Directory -Path "data" | Out-Null
}

$xlsxFiles = Get-ChildItem -Path "data" -Filter "*.xlsx" -ErrorAction SilentlyContinue
if (-not $xlsxFiles) {
  Write-Host ""
  Write-Host "  WARNING: No data files found in $appDir\data\"
  Write-Host "  Copy your Excel files from your old machine."
  Write-Host ""
  Write-Host "  Required files:"
  Write-Host "    customers.xlsx  addresses.xlsx  subscriptions.xlsx"
  Write-Host "    menu.xlsx       selections.xlsx  notes.xlsx"
  Write-Host "    pricing.xlsx    orders.xlsx"
  Write-Host ""
}

Write-Host "==> Building app..."
npm run build

Write-Host ""
Write-Host "==> Starting app..."
Write-Host "    Open http://localhost:3000 in your browser (Ctrl+C to stop)"
Write-Host ""
npm start
