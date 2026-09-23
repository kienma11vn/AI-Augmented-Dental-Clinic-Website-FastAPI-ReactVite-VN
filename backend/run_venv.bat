@echo off
title Khoi chay Backend FastAPI
color 0A

echo ===================================================
echo           DENTAL CLINIC BACKEND LAUNCHER           
echo ===================================================
echo.

:: 1. Kich hoat moi truong ao Python (Venv) neu co
if exist venv\Scripts\activate (
    echo [1/3] Dang kich hoat venv...
    call venv\Scripts\activate
) else if exist .venv\Scripts\activate (
    echo [1/3] Dang kich hoat .venv...
    call .venv\Scripts\activate
) else (
    echo [1/3] Khong tim thay venv, su dung Python he thong...
)

:: 2. Chay migration CSDL qua Alembic
echo [2/3] Dang cap nhat CSDL (Alembic Migration)...
alembic upgrade head

:: 3. Khoi chay Uvicorn Server voi che do Auto-Reload
echo [3/3] Dang khoi chay Uvicorn Server tai http://127.0.0.1:8000 ...
echo Nhap Ctrl+C de dung Server.
echo ---------------------------------------------------
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

pause