@echo off
REM ============================================================
REM  DSC signer (:5050) - signs e-Sanchit PDFs and the BE / SB JSON with the USB token.
REM  16-Nov-2026: if EagleViewSigner.exe is there (BUILD_SIGNER_EXE.bat), it is used: window + tray icon, the PIN is
REM  asked in its own window. Otherwise the console signer below (needs Python 3; first run installs the packages).
REM ============================================================
if exist "%~dp0EagleViewSigner.exe" (
  start "" "%~dp0EagleViewSigner.exe" --tray
  exit
)
cd /d "%~dp0local_signer"
python -c "import flask, pyhanko, pkcs11" 2>nul || pip install -r requirements.txt
python app.py
pause
