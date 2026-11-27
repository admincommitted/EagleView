@echo off
title EDI Backend (port 5001)
cd /d "%~dp0node-backend"
set PORT=5001
node src/server.js
pause
