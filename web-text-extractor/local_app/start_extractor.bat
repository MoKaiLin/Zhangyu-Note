@echo off

rem Start Web Text Extractor Local App

echo Starting Web Text Extractor...
echo ====================================

rem Check Python installation
echo Checking Python installation...
python --version
if %ERRORLEVEL% neq 0 (
    echo Error: Python not found. Please install Python 3.6 or higher.
    echo Download from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Python version check successful

rem Install dependencies
echo Checking and installing dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to install dependencies
    echo Try manually: pip install -r requirements.txt
    pause
    exit /b 1
)

echo Dependencies installed successfully

rem Check if port 8765 is in use
echo Checking if port 8765 is in use...
netstat -ano | findstr :8765 > nul
if %ERRORLEVEL% equ 0 (
    echo Port 8765 is in use. Trying to free it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8765') do (
        echo Killing process %%a...
        taskkill /F /PID %%a > nul 2>&1
    )
    echo Port 8765 has been freed
)

rem Start application
echo Starting local application...
start "Web Text Extractor" python local_app.py

echo Web Text Extractor started in background
pause
