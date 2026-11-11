@echo off
rem TravelHub supplier Chrome (AZAL + Aviasales) with CDP on port 9222.
rem Bypasses PowerShell execution policy for this local helper script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-azal-chrome.ps1" %*
