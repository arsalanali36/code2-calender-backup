@echo off
echo ================================
echo   Trading Journal - Starting...
echo ================================

:: Install dependencies if needed
pip install -r requirements.txt --quiet

:: Open browser after 2 seconds
start /b timeout /t 2 /nobreak >nul && start http://localhost:5000

:: Run Flask app
python app.py

pause
