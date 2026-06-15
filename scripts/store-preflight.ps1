$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Run-Step {
  param(
    [string]$Label,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "== $Label =="
  & $Command
}

Push-Location $root
try {
  Run-Step "Prepare release package and store assets" {
    npm.cmd run release:prepare
  }

  Run-Step "Capture public web screenshots" {
    npm.cmd run capture:web-screenshots
  }

  Run-Step "Capture packaged extension screenshots" {
    npm.cmd run capture:extension-screenshots
  }

  Run-Step "Capture privacy-safe signed-in demo screenshots" {
    npm.cmd run capture:demo-screenshots
  }

  Run-Step "Check public GitHub Pages URLs" {
    npm.cmd run check:public-urls
  }

  Run-Step "Check public web rendering" {
    npm.cmd run check:public-web-render
  }

  Run-Step "Check web auth and admin states" {
    npm.cmd run check:web-auth-admin-state
  }

  Run-Step "Check extension signed-out auth gates" {
    npm.cmd run check:extension-auth-gates
  }

  Run-Step "Check extension signed-in demo interactions" {
    npm.cmd run check:extension-demo-interactions
  }

  Run-Step "Check popup current-paper handling" {
    npm.cmd run check:popup-current-paper
  }

  Run-Step "Check popup account state" {
    npm.cmd run check:popup-account-state
  }

  Run-Step "Source secret scan" {
    npm.cmd run check:source-secrets
  }

  Run-Step "Release status" {
    npm.cmd run release:status
  }

  Write-Host ""
  Write-Host "Store preflight completed. If release status still shows account-flow Pending rows, run:"
  Write-Host "  npm.cmd run qa:account"
  Write-Host "  npm.cmd run finalize:account-qa"
  Write-Host "Then run:"
  Write-Host "  npm.cmd run check:release-ready"
} finally {
  Pop-Location
}
