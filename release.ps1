$ErrorActionPreference = 'Stop'

Write-Host "==> Bumping patch version (package.json)..." -ForegroundColor Cyan
npm version patch --no-git-tag-version

$pkgContent = Get-Content package.json -Raw
$pkg = $pkgContent | ConvertFrom-Json
$newVersion = $pkg.version

Write-Host "==> Target Version: $newVersion" -ForegroundColor Green

Write-Host "==> Updating version in README.md..." -ForegroundColor Cyan
$utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
$readmePath = Join-Path $PSScriptRoot "README.md"
$readme = [System.IO.File]::ReadAllText($readmePath, $utf8NoBOM)
$readme = $readme -replace '(?<=version-)\d+\.\d+\.\d+(?=-blueviolet)', $newVersion
[System.IO.File]::WriteAllText($readmePath, $readme, $utf8NoBOM)

Write-Host "==> Compiling TypeScript..." -ForegroundColor Cyan
npm run compile

Write-Host "==> Packaging VSIX with vsce..." -ForegroundColor Cyan
npx --yes vsce package

Write-Host "==> Build and package complete! Check for [visualvs-${newVersion}.vsix] in your workspace." -ForegroundColor Green
