@echo off
title EagleView - schedule the daily database backup
REM 14-Nov-2026: adds two Windows scheduled tasks that run BACKUP_EDI_DB.bat every day at 13:30 and 19:30
REM (while this user is logged on). Run it once. To remove: schtasks /Delete /TN "EagleView DB Backup 1330" /F  (and 1930)
set "B=%~dp0BACKUP_EDI_DB.bat"
schtasks /Create /F /SC DAILY /ST 13:30 /TN "EagleView DB Backup 1330" /TR "\"%B%\" auto"
schtasks /Create /F /SC DAILY /ST 19:30 /TN "EagleView DB Backup 1930" /TR "\"%B%\" auto"
echo.
echo Done. The log of each backup is in node-backend\logs\db_backup.log
pause
