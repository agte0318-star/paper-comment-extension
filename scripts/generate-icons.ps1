$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$iconDir = Join-Path $root "public\icons"
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

function New-Icon {
  param(
    [int]$Size,
    [string]$OutputPath
  )

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 0, 0, $Size, $Size),
    [System.Drawing.Color]::FromArgb(15, 118, 110),
    [System.Drawing.Color]::FromArgb(31, 64, 61),
    45
  )

  $radius = [Math]::Max(3, [int]($Size * 0.18))
  $rect = New-Object System.Drawing.Rectangle 1, 1, ($Size - 2), ($Size - 2)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath($background, $path)

  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(235, 255, 255, 255)), ([Math]::Max(1, [int]($Size * 0.07)))
  $lineY1 = [int]($Size * 0.34)
  $lineY2 = [int]($Size * 0.50)
  $lineY3 = [int]($Size * 0.66)
  $left = [int]($Size * 0.24)
  $right = [int]($Size * 0.76)
  $graphics.DrawLine($pen, $left, $lineY1, $right, $lineY1)
  $graphics.DrawLine($pen, $left, $lineY2, $right, $lineY2)
  $graphics.DrawLine($pen, $left, $lineY3, [int]($Size * 0.58), $lineY3)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-Icon -Size 16 -OutputPath (Join-Path $iconDir "icon-16.png")
New-Icon -Size 48 -OutputPath (Join-Path $iconDir "icon-48.png")
New-Icon -Size 128 -OutputPath (Join-Path $iconDir "icon-128.png")

Write-Host "Generated extension icons in $iconDir"
