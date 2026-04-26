import os
import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

SAPLING_KEY = os.getenv("SAPLING_KEY")
SAPLING_URL = "https://api.sapling.ai/api/v1/aidetect"

MIN_WORDS = 20
MIN_CHARS = 100


class TextValidationError(Exception):
    pass

class UnexpectedResponse(Exception):
    pass


def validate_text(text: str) -> None:
    if not text or not text.strip():
        raise TextValidationError("Text is empty")

    if len(text.strip()) < MIN_CHARS:
        raise TextValidationError(f"Text too short - minimum {MIN_CHARS} characters")

    word_count = len(text.split())

    if word_count < MIN_WORDS:
        raise TextValidationError(f"Text too short - minimum {MIN_WORDS} words")

    if len(set(text.strip())) < 5:
        raise TextValidationError("Text doesn't look like real content")


async def detect_text_content(text: str) -> dict:
    print("Backend got: ", text)
    return {
        "score" : 99,
        "source" : "sapling"
    }
    
    validate_text(text) #throw before hitting API if invalid
    if not SAPLING_KEY:
        raise ValueError("SAPLING_KEY not found in .env")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            SAPLING_URL,
            json={
                "key": SAPLING_KEY,
                "text": text
            },
            timeout=15
        )
        
        res.raise_for_status()
        data = res.json()

        if "score" not in data:
            raise UnexpectedResponse(f"Unexpected response from Sapling: {data}")

        prob = data["score"]
        score = int(prob * 100)

        return {
            "score" : score,
            "source" : "sapling"
        }