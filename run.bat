@echo off
rem Footprint: starts the app and opens it in your browser.
rem First run creates a private Python environment in .venv and installs what the app needs (about 2 minutes).
setlocal
cd /d "%~dp0"
if not defined PORT set PORT=8000
if not defined HOST set HOST=127.0.0.1

where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.10 or newer is needed. Install it from https://www.python.org/downloads/ and run this file again.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Setting up for the first time. This takes about 2 minutes...
  python -m venv .venv || goto :fail
  ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip || goto :fail
  ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt || goto :fail
)

if not defined NO_BROWSER start "" cmd /c "timeout /t 3 /nobreak >nul & start http://127.0.0.1:%PORT%"
echo Footprint is running at http://127.0.0.1:%PORT%  (close this window to stop it)
".venv\Scripts\python.exe" -m uvicorn main:app --app-dir server --host %HOST% --port %PORT%
goto :eof

:fail
echo.
echo Setup did not finish. Read the messages above, fix the problem, and run this file again.
pause
exit /b 1

