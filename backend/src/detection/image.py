import asyncio
import base64
import os
import httpx
from fastapi import HTTPException

from src.detection.ai_image_detector import predict_image_bytes

SIGHTENGINE_URL = "https://api.sightengine.com/1.0/check.json"


class ImageValidationError(Exception):
    pass


def validate_url(url: str):
    if not url or not url.strip():
        raise ImageValidationError("URL is empty")
    if not (url.startswith("http") or url.startswith("data:")):
        raise ImageValidationError("Invalid URL - must start with http or be a data: URI")


def _decode_data_uri(uri: str) -> bytes:
    # data:[<mediatype>][;base64],<data>
    try:
        header, payload = uri.split(",", 1)
    except ValueError:
        raise ImageValidationError("Malformed data URI")
    if ";base64" in header:
        return base64.b64decode(payload)
    from urllib.parse import unquote_to_bytes
    return unquote_to_bytes(payload)


def parse_sightengine_response(data: dict) -> int:
    try:
        return round(data["type"]["ai_generated"] * 100)
    except (KeyError, TypeError):
        raise HTTPException(status_code=502, detail=f"Unexpected Sightengine response: {data}")


async def _fetch_image_bytes(url: str) -> bytes:
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; AIDetectorBot/1.0)",
        "Accept": "image/*,*/*;q=0.8",
    }
    timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
    try:
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=timeout) as client:
            res = await client.get(url)
            res.raise_for_status()
            return res.content
    except httpx.ConnectTimeout:
        raise HTTPException(status_code=504, detail=f"Connect timeout fetching image: {url}")
    except httpx.ConnectError as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach image host: {e}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Image host returned {e.response.status_code}")


async def detect_image_url(url: str) -> dict:
    validate_url(url)

    if url.startswith("data:"):
        image_bytes = _decode_data_uri(url)
    else:
        image_bytes = await _fetch_image_bytes(url)

    return await asyncio.to_thread(predict_image_bytes, image_bytes)


async def detect_image_with_sightengine(url: str) -> dict:
    validate_url(url)

    SIGHTENGINE_USER = os.getenv("SIGHTENGINE_USER")
    SIGHTENGINE_SECRET = os.getenv("SIGHTENGINE_SECRET")

    if not SIGHTENGINE_USER or not SIGHTENGINE_SECRET:
        raise ValueError("SIGHTENGINE_USER or SIGHTENGINE_SECRET not found in .env")

    async with httpx.AsyncClient() as client:
        res = await client.get(
            SIGHTENGINE_URL,
            params={
                "url": url,
                "models": "genai",
                "api_user": SIGHTENGINE_USER,
                "api_secret": SIGHTENGINE_SECRET,
            },
            timeout=20,
        )
        res.raise_for_status()
        data = res.json()

    return {"score": parse_sightengine_response(data), "source": "sightengine"}
