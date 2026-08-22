@echo off
setlocal
cd /d "%~dp0"
title Gemini Floating Assistant

echo ===================================================
echo   Starting Gemini Floating Assistant Overlay
echo ===================================================
echo.

if not exist "dist\main\main.js" (
  echo Compiling application files...
  call npm run build
)

call npx electron .
