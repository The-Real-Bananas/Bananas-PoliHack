uvicorn backend.main:app --reload --port 8000
cd extension
npm run build
npm run start