@echo off
REM ============================================================
REM  EDI Automation (backend :5001, UI :5173) - without HRMS
REM  Note: nothing else may use ports 5001 / 5173 at the same time.
REM ============================================================
cd /d "%~dp0node-backend"
start "EDI Backend :5001" cmd /k "set PORT=5001&& node server.js"

cd /d "%~dp0frontend"
start "EDI UI :5173" cmd /k "npm run dev"

REM DSC Local Signer (:5050) - signs PDFs for e-Sanchit and the BE / SB JSON with the USB token (29-Oct-2026)
start "DSC Signer :5050" cmd /k ""%~dp0START_SIGNER.bat""

timeout /t 8 >nul
start "" http://localhost:5173
