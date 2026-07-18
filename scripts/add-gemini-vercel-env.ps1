param(
  [string]$Model = "gemini-3.5-flash"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$vercelCmd = Join-Path $env:APPDATA "npm\vercel.cmd"

if (-not (Test-Path $vercelCmd)) {
  Write-Host "Could not find Vercel CLI at: $vercelCmd" -ForegroundColor Red
  Write-Host "Install it with: npm i -g vercel" -ForegroundColor Yellow
  exit 1
}

Set-Location $projectRoot

Write-Host "Adding Gemini environment variables to the linked Vercel project..." -ForegroundColor Cyan
Write-Host "Project folder: $projectRoot"
Write-Host ""

$secureKey = Read-Host "Paste your Gemini API key" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
  $geminiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

  if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    Write-Host "Gemini API key cannot be empty." -ForegroundColor Red
    exit 1
  }

  $targets = @("production", "preview", "development")

  foreach ($target in $targets) {
    Write-Host "Adding GEMINI_API_KEY for $target..." -ForegroundColor Cyan
    $geminiKey | & $vercelCmd env add GEMINI_API_KEY $target
  }

  foreach ($target in $targets) {
    Write-Host "Adding GEMINI_VISION_MODEL for $target..." -ForegroundColor Cyan
    $Model | & $vercelCmd env add GEMINI_VISION_MODEL $target
  }

  Write-Host ""
  Write-Host "Done. Current Vercel environment variables:" -ForegroundColor Green
  & $vercelCmd env ls
}
finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }

  if ($geminiKey) {
    Remove-Variable geminiKey -ErrorAction SilentlyContinue
  }
}
