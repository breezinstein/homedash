@echo off
setlocal enabledelayedexpansion

REM Homedash Development Script for Windows
REM Usage: dev.bat [command]

set "GREEN=[92m"
set "BLUE=[94m"
set "YELLOW=[93m"
set "RED=[91m"
set "NC=[0m"

:print_header
echo %BLUE%
echo 🏠 Homedash Development Helper
echo ==============================
echo %NC%
goto :eof

:show_help
echo %GREEN%Available commands:%NC%
echo   setup     - Install dependencies and setup development environment
echo   start     - Start the development server
echo   dev       - Start in development mode with nodemon
echo   build     - Build and run Docker container
echo   docker    - Start with Docker Compose
echo   clean     - Clean build artifacts and node_modules
echo   backup    - Create configuration backup
echo   help      - Show this help message
goto :eof

:setup
echo %YELLOW%Setting up development environment...%NC%

REM Install server dependencies
echo 📦 Installing server dependencies...
cd server
call npm install
cd ..

REM Create directories
echo 📁 Creating data directories...
if not exist "server\data" mkdir server\data
if not exist "server\data\backups" mkdir server\data\backups

REM Copy environment file
if not exist ".env" (
    echo ⚙️ Creating environment file...
    copy .env.example .env
)

echo %GREEN%✅ Setup complete!%NC%
echo Run 'dev.bat start' to start the development server
goto :eof

:start_server
echo %YELLOW%Starting Homedash server...%NC%
cd server

if "%2"=="dev" (
    echo 🔧 Starting in development mode with nodemon...
    call npm run dev
) else (
    echo 🚀 Starting in production mode...
    call npm start
)
goto :eof

:dev_server
echo %YELLOW%Starting Homedash server in development mode...%NC%
cd server
echo 🔧 Starting with nodemon...
call npm run dev
goto :eof

:build_docker
echo %YELLOW%Building Docker image...%NC%
docker build -t homedash .

echo %YELLOW%Starting Docker container...%NC%
docker run -p 3001:3001 -v homedash-data:/app/server/data homedash
goto :eof

:run_docker_compose
echo %YELLOW%Starting with Docker Compose...%NC%
docker-compose up -d
echo %GREEN%✅ Homedash is running at http://localhost:3001%NC%
goto :eof

:clean
echo %YELLOW%Cleaning build artifacts...%NC%
if exist "server\node_modules" rmdir /s /q server\node_modules
if exist "server\data\*.log" del /q server\data\*.log
echo %GREEN%✅ Clean complete!%NC%
goto :eof

:create_backup
echo %YELLOW%Creating configuration backup...%NC%
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "timestamp=%dt:~0,8%_%dt:~8,6%"

if exist "server\data\config.json" (
    copy "server\data\config.json" "server\data\backups\manual-backup-%timestamp%.json"
    echo %GREEN%✅ Backup created: manual-backup-%timestamp%.json%NC%
) else (
    echo %RED%❌ No configuration file found%NC%
)
goto :eof

REM Main script logic
call :print_header

if "%1"=="" goto show_help
if "%1"=="help" goto show_help
if "%1"=="setup" goto setup
if "%1"=="start" goto start_server
if "%1"=="dev" goto dev_server
if "%1"=="build" goto build_docker
if "%1"=="docker" goto run_docker_compose
if "%1"=="clean" goto clean
if "%1"=="backup" goto create_backup

:show_help
call :show_help
