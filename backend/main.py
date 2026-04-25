import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.responses import JSONResponse
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.detection.image import detect_image_url
from src.detection.text import TextValidationError, UnexpectedResponse, detect_text_content
from src.cache.cache import get_cached, set_cached



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

class ImageRequest(BaseModel):
    url: str

class TextRequest(BaseModel):
    text: str

@app.exception_handler(TextValidationError, UnexpectedResponse)
async def validation_error_handler(request: Request, exc: TextValidationError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

@app.post("/detect/image")
async def detect_image(req: ImageRequest):
    cached = get_cached(req.url)

    if cached:
        return cached
    result = await detect_image_url(req.url)
    set_cached(req.url, result)
    return result

@app.post("/detect/text")
async def detect_text(req: TextRequest):
    key = req.text[:100] # use first 100 chars as cache key
    cached = get_cached(key)
    if cached:
        return cached
    result = await detect_text_content(req.text)
    set_cached(key, result)
    return result

@app.get("/health")
async def health():
    return {"status": "ok"}


