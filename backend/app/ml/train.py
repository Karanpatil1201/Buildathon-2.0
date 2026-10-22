import os
import json
import shutil
import time
from pathlib import Path
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms, models
from PIL import Image

DATASET_ROOT = Path(r"C:\Users\saura\.cache\kagglehub\datasets\ravirajsinh45\real-life-industrial-dataset-of-casting-product\versions\2\casting_data\casting_data")
OUTPUT_DIR = Path(__file__).parent / "weights"
SAMPLES_DIR = Path(__file__).parent.parent / "storage" / "eval_samples"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

class CastingDataset(Dataset):
    def __init__(self, items, transform=None):
        self.items = items
        self.transform = transform

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        path, label = self.items[idx]
        image = Image.open(path).convert("RGB")
        if self.transform:
            image = self.transform(image)
        return image, torch.tensor(label, dtype=torch.float32)

def collect_items(root_dir, max_per_class=None):
    def_dir = root_dir / "def_front"
    ok_dir = root_dir / "ok_front"

    def_files = sorted(list(def_dir.glob("*.jpeg")) + list(def_dir.glob("*.png")) + list(def_dir.glob("*.jpg")))
    ok_files = sorted(list(ok_dir.glob("*.jpeg")) + list(ok_dir.glob("*.png")) + list(ok_dir.glob("*.jpg")))

    if max_per_class:
        def_files = def_files[:max_per_class]
        ok_files = ok_files[:max_per_class]

    # Label: 1.0 for defective, 0.0 for ok
    items = [(f, 1.0) for f in def_files] + [(f, 0.0) for f in ok_files]
    return items, len(def_files), len(ok_files)

def build_model():
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    # Binary classification head: single logit for defective probability
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, 1)
    return model

def train_and_evaluate():
    print("Preparing datasets...")
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    train_items, n_train_def, n_train_ok = collect_items(DATASET_ROOT / "train", max_per_class=1000)
    test_items, n_test_def, n_test_ok = collect_items(DATASET_ROOT / "test")

    print(f"Train samples: {len(train_items)} ({n_train_def} Defective, {n_train_ok} OK)")
    print(f"Test samples: {len(test_items)} ({n_test_def} Defective, {n_test_ok} OK)")

    train_loader = DataLoader(CastingDataset(train_items, train_transform), batch_size=32, shuffle=True)
    test_loader = DataLoader(CastingDataset(test_items, val_transform), batch_size=32, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on device: {device}")

    model = build_model().to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=2, gamma=0.5)

    epochs = 3
    start_time = time.time()
    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in train_loader:
            images = images.to(device)
            labels = labels.to(device).unsqueeze(1)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            preds = (torch.sigmoid(outputs) >= 0.5).float()
            correct += (preds == labels).sum().item()
            total += labels.size(0)

        scheduler.step()
        train_loss = running_loss / total
        train_acc = correct / total
        print(f"Epoch {epoch}/{epochs} | Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:.2f}%")

    training_time = time.time() - start_time
    print(f"Training finished in {training_time:.2f} seconds.")

    # Save model weights
    weights_path = OUTPUT_DIR / "casting_mobilenet_v3.pth"
    torch.save(model.state_dict(), weights_path)
    print(f"Model saved to {weights_path}")

    # Evaluate on held-out test split
    print("Evaluating on held-out test set...")
    model.eval()
    all_preds = []
    all_labels = []
    all_scores = []

    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            scores = torch.sigmoid(outputs).squeeze(1).cpu().tolist()
            preds = [1 if s >= 0.5 else 0 for s in scores]
            all_scores.extend(scores)
            all_preds.extend(preds)
            all_labels.extend(labels.cpu().tolist())

    # Compute confusion matrix & metrics
    tp = sum(1 for p, l in zip(all_preds, all_labels) if p == 1 and l == 1.0)
    tn = sum(1 for p, l in zip(all_preds, all_labels) if p == 0 and l == 0.0)
    fp = sum(1 for p, l in zip(all_preds, all_labels) if p == 1 and l == 0.0)
    fn = sum(1 for p, l in zip(all_preds, all_labels) if p == 0 and l == 1.0)

    total_test = len(all_labels)
    accuracy = (tp + tn) / total_test if total_test > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    metrics = {
        "model_architecture": "MobileNetV3-Small (Fine-tuned for Casting Quality Inspection)",
        "dataset": "Real-life Industrial Casting Product Dataset",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "classes": {"0": "OK (Passed)", "1": "Defective (Failed)"},
        "train_counts": {"defective": n_train_def, "ok": n_train_ok, "total": len(train_items)},
        "test_counts": {"defective": n_test_def, "ok": n_test_ok, "total": total_test},
        "confusion_matrix": {
            "true_positive": tp,
            "true_negative": tn,
            "false_positive": fp,
            "false_negative": fn
        },
        "metrics": {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4)
        },
        "training_duration_seconds": round(training_time, 2)
    }

    metrics_path = OUTPUT_DIR / "eval_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Evaluation metrics saved to {metrics_path}")
    print(f"Results: Accuracy={accuracy*100:.2f}%, Precision={precision*100:.2f}%, Recall={recall*100:.2f}%, F1={f1*100:.2f}%")
    print(f"Confusion Matrix: TP={tp}, TN={tn}, FP={fp}, FN={fn}")

    # Copy representative evaluation sample images
    def_samples = [item[0] for item in test_items if item[1] == 1.0][:6]
    ok_samples = [item[0] for item in test_items if item[1] == 0.0][:6]

    sample_manifest = []
    for idx, sample_path in enumerate(def_samples, 1):
        target_name = f"eval_sample_defective_{idx:02d}.jpeg"
        target_path = SAMPLES_DIR / target_name
        shutil.copy(sample_path, target_path)
        sample_manifest.append({
            "filename": target_name,
            "ground_truth": "DEFECTIVE",
            "source": str(sample_path.name),
            "description": f"Industrial casting with surface defect (Sample {idx})"
        })

    for idx, sample_path in enumerate(ok_samples, 1):
        target_name = f"eval_sample_ok_{idx:02d}.jpeg"
        target_path = SAMPLES_DIR / target_name
        shutil.copy(sample_path, target_path)
        sample_manifest.append({
            "filename": target_name,
            "ground_truth": "OK",
            "source": str(sample_path.name),
            "description": f"Industrial casting with flawless surface (Sample {idx})"
        })

    with open(SAMPLES_DIR / "samples_manifest.json", "w") as f:
        json.dump(sample_manifest, f, indent=2)
    print(f"Saved {len(sample_manifest)} evaluation sample images to {SAMPLES_DIR}")

if __name__ == "__main__":
    train_and_evaluate()
