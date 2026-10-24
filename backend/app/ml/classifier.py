import time
import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image

from app.config import settings
from app.ml.gradcam import GradCAM

CLASSES = [
    "crazing",
    "inclusion",
    "normal",
    "patches",
    "pitted_surface",
    "rolled-in_scale",
    "scratches"
]

CLASS_DISPLAY_NAMES = {
    "crazing": "Crazing (Surface Microcracks)",
    "inclusion": "Inclusion (Non-Metallic Impurities)",
    "normal": "Normal Surface (Passed / Defect-Free)",
    "patches": "Patches (Surface Flaws / Scale Peeling)",
    "pitted_surface": "Pitted Surface (Cavities & Pits)",
    "rolled-in_scale": "Rolled-in Scale (Embedded Oxidation)",
    "scratches": "Scratches (Linear Abrasions)"
}

DEFECT_TYPE_KEYS = {
    "crazing": "CRAZING",
    "inclusion": "INCLUSION",
    "normal": "NORMAL",
    "patches": "PATCHES",
    "pitted_surface": "PITTED_SURFACE",
    "rolled-in_scale": "ROLLED_IN_SCALE",
    "scratches": "SCRATCHES"
}

class SteelInferenceEngine:
    def __init__(self, weights_path: Optional[Path] = None, head_path: Optional[Path] = None):
        self.weights_path = weights_path or settings.MODEL_WEIGHTS_PATH
        self.head_path = head_path or (settings.MODEL_WEIGHTS_PATH.parent / "steel_7class_head.pth")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_name = "MobileNetV3-Steel-Inspector"
        self.model_version = "v1.0.0-industrial"
        self.model = None
        self.grad_cam = None
        self.classes = CLASSES
        self.class_display_names = CLASS_DISPLAY_NAMES
        self.defect_type_keys = DEFECT_TYPE_KEYS
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        self._load_model()

    def _load_model(self):
        try:
            model = models.mobilenet_v3_small(weights=None)
            
            # Load backbone features
            if self.weights_path.exists():
                state_dict = torch.load(self.weights_path, map_location=self.device)
                state_dict.pop("classifier.3.weight", None)
                state_dict.pop("classifier.3.bias", None)
                model.load_state_dict(state_dict, strict=False)
                print(f"[ML Engine] Loaded backbone weights from {self.weights_path}")
            else:
                print(f"[ML Engine] WARNING: Model backbone weights not found at {self.weights_path}.")

            # Load 7-class head
            head = nn.Sequential(
                nn.Linear(1024, 256),
                nn.Hardswish(),
                nn.Linear(256, len(self.classes))
            )
            if self.head_path.exists():
                head_dict = torch.load(self.head_path, map_location=self.device)
                head.load_state_dict(head_dict)
                print(f"[ML Engine] Loaded 7-class defect classifier head from {self.head_path}")
            else:
                print(f"[ML Engine] WARNING: 7-class head weights not found at {self.head_path}.")

            model.classifier[3] = head
            model = model.to(self.device)
            model.eval()
            self.model = model

            # Setup GradCAM on the last feature layer
            self.grad_cam = GradCAM(self.model, self.model.features[-1])
        except Exception as e:
            print(f"[ML Engine] Error loading model: {e}")
            self.model = None

    def predict(self, image_path: Path) -> Dict[str, Any]:
        start_time = time.perf_counter()

        if not self.model:
            return {
                "status": "FAILED",
                "error_message": "Model weights are not loaded or engine initialization failed.",
                "model_name": self.model_name,
                "model_version": self.model_version,
                "inference_duration_ms": 0.0,
                "prediction": "UNKNOWN",
                "defect_type": "UNKNOWN",
                "defect_display_name": "Unknown",
                "confidence_score": 0.0,
                "defect_probability": 0.0,
                "class_probabilities": {},
                "heatmap_path": None
            }

        try:
            if not image_path.exists():
                return {
                    "status": "FAILED",
                    "error_message": f"Image file not found: {image_path}",
                    "model_name": self.model_name,
                    "model_version": self.model_version,
                    "inference_duration_ms": 0.0,
                    "prediction": "UNKNOWN",
                    "defect_type": "UNKNOWN",
                    "defect_display_name": "Unknown",
                    "confidence_score": 0.0,
                    "defect_probability": 0.0,
                    "class_probabilities": {},
                    "heatmap_path": None
                }

            with Image.open(image_path) as img:
                img_rgb = img.convert("RGB")
                input_tensor = self.transform(img_rgb).unsqueeze(0).to(self.device)

            input_tensor.requires_grad = True
            with torch.set_grad_enabled(True):
                logits = self.model(input_tensor)
                probs = torch.softmax(logits, dim=1)[0]
                top_idx = torch.argmax(probs).item()
                top_cls = self.classes[top_idx]
                top_prob = float(probs[top_idx].item())

            duration_ms = (time.perf_counter() - start_time) * 1000.0

            normal_idx = self.classes.index("normal")
            normal_prob = float(probs[normal_idx].item())
            is_defective = (top_cls != "normal")

            prediction = "DEFECTIVE" if is_defective else "OK"
            defect_type = self.defect_type_keys[top_cls]
            defect_display = self.class_display_names[top_cls]

            # Overall defect probability
            defect_prob = round(1.0 - normal_prob, 4) if is_defective else round(1.0 - top_prob, 4)
            confidence_score = round(top_prob, 4)

            class_probabilities = {
                c: round(float(probs[i].item()), 4)
                for i, c in enumerate(self.classes)
            }

            # Generate Grad-CAM Heatmap specifically for the top detected class
            heatmap_filename = f"cam_{image_path.stem}.jpg"
            heatmap_dest = image_path.parent / heatmap_filename
            heatmap_result = self.grad_cam.generate_heatmap(
                input_tensor,
                image_path,
                heatmap_dest,
                target_class_idx=top_idx
            )

            return {
                "status": "SUCCESS",
                "model_name": self.model_name,
                "model_version": self.model_version,
                "inference_duration_ms": round(duration_ms, 2),
                "prediction": prediction,
                "defect_type": defect_type,
                "defect_display_name": defect_display,
                "confidence_score": confidence_score,
                "defect_probability": defect_prob,
                "class_probabilities": class_probabilities,
                "heatmap_path": str(heatmap_dest.name) if heatmap_result else None,
                "error_message": None
            }
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return {
                "status": "FAILED",
                "error_message": f"Inference pipeline exception: {str(e)}",
                "model_name": self.model_name,
                "model_version": self.model_version,
                "inference_duration_ms": round(duration_ms, 2),
                "prediction": "UNKNOWN",
                "defect_type": "UNKNOWN",
                "defect_display_name": "Unknown",
                "confidence_score": 0.0,
                "defect_probability": 0.0,
                "class_probabilities": {},
                "heatmap_path": None
            }

# Global singleton and aliases
CastingInferenceEngine = SteelInferenceEngine
ml_engine = SteelInferenceEngine()
