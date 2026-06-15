$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Read-RequiredText {
  param(
    [string]$Prompt
  )

  while ($true) {
    $value = (Read-Host $Prompt).Trim()
    if ($value) {
      return $value
    }
    Write-Host "This value is required."
  }
}

function Read-OptionalText {
  param(
    [string]$Prompt
  )

  return (Read-Host $Prompt).Trim()
}

function Convert-SecureStringToPlainText {
  param(
    [System.Security.SecureString]$SecureString
  )

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Read-RequiredSecret {
  param(
    [string]$Prompt
  )

  while ($true) {
    $secure = Read-Host $Prompt -AsSecureString
    $plain = Convert-SecureStringToPlainText $secure
    if ($plain) {
      return $plain
    }
    Write-Host "This password is required."
  }
}

function Read-YesNo {
  param(
    [string]$Prompt,
    [bool]$Default = $false
  )

  $suffix = if ($Default) { "[Y/n]" } else { "[y/N]" }
  $answer = (Read-Host "$Prompt $suffix").Trim().ToLowerInvariant()
  if (-not $answer) {
    return $Default
  }
  return $answer -eq "y" -or $answer -eq "yes"
}

function Clear-PceAccountEnv {
  $names = @(
    "PCE_TEST_EMAIL",
    "PCE_TEST_PASSWORD",
    "PCE_TEST_NEW_EMAIL",
    "PCE_TEST_NEW_PASSWORD",
    "PCE_TEST_ADMIN_EMAIL",
    "PCE_TEST_ADMIN_PASSWORD",
    "PCE_EXTENSION_ID"
  )

  foreach ($name in $names) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
}

function Invoke-NpmScript {
  param(
    [string]$ScriptName
  )

  npm.cmd run $ScriptName
  if ($LASTEXITCODE -ne 0) {
    throw "npm.cmd run $ScriptName failed with exit code $LASTEXITCODE."
  }
}

Push-Location $root
try {
  Write-Host "Paper Comment Extension final account QA"
  Write-Host "Passwords are read securely, used only as temporary environment variables for this process, and cleared at the end."
  Write-Host ""

  $readerEmail = Read-RequiredText "Reader test email"
  $readerPassword = Read-RequiredSecret "Reader test password"
  $env:PCE_TEST_EMAIL = $readerEmail
  $env:PCE_TEST_PASSWORD = $readerPassword

  if (Read-YesNo "Run the fresh email/password signup check?") {
    $newEmail = Read-RequiredText "Fresh signup email"
    $newPassword = Read-RequiredSecret "Fresh signup password (8+ characters)"
    $env:PCE_TEST_NEW_EMAIL = $newEmail
    $env:PCE_TEST_NEW_PASSWORD = $newPassword
  }

  if (Read-YesNo "Run the optional active-admin account check?") {
    $adminEmail = Read-RequiredText "Admin test email"
    $adminPassword = Read-RequiredSecret "Admin test password"
    $env:PCE_TEST_ADMIN_EMAIL = $adminEmail
    $env:PCE_TEST_ADMIN_PASSWORD = $adminPassword
  }

  $extensionId = Read-OptionalText "Chrome extension ID for exact OAuth redirect URL (press Enter to skip)"
  if ($extensionId) {
    $env:PCE_EXTENSION_ID = $extensionId
  }

  Write-Host ""
  Write-Host "== Google OAuth setup diagnostics =="
  Invoke-NpmScript "check:google-oauth-setup"

  Write-Host ""
  Write-Host "== Live account flow check =="
  Invoke-NpmScript "check:live-account-flow"

  Write-Host ""
  Write-Host "Account QA helper finished. Use the Manual QA row guidance above, then run:"
  Write-Host "  npm.cmd run finalize:account-qa"
  Write-Host "  npm.cmd run release:status"
  Write-Host "  npm.cmd run check:release-ready"
  Write-Host "Only answer yes in finalize:account-qa for checks you truly completed in this run or verified manually."
} finally {
  Clear-PceAccountEnv
  Pop-Location
  Write-Host "Temporary account QA environment variables cleared."
}
