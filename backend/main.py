import asyncio
from http.client import HTTPException

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.src.detection.hate_speech_detector import detect_hate_speech
from backend.src.detection.image import detect_image_url
from backend.src.detection.text import detect_text_content
from backend.src.cache.cache import get_cached, set_cached
from backend.src.detection.misinfo import detect_misinfo

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
class MisinfoRequest(BaseModel):
    text: str
class HatefulRequest(BaseModel):
    text: str

class TextRequest(BaseModel):
    text: str


@app.post("/text")
async def extract_text(req: TextRequest):
    return {"text": req.text}


@app.post("/analyze")
async def analyze(req: TextRequest):
    hate, misinfo = await asyncio.gather(
        detect_hate_speech(req.text),
        detect_misinfo(req.text),
    )
    return {
        "text": req.text,
        "hate": hate,
        "misinfo": misinfo,
    }

@app.post("/detect/image")
async def detect_image(req: ImageRequest):
    cached = get_cached(req.url)

    if cached:
        return cached
    try:
        result = await detect_image_url(req.url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")
    set_cached(req.url, result)
    return result

@app.post("/detect/text")
async def detect_text(req: TextRequest):
    key = req.text[:100] # use first 100 chars as cache key
    cached = get_cached(key)
    if cached:
        return cached
    try:
        result = await detect_text_content(req.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")
    set_cached(key, result)
    return result

@app.get("/health")
async def health():
    return {"status": "ok"}



@app.post("/detect/misinfo")
async def detect_misinfo_endpoint(req: MisinfoRequest):
    cached = get_cached("misinfo:" + req.text[:100])
    if cached:
        return cached
    try:
        result = await detect_misinfo(req.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    set_cached("misinfo:" + req.text[:100], result)
    return result


@app.post("/detect/hateful_speach")
async def detect_hateful_speach(req: HatefulRequest):
    cached = get_cached("hateful:" + req.text[:100])
    if cached:
        return cached

    try:
        result = await detect_hate_speech(req.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    set_cached("hateful:" + req.text[:100],result)
    return result