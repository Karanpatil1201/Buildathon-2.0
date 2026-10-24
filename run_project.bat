@echo off
title Steel-IQ Quality Control System Launcher
echo ===================================================
echo Starting Steel-IQ Quality Control System
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo ===================================================

echo Starting Backend Server...
start "Steel-IQ Backend (FastAPI)" cmd /k "cd /d F:\Projects\Buildathon-2.0\backend && .venv\Scripts\activate && uvicorn app.main:app --host 127.0.0.1 --port 8000"

timeout /t 2 /nobreak >nul

echo Starting Frontend Dev Server...
start "Steel-IQ Frontend (Vite/React)" cmd /k "cd /d F:\Projects\Buildathon-2.0\frontend && npm run dev"

echo.
echo Both servers have been launched in separate windows!
echo Open your browser at http://localhost:5173
echo ===================================================
pause
