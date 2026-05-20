@echo off
echo ================================
echo   Trading Journal - Starting...
echo ================================

:: Install dependencies if needed
pip install -r requirements.txt --quiet

:: Open browser after 8 seconds (pip install + Flask watchdog restart takes ~6-8s)
start /b timeout /t 8 /nobreak >nul && start http://localhost:5000

:: Run Flask app
python app.py

pause
