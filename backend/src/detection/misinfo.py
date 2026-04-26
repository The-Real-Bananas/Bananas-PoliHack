from transformers import pipeline as hf_pipeline

# ==========================================
# 1. CONSTANTS & LISTS
# ==========================================
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

# ==========================================
# 2. MODELS INITIALIZATION
# ==========================================
intent_classifier = hf_pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)

propaganda_detector = hf_pipeline(
    "text-classification",
    model="IDA-SERICS/PropagandaDetection"
)

sentiment_classifier = hf_pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest"
)


# ==========================================
# 3. HELPER FUNCTIONS
# ==========================================
def has_misinfo_patterns(text: str) -> bool:
    return any(pattern in text.lower() for pattern in MISINFO_PATTERNS)

def has_extreme_claims(text: str) -> bool:
    return any(pattern in text.lower() for pattern in EXTREME_CLAIM_PATTERNS)

# ==========================================
# 4. MAIN PIPELINE LOGIC
# ==========================================
async def detect_misinfo(text: str) -> dict:

    # PRE-CHECK 1 — too short
    if len(text.strip()) < 20:
        return {
            "flagged": False,
            "label": "too-short",
            "score": 0,
            "skipped": True,
            "reason": "Text too short to analyze",
            "source": "validator"
        }
    # LAYER 1 — intent classification
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

    # LAYER 2 — conspiracy keyword check
    if has_misinfo_patterns(text):
        return {
            "flagged": True,
            "label": "misinformation",
            "score": 95,
            "skipped": False,
            "source": "keyword-detector"
        }

    # LAYER 3 — extreme unverified claims
    if has_extreme_claims(text):
        return {
            "flagged": True,
            "label": "unverified-claim",
            "score": 70,
            "skipped": False,
            "reason": "Extreme claim — verify before sharing",
            "source": "keyword-detector"
        }

    # LAYER 4 — propaganda model
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

    # LAYER 5 — emotionally manipulative framing
    sentiment = sentiment_classifier(text[:512])[0]
    if sentiment["label"] == "negative" and sentiment["score"] > 0.95:
        return {
            "flagged": True,
            "label": "emotionally-manipulative",
            "score": int(sentiment["score"] * 100),
            "skipped": False,
            "reason": "Extremely negative framing on factual claim",
            "source": "twitter-roberta-sentiment"
        }

    # ALL CLEAR
    return {
        "flagged": False,
        "label": "credible",
        "score": confidence,
        "skipped": False,
        "source": "PropagandaDetection"
    }