"""
Local AI image detector — wraps the ResNet18 checkpoint trained in backend/museum.
Loaded lazily so the FastAPI app can boot even when torch/torchvision aren't
installed yet.
"""

import io
import os
import threading
from functools import lru_cache

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "museum",
    "museum.pth",
)

_lock = threading.Lock()


class _Detector:
    def __init__(self, model_path: str):
        import torch
        import torch.nn as nn
        import torch.nn.functional as F
        from torchvision import models, transforms

        self._torch = torch
        self._F = F

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)
        self.classes = checkpoint["classes"]

        self.model = models.resnet18(weights=None)
        num_features = self.model.fc.in_features
        self.model.fc = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(num_features, 2),
        )
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])

    def predict_bytes(self, image_bytes: bytes) -> dict:
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        with self._torch.no_grad():
            outputs = self.model(tensor)
            probabilities = self._F.softmax(outputs, dim=1)[0]

        class_probs = {
            cls: round(prob.item(), 4)
            for cls, prob in zip(self.classes, probabilities)
        }

        ai_index = self.classes.index("ai") if "ai" in self.classes else 0
        ai_score = round(probabilities[ai_index].item() * 100, 1)

        if ai_score > 70:
            label = "ai"
        elif ai_score > 40:
            label = "mixed"
        else:
            label = "human"

        return {
            "score": ai_score,
            "label": label,
            "source": "custom-resnet18",
            "class_probabilities": class_probs,
        }


@lru_cache(maxsize=1)
def get_detector() -> _Detector:
    with _lock:
        if not os.path.isfile(MODEL_PATH):
            raise FileNotFoundError(f"AI detector checkpoint not found at {MODEL_PATH}")
        return _Detector(MODEL_PATH)


def predict_image_bytes(image_bytes: bytes) -> dict:
    return get_detector().predict_bytes(image_bytes)
