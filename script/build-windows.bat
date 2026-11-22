@echo off
rem Launcher only: all build logic lives in build-windows.ps1 next to this file.
rem Kept ASCII-only on purpose: cmd.exe mis-parses UTF-8 batch lines under chcp 65001.
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-windows.ps1"
pause
