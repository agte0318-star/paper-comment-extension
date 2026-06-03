$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseDir = Join-Path $root "release"
$version = (Get-Content (Join-Path $root "manifest.json") | ConvertFrom-Json).version
$zipPath = Join-Path $releaseDir "paper-comment-extension-$version.zip"
$stagingDir = Join-Path $releaseDir "staging"

if (Test-Path $stagingDir) {
  Remove-Item -LiteralPath $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

$include = @(
  "manifest.json",
  "src",
  "public"
)

foreach ($item in $include) {
  $source = Join-Path $root $item
  $target = Join-Path $stagingDir $item
  if (Test-Path $source -PathType Container) {
    Copy-Item -LiteralPath $source -Destination $target -Recurse
  } else {
    Copy-Item -LiteralPath $source -Destination $target
  }
}

$iconSourceInPackage = Join-Path $stagingDir "public\icons\icon-source.png"
if (Test-Path $iconSourceInPackage) {
  Remove-Item -LiteralPath $iconSourceInPackage -Force
}

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

$stagingItems = Get-ChildItem -LiteralPath $stagingDir
Compress-Archive -Path $stagingItems.FullName -DestinationPath $zipPath -Force
Remove-Item -LiteralPath $stagingDir -Recurse -Force

Write-Host "Created release package: $zipPath"
