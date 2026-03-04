@echo off
cd /d "%~dp0"
echo [%date% %time%] Native Host started >> native_host.log
echo Current directory: %cd% >> native_host.log
node native_app.js 2>> native_host.log
