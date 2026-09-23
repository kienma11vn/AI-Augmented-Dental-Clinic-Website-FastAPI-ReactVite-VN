@echo off
title Khoi chay Toan bo Du an (Backend + Frontend)

:: Chuyen huong vao thu muc goc chua file script nay
cd /d "%~dp0"

echo ===================================================
echo     KHOI CHAY TOAN BO DU AN (BACKEND & FRONTEND)
echo ===================================================
echo.

:: 1. Khoi chay Backend trong cua so rieng
echo [1/2] Dang khoi chay Backend (Docker)...
if exist "backend\run_docker.bat" (
    start "Backend Server" cmd /k "cd /d "%~dp0backend" && run_docker.bat"
) else (
    echo [LOI] Khong tim thay file backend\run_docker.bat!
    pause
    exit /b 1
)

:: Cho 5 giay de Docker/Database bat dau khoi tao
echo [INFO] Dang cho Backend khoi tao (5 giay)...
timeout /t 5 /nobreak >nul

:: 2. Khoi chay Frontend trong cua so rieng
echo [2/2] Dang khoi chay Frontend Server...
if exist "frontend\start-frontend.bat" (
    start "Frontend Server" cmd /k "cd /d "%~dp0frontend" && start-frontend.bat"
) else if exist "frontend\start_frontend.bat" (
    start "Frontend Server" cmd /k "cd /d "%~dp0frontend" && start_frontend.bat"
) else (
    echo [LOI] Khong tim thay file start-frontend.bat hoac start_frontend.bat trong thu muc frontend!
    pause
    exit /b 1
)

echo.
echo ===================================================
echo  Da gui lenh khoi chay cho ca Backend va Frontend!
echo  Vui long kiem tra 2 cua so Command Prompt moi mo.
echo ===================================================
echo.
pause