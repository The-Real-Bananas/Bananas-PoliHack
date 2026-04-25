from transformers import pipeline as hf_pipeline


# ----------------- MODELS -----------------

intent_classifier = hf_pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)
sentiment_classifier = hf_pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest"
)

hate_classifier = hf_pipeline(
    "text-classification",
    model="cardiffnlp/twitter-roberta-base-hate"
)

fake_news_detector = hf_pipeline(
    "text-classification",
    model="winterForestStump/Roberta-fake-news-detector",
    tokenizer="winterForestStump/Roberta-fake-news-detector"
)

INTENT_LABELS = ["personal message", "opinion", "news or factual claim"]

MISINFO_PATTERNS = [
    "5g", "microchip", "bill gates", "deep state", "new world order",
    "chemtrails", "flat earth", "crisis actor", "plandemic", "mind control",
    "they don't want you to know", "mainstream media is lying",
    "government is hiding", "wake up", "sheeple", "secret cure",
    "doctors hate", "illuminati", "false flag", "population control",
    "implant", "depopulation", "nwo", "lizard", "reptilian",
    "banned by doctors", "what they don't tell you"
]

EXTREME_CLAIM_PATTERNS = [
    "bombed", "just shot", "just killed", "assassinated",
    "just attacked", "just invaded", "just declared war",
    "just died", "was just killed", "just exploded"
]

def has_extreme_claims(text: str) -> bool:
    text_lower = text.lower()
    return any(pattern in text_lower for pattern in EXTREME_CLAIM_PATTERNS)


def has_misinfo_patterns(text: str) -> bool:
    text_lower = text.lower()
    return any(pattern in text_lower for pattern in MISINFO_PATTERNS)

propaganda_detector = hf_pipeline(
    "text-classification",
    model="IDA-SERICS/PropagandaDetection"
)

async def detect_misinfo(text: str) -> dict:
    # Layer 1 — intent
    intent = intent_classifier(text, candidate_labels=INTENT_LABELS)
    top_label = intent["labels"][0]
    top_score = intent["scores"][0]

    if top_score < 0.60 or top_label == "personal message":
        return {
            "flagged": False,
            "label": "personal",
            "score": int(top_score * 100),
            "skipped": True,
            "reason": "Personal or ambiguous content",
            "source": "bart-mnli"
        }

    if top_label == "opinion":
        return {
            "flagged": False,
            "label": "opinion",
            "score": int(top_score * 100),
            "skipped": True,
            "reason": "Opinion — not a factual claim",
            "source": "bart-mnli"
        }

    # Layer 2 — conspiracy keywords
    if has_misinfo_patterns(text):
        return {
            "flagged": True,
            "label": "misinformation",
            "score": 95,
            "skipped": False,
            "source": "keyword-detector"
        }

    # Layer 3 — extreme unverified claims
    if has_extreme_claims(text):
        return {"flagged": True, "label": "unverified-claim", "score": 70, "skipped": False,
                "reason": "Extreme claim — verify before sharing", "source": "keyword-detector"}

        # Layer 4 — propaganda model
    result = propaganda_detector(text[:512])[0]
    is_propaganda = result["label"] == "PROPAGANDA"
    confidence = int(result["score"] * 100)

    if is_propaganda:
        return {
            "flagged": True,
            "label": "propaganda",
            "score": confidence,
            "skipped": False,
            "source": "PropagandaDetection"
        }

        # Layer 5 — extreme negative sentiment on a news claim
    sentiment = sentiment_classifier(text[:512])[0]
    print(f"SENTIMENT: {sentiment}")
    if sentiment["label"] == "negative" and sentiment["score"] > 0.95:
        return {
            "flagged": True,
            "label": "emotionally-manipulative",
            "score": int(sentiment["score"] * 100),
            "skipped": False,
            "reason": "Extremely negative framing on factual claim",
            "source": "twitter-roberta-sentiment"
        }

    # Layer 6 — hate speech
    hate = hate_classifier(text[:512])[0]
    print(f"HATE: {hate}")
    is_hate = hate["label"] == "HATE" and hate["score"] > 0.85

    if is_hate:
        return {
            "flagged": True,
            "label": "hate-speech",
            "score": int(hate["score"] * 100),
            "skipped": False,
            "source": "twitter-roberta-hate"
        }

    return {
        "flagged": False,
        "label": "credible",
        "score": int(confidence * 100),
        "skipped": False,
        "source": "PropagandaDetection"
    }