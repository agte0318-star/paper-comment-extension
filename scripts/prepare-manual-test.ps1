$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseDir = Join-Path $root "release"
$version = (Get-Content (Join-Path $root "manifest.json") | ConvertFrom-Json).version
$zipPath = Join-Path $releaseDir "paper-comment-extension-$version.zip"
$manualTestRoot = Join-Path $releaseDir "manual-test"
$targetDir = Join-Path $manualTestRoot "paper-comment-extension-$version"

if (-not (Test-Path $zipPath)) {
  throw "Release package not found: $zipPath. Run npm.cmd run package first."
}

node (Join-Path $PSScriptRoot "check-package.js") $zipPath

if (Test-Path $targetDir) {
  Remove-Item -LiteralPath $targetDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Expand-Archive -LiteralPath $zipPath -DestinationPath $targetDir -Force

Write-Host "Prepared packaged extension for Chrome manual testing:"
Write-Host $targetDir
Write-Host "Open chrome://extensions, choose Load unpacked, then select this folder."
