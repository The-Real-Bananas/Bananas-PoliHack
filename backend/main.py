import asyncio
import sys, os
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
from fastapi.responses import JSONResponse
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.detection.image import detect_image_url
from src.detection.text import TextValidationError, UnexpectedResponse, detect_text_content
from src.cache.cache import get_cached, set_cached
from src.detection.hate_speech_detector import detect_hate_speech
from src.detection.misinfo import detect_misinfo

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False
)

class ImageRequest(BaseModel):
    url: str

class TextRequest(BaseModel):
    text: str

class MisinfoRequest(BaseModel):
    text: str

class HatefulRequest(BaseModel):
    text: str


async def _detect_ai_text(text: str) -> dict:
    # Stubbed AI-text detector. Replace body with detect_text_content(text)
    # once Sapling key + caching are wired back in.
    return {"label": "human", "score": 0, "source": "stub"}


@app.post("/text")
async def extract_text(req: TextRequest):
    return {"text": req.text}


@app.post("/detect/all-text")
async def detect_all_text(req: TextRequest):
    hate, misinfo, ai = await asyncio.gather(
        detect_hate_speech(req.text),
        detect_misinfo(req.text),
        _detect_ai_text(req.text),
    )
    return {
        "hateSpeechLabel": hate.get("label"),
        "hateSpeechScore": hate.get("score", 0),
        "misinfoLabel": misinfo.get("label"),
        "misinfoScore": misinfo.get("score", 0),
        "aiTextLabel": ai.get("label"),
        "aiTextScore": ai.get("score", 0),
    }

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

@app.exception_handler(TextValidationError)
async def text_validation_error_handler(request: Request, exc: TextValidationError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

@app.exception_handler(UnexpectedResponse)
async def unexpected_response_handler(request: Request, exc: UnexpectedResponse):
    return JSONResponse(status_code=502, content={"detail": str(exc)})

@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc)})

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
    return await _detect_ai_text(req.text)

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