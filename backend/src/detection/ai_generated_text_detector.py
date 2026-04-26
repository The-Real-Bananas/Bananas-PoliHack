from transformers import pipeline as hf_pipeline

TEXT_LENGTH_LIMIT = 80
TEXT_WORD_COUNT = 5
class TextValidationError(Exception):
    pass

class UnexpectedResponse(Exception):  # required by main.py imports
    pass


ai_detector = hf_pipeline(
    "text-classification",
    model="Hello-SimpleAI/chatgpt-detector-roberta",
)

def score_to_label(score: int) -> str:
    if score >= 60:
        return "ai"

    elif score <=20:
        return "human"

    return "mixed"

def validate_text(text: str) ->None:
    if not text or not text.strip():
        raise TextValidationError("AI_TEXT_DETECTION: Text is empty")

    if len(text.strip()) < TEXT_LENGTH_LIMIT:
        raise TextValidationError(f"AI_TEXT_DETECTION: Text too short - minimum {TEXT_LENGTH_LIMIT} characters")

    if len(set(text.strip())) < TEXT_WORD_COUNT:
        raise TextValidationError("AI_TEXT_DETECTION: Text doesn't look like real content")

async def detect_text_content(text: str) -> dict:
    #Guard before hitting the model

    validate_text(text)
    result = ai_detector(text[:512])[0]
    print(f"[DEBUG] Raw model output: {result}")

    # This model uses "LABEL_1" = AI, "LABEL_0" = human
    is_ai = result["label"] == "ChatGPT"
    raw_score = int(result["score"] * 100)
    ai_score = raw_score if is_ai else (100 - raw_score)

    return {
        "score": ai_score,
        "label": score_to_label(ai_score),
        "flagged": ai_score >= 60,
        "source": "roberta-base-openai-detector",
    }