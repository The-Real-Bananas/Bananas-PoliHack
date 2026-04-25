import os
import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()


GPTZERO_KEY = os.getenv("GPTZERO_API_KEY")

MIN_WORDS = 20
MIN_CHARS = 100


class TextValidationError(Exception):
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


def score_to_label(score: int ) -> str:
    if score > 70: return "ai"
    if score > 40: return "mixed"
    return "human"

async def detect_text_content(text: str) -> dict:

    validate_text(text) #throw before hitting API if invalid
    if not GPTZERO_KEY:
        raise ValueError("GPTZERO_API_KEY not found in .env")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.gptzero.me/v2/predict/text",
            headers={
                "x-api-key": GPTZERO_KEY,
                "Content-Type": "application/json"
            },
            json={"document": text},
            timeout=15
        )
        res.raise_for_status()
        data = res.json()

        prob = data["documents"][0]["completed_generated_prob"]
        score = int(prob * 100)

        return {
            "score" : score,
            "label" : score_to_label(score),
            "source" : "gptzero"
        }