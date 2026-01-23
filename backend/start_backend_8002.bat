@echo off
"C:\Users\osman\OneDrive\Desktop\Memora\.venv\Scripts\python.exe" -c "import sys; sys.path.insert(0, r'C:\Users\osman\OneDrive\Desktop\Memora'); import uvicorn; uvicorn.run('backend.server:app', host='127.0.0.1', port=8002, log_level='info')"
pause
