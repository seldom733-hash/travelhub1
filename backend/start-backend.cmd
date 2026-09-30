@echo off
rem TravelHub backend start (detached-friendly).
rem 1) Ensure AZAL CDP Chrome is up (reuses an existing CDP session on :9222;
rem    non-fatal if Chrome missing — AZAL search degrades gracefully).
rem 2) Start NestJS backend (ts-node).

cd /d D:\travelhub_v1\backend

powershell -NoProfile -ExecutionPolicy Bypass -File .\start-azal-chrome.ps1
if errorlevel 1 (
  echo [start-backend] AZAL Chrome CDP unavailable - continuing without it. AZAL flight search will fail until Chrome CDP is started.
)

call npx ts-node src/main.ts
