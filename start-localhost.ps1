$ErrorActionPreference = "Stop"

$nodeDir = Join-Path $env:LOCALAPPDATA "Programs\nodejs-v26.13.1\node-v26.13.1-win-x64"
$npmPath = Join-Path $nodeDir "npm.cmd"
$vitePath = Join-Path $PSScriptRoot "node_modules\vite\bin\vite.js"

if (-not (Test-Path -LiteralPath $npmPath)) {
  throw "Portable Node.js was not found at '$nodeDir'. See INSTALLATION.md for setup details."
}

$env:PATH = "$nodeDir;$env:PATH"
Push-Location $PSScriptRoot

try {
  if (-not (Test-Path -LiteralPath $vitePath)) {
    & $npmPath install
    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed with exit code $LASTEXITCODE."
    }
  }

  & $npmPath run start
  $exitCode = $LASTEXITCODE
}
finally {
  Pop-Location
}

exit $exitCode
