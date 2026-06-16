@echo off
REM Task Manager frontend — Next.js dev server (Supabase-backed).
REM Uses npm.cmd to avoid PowerShell script execution policy issues.
cd /d "%~dp0"

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

if not exist ".env.local" (
  echo WARNING: .env.local not found.
  echo Copy .env.local.example to .env.local and add your Supabase keys.
  echo.
)

echo Starting Task Manager at http://localhost:3000
echo   Client view:   http://localhost:3000/client
echo   Internal view: http://localhost:3000/internal
echo.
call npm.cmd run dev

if errorlevel 1 pause
