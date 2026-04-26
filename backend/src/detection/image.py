import os
import random
import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

SIGHTENGINE_URL = "https://api.sightengine.com/1.0/check.json"


class ImageValidationError(Exception):
    pass


def validate_url(url: str):
    if not url or not url.strip():
        raise ImageValidationError("URL is empty")
    if not url.startswith("http"):
        raise ImageValidationError("Invalid URL - must start with http")
    if url.startswith("data:"):
        raise ImageValidationError("Inline data URIs are not supported")
    pass

def parse_sightengine_response(data: dict) -> int:
    try:
        return round(data["type"]["ai_generated"] * 100)  # fixed - correct response format
    except (KeyError, TypeError):
        raise HTTPException(status_code=502, detail=f"Unexpected Sightengine response: {data}")


async def detect_image_url(url: str) -> dict:
    return { "score": random.randint(0, 100), "source": "sightengine" }
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
                "api_secret": SIGHTENGINE_SECRET
            },
            timeout=20
        )

        res.raise_for_status()
        data = res.json()

        score = parse_sightengine_response(data)

        return {
            "score": score,
            "source": "sightengine"
        }