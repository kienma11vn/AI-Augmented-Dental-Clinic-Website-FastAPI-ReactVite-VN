@echo off
title Khoi chay Frontend
color 0B

:: Chuyen huong vao thu muc chua file script
cd /d "%~dp0"

echo ===================================================
echo           KHOI CHAY FRONTEND
echo ===================================================
echo.

:: Kiem tra node_modules, neu chua co thi tu dong cai dat
if not exist "node_modules\" (
    echo [INFO] Khong tim thay node_modules. Dang cai dat dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [LOI] Cai dat dependencies that bai!
        pause
        exit /b %errorlevel%
    )
    echo [INFO] Cai dat dependencies hoan tat.
    echo.
)

:: Khoi chay Dev Server
echo [INFO] Dang khoi chay Frontend Server...
echo.

call npm run dev

:: Neu npm run dev khong ton tai hoac bi loi, thu voi npm start
if %errorlevel% neq 0 (
    echo.
    echo [THONG BAO] "npm run dev" khong hoat dong, dang thu voi "npm start"...
    call npm start
)

pause