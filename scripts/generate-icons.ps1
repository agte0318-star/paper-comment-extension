$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$iconDir = Join-Path $root "public\icons"
$sourcePath = Join-Path $iconDir "icon-source.png"
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

if (-not (Test-Path $sourcePath)) {
  throw "Missing icon source: $sourcePath"
}

function Resize-Icon {
  param(
    [int]$Size,
    [string]$OutputPath
  )

  $source = [System.Drawing.Image]::FromFile($sourcePath)
  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $graphics.DrawImage($source, 0, 0, $Size, $Size)
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $graphics.Dispose()
  $bitmap.Dispose()
  $source.Dispose()
}

Resize-Icon -Size 16 -OutputPath (Join-Path $iconDir "icon-16.png")
Resize-Icon -Size 48 -OutputPath (Join-Path $iconDir "icon-48.png")
Resize-Icon -Size 128 -OutputPath (Join-Path $iconDir "icon-128.png")

Write-Host "Generated extension icons from $sourcePath"
