@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_windows.ps1"
if errorlevel 1 (
  echo.
  echo Setup failed. Read the error above.
  exit /b 1
)

echo.
echo Setup finished successfully.
exit /b 0
