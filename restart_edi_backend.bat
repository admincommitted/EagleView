@echo off
title EDI Backend (port 5001)
REM Stops whatever EDI backend is already listening on 5001, then starts a fresh one.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
timeout /t 2 >nul
cd /d "%~dp0node-backend"
set PORT=5001
node server.js
pause
