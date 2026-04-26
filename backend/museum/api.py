"""
AI Image Detector — FastAPI Backend
=====================================
Serves the trained model over HTTP for the Chrome extension.

Endpoints:
    POST /detect/image        — Upload an image file
    POST /detect/image/url    — Send an image URL to classify
    GET  /health              — Health check

Run:
    pip install fastapi uvicorn python-multipart httpx
    uvicorn api:app --reload --port 8000
"""

import io
import hashlib
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from predict import AIImageDetector


# ── Config ───────────────────────────────────────────────────────────────────

MODEL_PATH = "ai_detector.pth"

# In-memory cache: hash → result
cache: dict[str, dict] = {}

# Global detector instance
detector: AIImageDetector | None = None


# ── Startup / Shutdown ───────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model once at startup."""
    global detector
    detector = AIImageDetector(MODEL_PATH, device="cuda")
    print("Model loaded. Ready to serve.")
    yield
    print("Shutting down.")


app = FastAPI(title="AI Image Detector API", lifespan=lifespan)

# Allow requests from the Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ────────────────────────────────────────────────

class URLRequest(BaseModel):
    url: str


class DetectionResponse(BaseModel):
    score: float
    label: str          # "ai" | "mixed" | "human"
    source: str         # "custom-resnet18"
    cached: bool = False


# ── Helper ───────────────────────────────────────────────────────────────────

def get_cache_key(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": detector is not None}


@app.post("/detect/image", response_model=DetectionResponse)
async def detect_image_upload(file: UploadFile = File(...)):
    """Detect AI in an uploaded image file."""
    if detector is None:
        raise HTTPException(500, "Model not loaded")

    image_bytes = await file.read()
    cache_key = get_cache_key(image_bytes)

    if cache_key in cache:
        return DetectionResponse(**cache[cache_key], cached=True)

    result = detector.predict_from_bytes(image_bytes)
    cache[cache_key] = result
    return DetectionResponse(**result)


@app.post("/detect/image/url", response_model=DetectionResponse)
async def detect_image_url(req: URLRequest):
    """Download an image from a URL and classify it."""
    if detector is None:
        raise HTTPException(500, "Model not loaded")

    # Use URL as a quick cache key first
    url_hash = hashlib.md5(req.url.encode()).hexdigest()
    if url_hash in cache:
        return DetectionResponse(**cache[url_hash], cached=True)

    # Download the image
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(req.url)
            resp.raise_for_status()
            image_bytes = resp.content
    except httpx.HTTPError as e:
        raise HTTPException(400, f"Failed to download image: {e}")

    result = detector.predict_from_bytes(image_bytes)
    cache[url_hash] = result
    return DetectionResponse(**result)
