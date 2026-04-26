# AI Image Detector — Custom Model

Fine-tuned ResNet18 binary classifier: **AI-generated** vs **Real** images.

## Setup (5 min)

```bash
pip install -r requirements.txt
```

You already have PyTorch 2.6.0 — the rest are tiny packages.

## Get a dataset (10 min)

Grab **CIFAKE** from Kaggle:
https://www.kaggle.com/datasets/birdy654/cifake-real-and-ai-generated-synthetic-images

Then reorganize into this structure:

```
dataset/
├── train/
│   ├── ai/       ← CIFAKE's "FAKE" images go here
│   └── real/     ← CIFAKE's "REAL" images go here
└── test/
    ├── ai/
    └── real/
```

CIFAKE already splits train/test for you — just rename the folders.

## Train (~20-30 min on GPU)

```bash
python train.py --data dataset --epochs 5 --batch-size 64
```

You'll see accuracy per epoch. It saves the best model to `ai_detector.pth`.

With CIFAKE on a decent GPU you should hit ~90%+ accuracy in 5 epochs.

## Test on a single image

```bash
python predict.py ai_detector.pth path/to/any/image.jpg
```

## Run the API server

```bash
uvicorn api:app --reload --port 8000
```

Then test it:

```bash
# Upload a file
curl -X POST http://localhost:8000/detect/image \
  -F "file=@some_image.jpg"

# Or send a URL
curl -X POST http://localhost:8000/detect/image/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/image.jpg"}'
```

Both return:
```json
{
  "score": 87.3,
  "label": "ai",
  "source": "custom-resnet18",
  "cached": false
}
```

This plugs directly into your extension's `background.ts` — just POST to
`/detect/image/url` with each `<img>` src.

## Files

| File | What it does |
|------|-------------|
| `train.py` | Training script — transfer learning on ResNet18 |
| `predict.py` | Inference class — loads model, classifies single images |
| `api.py` | FastAPI server — exposes `/detect/image` endpoints |
