@echo off
title Build EagleView Signer
REM ============================================================
REM  16-Nov-2026: builds EagleViewSigner.exe (DSC token signing tool: window + tray icon, PIN asked in its own
REM  window, starts with Windows). One file - copy it to the other PCs; they need no Python, only their token driver.
REM  Needs on THIS PC once: Python 3.10 or newer, 64-bit (python.org), internet for pip.
REM ============================================================
cd /d "%~dp0signer_tool"
python --version || (echo Python is not installed - install Python 3 64-bit from python.org first. & pause & exit /b 1)
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller || goto :err
python make_icon.py || goto :err
python -m PyInstaller --noconfirm --clean --onefile --windowed --name EagleViewSigner --icon eagleview_signer.ico ^
  --add-data "ui;ui" --collect-all pyhanko --collect-all pyhanko_certvalidator --collect-data tzdata ^
  --collect-all webview --collect-all pymupdf --collect-submodules pkcs11 --hidden-import pystray._win32 eagleview_signer.py || goto :err
copy /y "dist\EagleViewSigner.exe" "%~dp0EagleViewSigner.exe" >nul || goto :err
echo.
echo Done: %~dp0EagleViewSigner.exe
echo  - Close the old black "DSC Signer :5050" window, then double-click EagleViewSigner.exe.
echo  - Other PCs: copy EagleViewSigner.exe anywhere (e.g. Desktop) and double-click it once.
pause
exit /b 0
:err
echo.
echo Build failed - send the messages above.
pause
exit /b 1
