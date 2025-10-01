@echo off
echo Starting Tetris Multiplayer Server...
echo Server will be available at http://localhost:8000
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
