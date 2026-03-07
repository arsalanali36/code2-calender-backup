param(
    [string]$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$ShadowRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "_shadow_repo"),
    [switch]$IncludeData
)

$ErrorActionPreference = "Stop"

$includeFiles = @(
    "app.py",
    "data_processors.py",
    "requirements.txt",
    "README.md",
    ".gitignore"
)

$includeDirs = @(
    "templates",
    "static\\js",
    "static\\css",
    "Scripts",
    "Docs\\AI_Contexts"
)

if ($IncludeData) {
    $includeFiles += "data\\trades.json"
}

if (Test-Path $ShadowRoot) {
    Remove-Item $ShadowRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $ShadowRoot | Out-Null

foreach ($file in $includeFiles) {
    $src = Join-Path $SourceRoot $file
    if (-not (Test-Path $src)) { continue }

    $dst = Join-Path $ShadowRoot $file
    $dstDir = Split-Path $dst -Parent
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
    }
    Copy-Item $src $dst -Force
}

foreach ($dir in $includeDirs) {
    $srcDir = Join-Path $SourceRoot $dir
    if (-not (Test-Path $srcDir)) { continue }

    $dstDir = Join-Path $ShadowRoot $dir
    New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
    Copy-Item (Join-Path $srcDir "*") $dstDir -Recurse -Force
}

Write-Host "Shadow repo ready at: $ShadowRoot"
Write-Host "Included dirs: $($includeDirs -join ', ')"
Write-Host "Included files: $($includeFiles -join ', ')"
