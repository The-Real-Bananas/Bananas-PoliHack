import os
import httpx
from fastapi import HTTPException

HIVE_API_KEY = os.getenv("HIVE_API_KEY")
HIVE_URL = "https://api.thehive.ai/api/v2/task/sync"


def _score_to_label(score: int) -> str:
    if score >= 70:
        return "ai"
    elif score >= 40:
        return "mixed"
    return "human"


def _parse_hive_response(data: dict) -> int:
    try:
        classes = data["status"][0]["response"]["output"][0]["classes"]
        for cls in classes:
            if cls["class"] == "ai_generated":
                return round(cls["score"] * 100)
        return 0
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail="Unexpected Hive response format")


async def detect_image_url(url: str) -> dict:
    if not HIVE_API_KEY:
        raise HTTPException(status_code=500, detail="HIVE_API_KEY not set")

    #empty or obviously invalid URL
    if not url or not url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid image URL")

    #data URIs (base64 inline images) - Hive can't handle these
    if url.startswith("data:"):
        return {
            "score": -1,
            "label": "unknown",
            "source": "hive",
            "reason": "inline data URI not supported"
        }

    headers = {
        "Authorization": f"Token {HIVE_API_KEY}",
        "accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            response = await client.post(HIVE_URL, headers=headers, data={"url": url})
            response.raise_for_status()
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Hive API timed out")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=500, detail="Invalid Hive API key")
            if e.response.status_code == 422:
                # Hive couldn't fetch/process the image (private, broken, wrong format)
                return {
                    "score": -1,
                    "label": "unknown",
                    "source": "hive",
                    "reason": "image could not be processed"
                }
            raise HTTPException(status_code=502, detail=f"Hive API error: {e.response.status_code}")

    score = _parse_hive_response(response.json())

    return {
        "score": score,
        "label": _score_to_label(score),
        "source": "hive",
    }