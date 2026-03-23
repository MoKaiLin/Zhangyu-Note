# Start Web Text Extractor Local App

Write-Host "Starting Web Text Extractor..."
Write-Host "===================================="

# Check Python installation
Write-Host "Checking Python installation..."
try {
    $pythonVersion = python --version 2>&1
    Write-Host $pythonVersion
} catch {
    Write-Host "Error: Python not found. Please install Python 3.6 or higher." -ForegroundColor Red
    Write-Host "Download from https://www.python.org/downloads/" -ForegroundColor Yellow
    Read-Host "Press any key to exit..."
    exit 1
}

if (-not $pythonVersion) {
    Write-Host "Error: Python not found. Please install Python 3.6 or higher." -ForegroundColor Red
    Write-Host "Download from https://www.python.org/downloads/" -ForegroundColor Yellow
    Read-Host "Press any key to exit..."
    exit 1
}

Write-Host "Python version check successful"

# Install dependencies
Write-Host "Checking and installing dependencies..."
try {
    pip install -r requirements.txt
} catch {
    Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
    Write-Host "Try manually: pip install -r requirements.txt" -ForegroundColor Yellow
    Read-Host "Press any key to exit..."
    exit 1
}

Write-Host "Dependencies installed successfully"

# Check if port 8765 is in use
Write-Host "Checking if port 8765 is in use..."
$portInUse = netstat -ano | Select-String ":8765"
if ($portInUse) {
    Write-Host "Port 8765 is in use. Trying to free it..."
    $processIds = $portInUse | ForEach-Object { $_.ToString() -split ' ' | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1 }
    foreach ($pid in $processIds) {
        if ($pid -match '^\d+$') {
            Write-Host "Killing process $pid..."
            try {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Host "Failed to kill process $pid"
            }
        }
    }
    Write-Host "Port 8765 has been freed"
}

# Start application
Write-Host "Starting local application..."
python local_app.py

Read-Host "Press any key to exit..."
