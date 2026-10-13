param([switch]$UnsignedPreview)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if (-not $IsWindows -and $env:OS -ne 'Windows_NT') { throw 'Run this script on Windows.' }
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$version = (Get-Content 'apps/desktop/package.json' -Raw | ConvertFrom-Json).version
$sourceCommit = $env:HAIRED_SOURCE_COMMIT
if (-not $sourceCommit) {
    $sourceCommit = & git rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot identify the release source commit.' }
}
$output = Join-Path $root "artifacts/release-$version/windows"
$env:NODE_ENV = 'production'
$env:VITE_RELEASE_OWNER = 'rsm23'
$env:VITE_RELEASE_REPO = 'haired'
$env:VITE_PUBLIC_APP_URL = 'https://haired.seifelmoulouk.com/'
$env:VITE_SUPPORT_EMAIL = 'rahmani@seifelmoulouk.com'

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE" }
}

if ($UnsignedPreview) {
    $config = 'electron-builder.windows-preview.yml'
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    $signing = 'unsigned-preview'
} else {
    $config = 'electron-builder.yml'
    foreach ($name in @('AZURE_TRUSTED_SIGNING_ENDPOINT', 'AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE', 'AZURE_TRUSTED_SIGNING_ACCOUNT', 'WINDOWS_PUBLISHER_NAME')) {
        if (-not [Environment]::GetEnvironmentVariable($name)) { throw "Windows signing configuration is missing: $name. Use -UnsignedPreview only when explicitly authorized." }
    }
    $signing = 'azure-trusted-signing'
}

Invoke-Checked 'pnpm.cmd' @('check')
Invoke-Checked 'pnpm.cmd' @('--filter', '@haired/desktop', 'exec', 'electron-builder', '--config', $config, '--win', 'nsis', '--x64', '--publish', 'never', "--config.directories.output=$output")
$installer = Join-Path $output "Haired-$version-win-x64.exe"
$app = Join-Path $output 'win-unpacked/Haired.exe'
$installerSignature = Get-AuthenticodeSignature $installer
$appSignature = Get-AuthenticodeSignature $app
if ($UnsignedPreview) {
    if ($installerSignature.Status -ne 'NotSigned' -or $appSignature.Status -ne 'NotSigned') { throw 'Unexpected signature state for unsigned preview.' }
} else {
    if ($installerSignature.Status -ne 'Valid' -or $appSignature.Status -ne 'Valid') { throw 'Windows Authenticode validation failed.' }
    if ($installerSignature.SignerCertificate.Subject -notlike "*CN=$($env:WINDOWS_PUBLISHER_NAME)*") { throw 'Unexpected installer signing identity.' }
}

Invoke-Checked 'node.exe' @('scripts/verify-windows.cjs', $output)
foreach ($file in Get-ChildItem 'apps/desktop/browser-extension' -File) {
    $bundled = Join-Path $output "win-unpacked/resources/browser-extension/$($file.Name)"
    if ((Get-FileHash $file.FullName).Hash -ne (Get-FileHash $bundled).Hash) { throw "Bundled extension differs: $($file.Name)" }
}
$report = [ordered]@{
    version = $version
    platform = 'win32'
    architecture = 'x64'
    sourceCommit = $sourceCommit
    signing = $signing
    installerSignature = [string]$installerSignature.Status
    appSignature = [string]$appSignature.Status
    bundledExtension = 'verified'
    packagedSourceMaps = 0
    secretPatternScan = 'passed'
    automatedChecks = 'pnpm check passed'
    nativeMatrixRepeated = $false
    verifiedAt = [DateTime]::UtcNow.ToString('o')
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $output 'windows-verification.json'), ($report | ConvertTo-Json -Depth 5) + "`n", $utf8)
$assets = @(Get-ChildItem $output -File | Where-Object { $_.Name -match '\.(exe|exe\.blockmap)$' -or $_.Name -in @('latest.yml', 'windows-verification.json') } | Sort-Object Name)
$checksums = $assets | ForEach-Object { (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower() + '  ' + $_.Name }
[IO.File]::WriteAllText((Join-Path $output 'SHA256SUMS-windows-x64.txt'), ($checksums -join "`n") + "`n", $utf8)
Write-Output "Verified Windows $signing assets: $output"
