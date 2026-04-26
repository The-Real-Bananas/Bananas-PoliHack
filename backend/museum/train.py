"""
AI Image Detector — Transfer Learning with ResNet18
=====================================================
Expects:
    dataset-3/
    ├── train/
    │   ├── ai/
    │   └── real/
    └── test/
        ├── ai/
        └── real/
"""

import os
import argparse
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models


BATCH_SIZE = 64
NUM_EPOCHS = 5
LEARNING_RATE = 1e-3
IMAGE_SIZE = 224
NUM_WORKERS = 4  # Set to 0 if it freezes on Windows


train_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(10),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

test_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def create_model() -> nn.Module:
    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    for param in model.parameters():
        param.requires_grad = False
    for param in model.layer4.parameters():
        param.requires_grad = True
    model.fc = nn.Sequential(nn.Dropout(0.3), nn.Linear(model.fc.in_features, 2))
    return model


def train_one_epoch(model, loader, criterion, optimizer, device, epoch):
    model.train()
    running_loss, correct, total = 0.0, 0, 0
    for batch_idx, (images, labels) in enumerate(loader):
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        loss = criterion(model(images), labels)
        loss.backward()
        optimizer.step()
        running_loss += loss.item()
        _, predicted = model(images).max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()
        if (batch_idx + 1) % 10 == 0:
            print(f"  Epoch {epoch+1} | Batch {batch_idx+1}/{len(loader)} | "
                  f"Loss: {loss.item():.4f} | Acc: {100.*correct/total:.1f}%")
    return running_loss / len(loader), 100. * correct / total


def evaluate(model, loader, criterion, device):
    model.eval()
    running_loss, correct, total = 0.0, 0, 0
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            running_loss += criterion(outputs, labels).item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
    return running_loss / len(loader), 100. * correct / total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=str, default="dataset-3")
    parser.add_argument("--epochs", type=int, default=NUM_EPOCHS)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--lr", type=float, default=LEARNING_RATE)
    parser.add_argument("--output", type=str, default="ai_detector.pth")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    train_dataset = datasets.ImageFolder(os.path.join(args.data, "train"), transform=train_transform)
    test_dataset  = datasets.ImageFolder(os.path.join(args.data, "test"),  transform=test_transform)

    print(f"Classes: {train_dataset.classes}")
    print(f"Training samples: {len(train_dataset)}")
    print(f"Test samples:     {len(test_dataset)}")

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True,  num_workers=NUM_WORKERS, pin_memory=True)
    test_loader  = DataLoader(test_dataset,  batch_size=args.batch_size, shuffle=False, num_workers=NUM_WORKERS, pin_memory=True)

    model = create_model().to(device)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Trainable params: {trainable:,} / {total_params:,} ({100*trainable/total_params:.1f}%)")

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam([
        {"params": model.layer4.parameters(), "lr": args.lr * 0.1},
        {"params": model.fc.parameters(),     "lr": args.lr},
    ])

    best_acc = 0.0
    for epoch in range(args.epochs):
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device, epoch)
        test_loss, test_acc   = evaluate(model, test_loader, criterion, device)
        print(f"Epoch {epoch+1}/{args.epochs} — Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.1f}% | Test Loss: {test_loss:.4f}, Test Acc: {test_acc:.1f}%")
        if test_acc > best_acc:
            best_acc = test_acc
            torch.save({"model_state_dict": model.state_dict(), "classes": train_dataset.classes, "accuracy": test_acc}, args.output)
            print(f"  → Saved best model ({test_acc:.1f}%)")

    print(f"\nDone! Best test accuracy: {best_acc:.1f}%")


if __name__ == "__main__":
    main()