@echo off
REM Start the Task Manager frontend from the repo root.
cd /d "%~dp0"
call frontend\start-dev.cmd
