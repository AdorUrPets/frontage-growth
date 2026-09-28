@echo off
title Frontage Growth - Mission Control
cd /d "E:\Frontage Growth"

netstat -ano | findstr ":3920" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo Frontage Growth is already running on port 3920.
) else (
    echo Starting Frontage Growth...
    start "Frontage Growth Server" cmd /k "npm run dev"
    timeout /t 6 /nobreak >nul
)

start "" "http://localhost:3920"
exit
