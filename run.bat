cd extension
call npm run build
cd ..

uvicorn backend.main:app --reload --port 8000