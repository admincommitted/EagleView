@echo off
title EagleView - database backup
REM Safe backup of node-backend\database.sqlite (works while the backend runs). Used by SCHEDULE_DB_BACKUP.bat.
REM "auto" = run from the scheduled task, so no pause at the end.
cd /d "%~dp0node-backend"
node scripts/backupDatabase.js
if /i not "%~1"=="auto" pause
