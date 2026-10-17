@echo off
rem Runs the Footprint watcher and keeps it running (restarts it, and warns your phone if it keeps crashing).
rem install-watcher.ps1 sets this up to start at boot. You can also double-click it to try it.
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo The Python environment is missing. Run install-watcher.ps1 first.
  exit /b 1
)
".venv\Scripts\python.exe" server\supervisor.py
exit /b %ERRORLEVEL%
