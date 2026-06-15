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
  Run-Step "Project checks" {
    npm.cmd run check
  }

  Run-Step "Source secret scan" {
    npm.cmd run check:source-secrets
  }

  Run-Step "Google OAuth setup diagnostics" {
    npm.cmd run check:google-oauth-setup
  }

  Run-Step "Account QA finalizer self-check" {
    npm.cmd run check:account-qa-finalizer
  }

  Run-Step "Build release package" {
    npm.cmd run package
  }

  Run-Step "Validate release package" {
    npm.cmd run check:package
  }

  Run-Step "Prepare packaged extension for Chrome manual testing" {
    npm.cmd run prepare:manual-test
  }

  Run-Step "Prepare Chrome Web Store assets folder" {
    npm.cmd run prepare:store-assets
  }

  Run-Step "Release status" {
    npm.cmd run release:status
  }
} finally {
  Pop-Location
}
