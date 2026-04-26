"""
Split raw dataset into train/test folders.

Expects:
    dataset/
    ├── Ai_generated_dataset/   ← AI images
    └── real_dataset/           ← Real images

Produces:
    dataset/
    ├── train/
    │   ├── ai/
    │   └── real/
    └── test/
        ├── ai/
        └── real/

Usage:
    python split_dataset.py
    python split_dataset.py --data dataset --split 0.8
"""

import os
import shutil
import random
import argparse


def split_and_copy(src_dir: str, dst_train: str, dst_test: str, split_ratio: float):
    """Copy files from src (recursively) into train/test destinations."""
    image_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}
    files = []
    for root, _, filenames in os.walk(src_dir):
        for f in filenames:
            if os.path.splitext(f)[1].lower() in image_exts:
                files.append(os.path.join(root, f))

    random.shuffle(files)

    split_idx = int(len(files) * split_ratio)
    train_files = files[:split_idx]
    test_files = files[split_idx:]

    os.makedirs(dst_train, exist_ok=True)
    os.makedirs(dst_test, exist_ok=True)

    for filepath in train_files:
        shutil.copy2(filepath, os.path.join(dst_train, os.path.basename(filepath)))
    for filepath in test_files:
        shutil.copy2(filepath, os.path.join(dst_test, os.path.basename(filepath)))

    print(f"  {src_dir} → {len(train_files)} train, {len(test_files)} test")


def main():
    parser = argparse.ArgumentParser(description="Split dataset into train/test")
    parser.add_argument("--data", type=str, default="dataset",
                        help="Path to dataset folder")
    parser.add_argument("--split", type=float, default=0.8,
                        help="Train ratio (default 0.8 = 80%% train, 20%% test)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for reproducibility")
    args = parser.parse_args()

    random.seed(args.seed)

    ai_src = os.path.join(args.data, "ai")
    real_src = os.path.join(args.data, "real_dataset")

    if not os.path.isdir(ai_src):
        print(f"ERROR: '{ai_src}' not found")
        return
    if not os.path.isdir(real_src):
        print(f"ERROR: '{real_src}' not found")
        return

    print(f"Splitting with {args.split:.0%} train / {1-args.split:.0%} test...\n")

    split_and_copy(
        ai_src,
        os.path.join(args.data, "train", "ai"),
        os.path.join(args.data, "test", "ai"),
        args.split,
    )
    split_and_copy(
        real_src,
        os.path.join(args.data, "train", "real"),
        os.path.join(args.data, "test", "real"),
        args.split,
    )

    print("\nDone! Now run:")
    print(f"  python train.py --data {args.data}")


if __name__ == "__main__":
    main()