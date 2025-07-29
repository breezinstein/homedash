@echo off
echo 🏠 Homedash Development Server
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if server dependencies exist
if not exist "server\node_modules" (
    echo 📦 Installing server dependencies...
    cd server
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    cd ..
)

REM Start the server
echo 🚀 Starting Homedash server...
cd server
call npm start

pause
