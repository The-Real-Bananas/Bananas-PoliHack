"""
AI Image Detector — Inference
==============================
Loads the trained ResNet18 model and predicts whether an image is AI-generated.

Usage:
    python predict.py ai_detector.pth path/to/image.jpg
"""

import sys
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image


class AIImageDetector:
    def __init__(self, model_path: str, device: str | None = None):
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)
        self.classes = checkpoint["classes"]

        self.model = models.resnet18(weights=None)
        num_features = self.model.fc.in_features
        self.model.fc = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(num_features, 2)
        )

        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])

        print(f"Model loaded on {self.device} | Classes: {self.classes} | "
              f"Checkpoint accuracy: {checkpoint.get('accuracy', 'N/A')}")

    def _predict_tensor(self, tensor: torch.Tensor) -> dict:
        with torch.no_grad():
            outputs = self.model(tensor)
            probabilities = F.softmax(outputs, dim=1)[0]

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

    def predict(self, image_path: str) -> dict:
        image = Image.open(image_path).convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)
        return self._predict_tensor(tensor)

    def predict_from_bytes(self, image_bytes: bytes) -> dict:
        import io
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)
        return self._predict_tensor(tensor)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python predict.py <model.pth> <image_path>")
        sys.exit(1)

    detector = AIImageDetector(sys.argv[1])
    result = detector.predict(sys.argv[2])

    print(f"\nResult: {result}")
    print(f"  Score: {result['score']}% chance AI-generated")
    print(f"  Label: {result['label']}")
    print(f"  Probabilities: {result['class_probabilities']}")