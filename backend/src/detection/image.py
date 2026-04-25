import os
import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

HIVE_API_KEY = os.getenv("HIVE_API_KEY")
HIVE_URL = "https://api.thehive.ai/api/v2/task/sync"


class ImageValidationError(Exception):
    pass


def validate_url(url: str) -> None:
    if not url or not url.strip():
        raise ImageValidationError("URL is empty")
    if not url.startswith("http"):
        raise ImageValidationError("Invalid URL - must start with http")
    if url.startswith("data:"):
        raise ImageValidationError("Inline data URIs are not supported")


def score_to_label(score: int) -> str:
    if score > 70: return "ai"
    if score > 40: return "mixed"
    return "human"


def parse_hive_response(data: dict) -> int:
    try:
        classes = data["status"][0]["response"]["output"][0]["classes"]
        for cls in classes:
            if cls["class"] == "ai_generated":
                return round(cls["score"] * 100)
        return 0
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail="Unexpected Hive response format")


async def detect_image_url(url: str) -> dict:
    validate_url(url)

    if not HIVE_API_KEY:
        raise ValueError("HIVE_API_KEY not found in .env")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            HIVE_URL,
            headers={
                "Authorization": f"Token {HIVE_API_KEY}",
                "accept": "application/json",
            },
            data={"url": url},
            timeout=20
        )
        res.raise_for_status()
        data = res.json()

        score = parse_hive_response(data)

        return {
            "score": score,
            "label": score_to_label(score),
            "source": "hive"
        }