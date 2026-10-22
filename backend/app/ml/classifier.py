import time
import os
from pathlib import Path
from typing import Dict, Any, Optional
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image

from app.config import settings
from app.ml.gradcam import GradCAM

class CastingInferenceEngine:
    def __init__(self, weights_path: Optional[Path] = None):
        self.weights_path = weights_path or settings.MODEL_WEIGHTS_PATH
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_name = "MobileNetV3-Casting-Inspector"
        self.model_version = "v1.0.0-industrial"
        self.model = None
        self.grad_cam = None
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        self._load_model()

    def _load_model(self):
        try:
            model = models.mobilenet_v3_small(weights=None)
            in_features = model.classifier[3].in_features
            model.classifier[3] = nn.Linear(in_features, 1)

            if self.weights_path.exists():
                state_dict = torch.load(self.weights_path, map_location=self.device)
                model.load_state_dict(state_dict)
                print(f"[ML Engine] Loaded trained weights from {self.weights_path}")
            else:
                print(f"[ML Engine] WARNING: Model weights not found at {self.weights_path}. Running uninitialized.")

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
                "confidence_score": 0.0,
                "defect_probability": 0.0,
                "heatmap_path": None
            }

        try:
            # Verify file exists and open image
            if not image_path.exists():
                return {
                    "status": "FAILED",
                    "error_message": f"Image file not found: {image_path}",
                    "model_name": self.model_name,
                    "model_version": self.model_version,
                    "inference_duration_ms": 0.0,
                    "prediction": "UNKNOWN",
                    "confidence_score": 0.0,
                    "defect_probability": 0.0,
                    "heatmap_path": None
                }

            with Image.open(image_path) as img:
                img_rgb = img.convert("RGB")
                input_tensor = self.transform(img_rgb).unsqueeze(0).to(self.device)

            # Inference
            with torch.set_grad_enabled(True):
                # We need gradients enabled for Grad-CAM
                input_tensor.requires_grad = True
                output = self.model(input_tensor)
                defect_prob = float(torch.sigmoid(output).squeeze().item())

            duration_ms = (time.perf_counter() - start_time) * 1000.0

            prediction = "DEFECTIVE" if defect_prob >= 0.5 else "OK"
            confidence_score = defect_prob if prediction == "DEFECTIVE" else (1.0 - defect_prob)

            # Generate Grad-CAM Heatmap
            heatmap_filename = f"cam_{image_path.stem}.jpg"
            heatmap_dest = image_path.parent / heatmap_filename
            heatmap_result = self.grad_cam.generate_heatmap(input_tensor, image_path, heatmap_dest)

            return {
                "status": "SUCCESS",
                "model_name": self.model_name,
                "model_version": self.model_version,
                "inference_duration_ms": round(duration_ms, 2),
                "prediction": prediction,
                "confidence_score": round(confidence_score, 4),
                "defect_probability": round(defect_prob, 4),
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
                "confidence_score": 0.0,
                "defect_probability": 0.0,
                "heatmap_path": None
            }

# Global singleton
ml_engine = CastingInferenceEngine()
