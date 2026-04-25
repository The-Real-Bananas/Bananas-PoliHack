from transformers import pipeline as hf_pipeline

intent_classifier = hf_pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
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

def has_misinfo_patterns(text: str) -> bool:
    text_lower = text.lower()
    return any(pattern in text_lower for pattern in MISINFO_PATTERNS)

async def detect_misinfo(text: str) -> dict:
    # Layer 1 — intent
    intent = intent_classifier(text, candidate_labels=INTENT_LABELS)
    top_label = intent["labels"][0]
    top_score = int(intent["scores"][0] * 100)

    if top_label == "personal message":
        return {
            "flagged": False,
            "label": "personal",
            "score": top_score,
            "skipped": True,
            "reason": "Personal content",
            "source": "bart-mnli"
        }

    if top_label == "opinion":
        return {
            "flagged": False,
            "label": "opinion",
            "score": top_score,
            "skipped": True,
            "reason": "Opinion — not a factual claim",
            "source": "bart-mnli"
        }

    # Layer 2 — keyword misinfo check
    if has_misinfo_patterns(text):
        return {
            "flagged": True,
            "label": "misinformation",
            "score": 95,
            "skipped": False,
            "source": "keyword-detector"
        }

    return {
        "flagged": False,
        "label": "credible",
        "score": 85,
        "skipped": False,
        "source": "keyword-detector"
    }