@echo off
title Khoi chay Backend voi Docker Compose
color 0B

:: Chuyen huong vao thu muc chua file script
cd /d "%~dp0"

echo ===================================================
echo        KHOI CHAY DOCKER CONTAINERS (DB + API)       
echo ===================================================
echo.

set HASH_FILE=.last_build_hash

echo [1/2] Dang kiem tra thay doi trong ma nguon Backend...

:: Tinh ma SHA256: Bỏ qua __pycache__, .pyc va sap xep danh sach file theo tên
for /f "tokens=*" %%a in ('powershell -Command "$files = Get-ChildItem -Path 'app', 'Dockerfile', 'requirements.txt', '.env' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '__pycache__' -and $_.Extension -ne '.pyc' } | Sort-Object FullName | Get-FileHash -Algorithm SHA256; $combined = ($files | Select-Object -ExpandProperty Hash) -join ''; $bytes = [System.Text.Encoding]::UTF8.GetBytes($combined); $finalHash = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)) -replace '-',''; $finalHash"' ) do set CURRENT_HASH=%%a

set LAST_HASH=
if exist %HASH_FILE% set /p LAST_HASH=<%HASH_FILE%

echo Hash hien tai : %CURRENT_HASH%
echo Hash lan truoc : %LAST_HASH%
echo.

if "%CURRENT_HASH%"=="%LAST_HASH%" (
    echo [THONG BAO] Khong phat hien thay doi code. Dang khoi chay containers...
    echo ---------------------------------------------------
    docker compose up
) else (
    echo [THONG BAO] Phat hien thay doi code! Dang build va khoi chay lai containers...
    echo ---------------------------------------------------
    docker compose up --build
    if %ERRORLEVEL% EQU 0 (
        :: Ghi Hash chinh xac vao file (khong chua dau cach/dong moi thua)
        <nul set /p="%CURRENT_HASH%" > %HASH_FILE%
    )
)

pause