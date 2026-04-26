import re
from functools import lru_cache

TEXT_LENGTH_LIMIT = 25
CUSS_THRESHOLD = 3
HATE_KEYWORD_THRESHOLD = 1

CUSS_WORDS = {
    "fuck", "shit", "bitch", "bastard", "asshole", "damn", "crap",
    "piss", "dick", "cock", "pussy", "cunt", "whore", "slut",
}

HATE_KEYWORDS = {
    "subhuman", "vermin",'kys','kill yourself', "parasite", "infestation", "filth",
    "degenerates", "savages", "animals", "exterminate", "purge",
    "cleanse", "inferior", "mongrel", "scum", "trash",
    "go back to", "not welcome here", "don't belong", "replace us",
    "great replacement", "white genocide", "race traitor",
}


@lru_cache(maxsize=1)
def _get_classifier():
    from transformers import pipeline as hf_pipeline
    return hf_pipeline(
        "text-classification",
        model="cardiffnlp/twitter-roberta-base-hate",
    )


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\b\w+\b", text.lower())

def _check_cuss_words(text: str) -> bool:
    tokens = _tokenize(text)
    found = [t for t in tokens if t in CUSS_WORDS]
    return len(found) >= CUSS_THRESHOLD

def _check_hate_keywords(text: str) -> bool:
    text_lower = text.lower()
    found = [kw for kw in HATE_KEYWORDS if kw in text_lower]
    return len(found) >= HATE_KEYWORD_THRESHOLD


async def detect_hate_speech(text: str) -> dict:
    if len(text.strip()) < TEXT_LENGTH_LIMIT:
        return {
            "flagged": False,
            "label": "too-short",
            "skipped": True,
            "source": "validator"
        }

    if _check_hate_keywords(text):
        return {
            "flagged": True,
            "label": "hate-speech",
            "score": 100,
            "source": "keyword-detector"
        }

    if _check_cuss_words(text):
        return {
            "flagged": True,
            "label": "hate-speech",
            "score": 95,
            "source": "cuss-detector"
        }

    try:
        classifier = _get_classifier()
        result = classifier(text[:512])[0]
    except Exception as e:
        return {
            "flagged": False,
            "label": "unavailable",
            "score": 0,
            "source": "twitter-roberta-hate",
            "error": str(e),
        }

    is_hate = result["label"].upper() == "HATE"

    return {
        "flagged": is_hate,
        "label": "hate-speech" if is_hate else "clean",
        "score": int(result["score"] * 100),
        "source": "twitter-roberta-hate"
    }
