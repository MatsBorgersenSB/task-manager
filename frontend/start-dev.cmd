@echo off
REM Starts Next.js without PowerShell script restrictions (uses npm.cmd).
cd /d "%~dp0"
echo Starting frontend at http://localhost:3000 ...
call npm.cmd run dev
