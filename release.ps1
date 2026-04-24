$ErrorActionPreference = 'Stop'

Write-Host "==> Bumping patch version (package.json)..." -ForegroundColor Cyan
npm version patch --no-git-tag-version

$pkgContent = Get-Content package.json -Raw
$pkg = $pkgContent | ConvertFrom-Json
$newVersion = $pkg.version

Write-Host "==> Target Version: $newVersion" -ForegroundColor Green

Write-Host "==> Compiling TypeScript..." -ForegroundColor Cyan
npm run compile

Write-Host "==> Packaging VSIX with vsce..." -ForegroundColor Cyan
npx --yes vsce package

Write-Host "==> Build and package complete! Check for [visualvs-${newVersion}.vsix] in your workspace." -ForegroundColor Green
