param(
    [switch]$IncludeData,
    [switch]$FullContext,
    [switch]$ChangedOnly
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host "[1/3] Validating context generator..."
python .\Scripts\generate_context.py --dry-run | Out-Null

if ($FullContext) {
    Write-Host "[2/3] Generating full AI contexts..."
    python .\Scripts\generate_context.py --mode full
} else {
    Write-Host "[2/3] Generating compact AI contexts..."
    if ($ChangedOnly) {
        python .\Scripts\generate_context.py --mode compact --changed-only --output-suffix _COMPACT
    } else {
        python .\Scripts\generate_context.py --mode compact --output-suffix _COMPACT
    }
}

Write-Host "[3/3] Building shadow repo..."
if ($IncludeData) {
    powershell -ExecutionPolicy Bypass -File .\Scripts\build_shadow_repo.ps1 -IncludeData
} else {
    powershell -ExecutionPolicy Bypass -File .\Scripts\build_shadow_repo.ps1
}

Write-Host "Done: EOD optimization workflow completed."
