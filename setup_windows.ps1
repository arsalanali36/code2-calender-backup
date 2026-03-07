Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

function Test-Cmd {
    param([Parameter(Mandatory = $true)][string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-Winget {
    if (-not (Test-Cmd "winget")) {
        throw "winget not found. Please update/install App Installer from Microsoft Store, then rerun."
    }
}

function Install-WingetPackage {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Label
    )

    Write-Host "Installing $Label via winget..."
    winget install --id $Id --exact --silent --accept-package-agreements --accept-source-agreements | Out-Host
}

Write-Host "Project root: $projectRoot"
Ensure-Winget

# Python install/check
$hasPyLauncher = Test-Cmd "py"
$hasPython = Test-Cmd "python"
if (-not $hasPyLauncher -and -not $hasPython) {
    Install-WingetPackage -Id "Python.Python.3.12" -Label "Python 3.12"
}

# Node install/check
$hasNode = Test-Cmd "node"
$hasNpm = Test-Cmd "npm"
if (-not $hasNode -or -not $hasNpm) {
    Install-WingetPackage -Id "OpenJS.NodeJS.LTS" -Label "Node.js LTS"
}

# Build venv
if (-not (Test-Path ".venv\Scripts\python.exe")) {
    if (Test-Cmd "py") {
        & py -3 -m venv .venv
    }
    elseif (Test-Cmd "python") {
        & python -m venv .venv
    }
    else {
        throw "Python install completed but command not visible in current terminal. Open a new terminal and run setup_windows.bat again."
    }
}

$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    throw "Virtual environment python not found at $venvPython"
}

& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r requirements.txt

if (Test-Path "package.json") {
    if (Test-Cmd "npm") {
        npm install | Out-Host
    }
    else {
        Write-Warning "npm not found in current terminal. Re-open terminal, then run setup_windows.bat again for Node deps."
    }
}

if (Test-Path ".tmp_logger_ui\package.json") {
    if (Test-Cmd "npm") {
        npm install --prefix .tmp_logger_ui | Out-Host
    }
    else {
        Write-Warning "npm not found in current terminal. Re-open terminal, then run setup_windows.bat again for .tmp_logger_ui deps."
    }
}

Write-Host ""
Write-Host "Setup complete."
Write-Host "Run app with:"
Write-Host "  .\.venv\Scripts\python.exe app.py"
