$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$version = (Get-Content (Join-Path $root "manifest.json") | ConvertFrom-Json).version
$screenshotsDir = Join-Path $root "release\store-assets\$version\screenshots"
$profileRoot = Join-Path $root "release\browser-screenshot-profiles"
$webRoot = Resolve-Path (Join-Path $root "web")
$webRootUri = (New-Object System.Uri("$($webRoot.Path)\")).AbsoluteUri

$edgeCandidates = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

$edgePath = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edgePath) {
  throw "Microsoft Edge was not found. Install Edge or capture web screenshots manually."
}

New-Item -ItemType Directory -Force -Path $screenshotsDir | Out-Null
New-Item -ItemType Directory -Force -Path $profileRoot | Out-Null

$targets = @(
  @{
    Name = "09-trending-page.png"
    Url = "${webRootUri}trending.html"
    Profile = "09-trending"
  },
  @{
    Name = "10-paper-discussion-page.png"
    Url = "${webRootUri}paper.html?id=paper-1"
    Profile = "10-paper"
  },
  @{
    Name = "11-profile-page.png"
    Url = "${webRootUri}profile.html"
    Profile = "11-profile"
  }
)

foreach ($target in $targets) {
  $outputPath = Join-Path $screenshotsDir $target.Name
  $profilePath = Join-Path $profileRoot $target.Profile
  New-Item -ItemType Directory -Force -Path $profilePath | Out-Null

  $arguments = @(
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1280,800",
    "--virtual-time-budget=5000",
    "--user-data-dir=$profilePath",
    "--screenshot=$outputPath",
    $target.Url
  )

  & $edgePath @arguments
  $outputExists = Test-Path $outputPath
  $outputSize = if ($outputExists) { (Get-Item $outputPath).Length } else { 0 }
  if ($LASTEXITCODE -ne 0 -and $outputSize -lt 1024) {
    throw "Failed to capture $($target.Name)."
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Edge returned exit code $LASTEXITCODE after writing $($target.Name); continuing because the screenshot file exists."
  }
  Write-Host "Captured $($target.Name): $outputPath"
}

Write-Host "Web screenshots captured. Run npm.cmd run release:status to review remaining screenshots."
