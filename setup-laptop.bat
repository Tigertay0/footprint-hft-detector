@echo off
rem Sets up the Footprint watcher on a laptop you use as you go: no startup task and no power-setting changes.
rem Afterwards, double-click run-watcher.bat before the market opens to start watching.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-watcher.ps1" -NoTask
