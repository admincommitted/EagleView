@echo off
title EagleView - Field App Internet Link
REM Puts the Field App (and the PO approval links) on the internet through a Cloudflare quick tunnel.
REM Only the field app's own calls pass; the rest of EagleView stays inside the office.
REM Needs: the EagleView backend running (start_edi_backend.bat) and cloudflared installed once:
REM     winget install --id Cloudflare.cloudflared
REM Keep this window open while field boys are out. The link changes each time this is started.
cd /d "%~dp0node-backend"
node src/gateway/fieldGateway.js
echo.
pause
