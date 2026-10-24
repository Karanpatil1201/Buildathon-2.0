"""
Steel Surface Domain and Out-of-Distribution Validation Gate
============================================================
Protects the Steel-IQ / ForgeSight AI steel defect inspection pipeline
against false-acceptance of non-steel images (faces, animals, random pictures,
concrete, wood, wallpaper, random noise, etc.).

Ensures authentic steel surface images (crazing, inclusion, patches,
pitted surface, rolled-in scale, scratches, and normal steel) are accepted,
while out-of-distribution non-steel images are rejected with HTTP 422.
"""

import numpy as np
from pathlib import Path
from PIL import Image
from typing import Tuple, Dict, Any, Optional
import torch

BASE_DIR = Path(__file__).resolve().parent
REFERENCE_FILE = BASE_DIR / "weights" / "steel_domain_reference.npz"


class SteelDomainGate:
    def __init__(self, reference_path: Optional[Path] = None):
        self.reference_path = reference_path or REFERENCE_FILE
        self.is_loaded = False

        # Optical Sanity Limits tailored for Steel Surfaces
        self.MIN_BRIGHTNESS = 20.0
        self.MAX_BRIGHTNESS = 250.0
        self.MIN_CONTRAST = 5.0
        self.MIN_LAPLACIAN_VAR = 8.0
        self.MAX_LAPLACIAN_VAR = 15000.0

        # Subspace & Feature Manifold Thresholds
        # Genuine steel surface residual norm is <= 14.18 (mean ~7.0); non-steel is >= 21.0
        self.RESIDUAL_THRESHOLD = 16.0
        self.KNN_THRESHOLD = 85.0

        self._load_reference()

    def _load_reference(self):
        if not self.reference_path.exists():
            print(f"[Domain Gate] Warning: Reference file not found: {self.reference_path}")
            return

        try:
            data = np.load(self.reference_path)
            self.mean = data["mean"]
            self.V_k = data["V_k"]
            self.inv_std = data["inv_std"]
            self.train_features = data["train_features"]
            self.residual_threshold = float(data.get("residual_threshold", self.RESIDUAL_THRESHOLD))
            self.is_loaded = True
            print(f"[Domain Gate] Initialized steel surface manifold gate with {len(self.train_features)} reference samples (Threshold: {self.residual_threshold})")
        except Exception as e:
            print(f"[Domain Gate] Error loading reference: {e}")

    def check_optical_sanity(self, pil_img: Image.Image) -> Tuple[bool, Optional[str], Optional[str], Dict[str, Any]]:
        gray = pil_img.convert("L")
        arr = np.array(gray, dtype=np.float32)

        mean_val = float(np.mean(arr))
        std_val = float(np.std(arr))

        # 3x3 Laplacian edge sharpness
        lap = (arr[:-2, 1:-1] + arr[2:, 1:-1] + arr[1:-1, :-2] + arr[1:-1, 2:] - 4.0 * arr[1:-1, 1:-1])
        lap_var = float(np.var(lap))

        metrics = {
            "mean_luminance": round(mean_val, 2),
            "contrast_std": round(std_val, 2),
            "laplacian_variance": round(lap_var, 2)
        }

        if mean_val < self.MIN_BRIGHTNESS:
            return False, "EXTREME_LIGHTING", f"Image is severely underexposed (luminance {mean_val:.1f} below minimum {self.MIN_BRIGHTNESS}).", metrics
        if mean_val > self.MAX_BRIGHTNESS:
            return False, "EXTREME_LIGHTING", f"Image is overexposed or washed out (luminance {mean_val:.1f} above maximum {self.MAX_BRIGHTNESS}).", metrics
        if std_val < self.MIN_CONTRAST:
            return False, "LOW_CONTRAST", f"Image has insufficient surface contrast (std {std_val:.1f} below minimum {self.MIN_CONTRAST}).", metrics
        if lap_var < self.MIN_LAPLACIAN_VAR:
            return False, "SEVERE_BLUR", f"Image is out of focus or excessively blurred (Laplacian variance {lap_var:.1f} below minimum {self.MIN_LAPLACIAN_VAR}).", metrics
        if lap_var > self.MAX_LAPLACIAN_VAR:
            return False, "EXCESSIVE_HIGH_FREQUENCY", f"Image contains abnormal high-frequency noise or non-steel pattern (Laplacian variance {lap_var:.1f} exceeds {self.MAX_LAPLACIAN_VAR}).", metrics

        return True, None, "OPTICAL_VALID", metrics

    def validate_image(self, image_path: Path, ml_engine) -> Tuple[bool, Optional[str], Optional[str], Dict[str, Any]]:
        if not image_path.exists():
            return False, "FILE_NOT_FOUND", "Image file does not exist.", {}

        try:
            with Image.open(image_path) as img:
                img_rgb = img.convert("RGB")
                ok_opt, opt_code, opt_reason, opt_metrics = self.check_optical_sanity(img_rgb)
                if not ok_opt:
                    return False, opt_code, opt_reason, {"optical": opt_metrics}

            if not self.is_loaded or not ml_engine or not ml_engine.model:
                return True, None, "GATE_UNINITIALIZED", {"optical": opt_metrics}

            # Extract 1024-D penultimate features
            tensor = ml_engine.transform(img_rgb).unsqueeze(0).to(ml_engine.device)
            with torch.no_grad():
                f = ml_engine.model.features(tensor)
                f = ml_engine.model.avgpool(f)
                f = torch.flatten(f, 1)
                f = ml_engine.model.classifier[0](f)
                f = ml_engine.model.classifier[1](f)
                feat = ml_engine.model.classifier[2](f).squeeze(0).cpu().numpy()

            centered = feat - self.mean
            proj = centered.dot(self.V_k).dot(self.V_k.T)
            residual = centered - proj
            res_norm = float(np.linalg.norm(residual))

            # PCA Mahalanobis distance
            pca_scaled = centered.dot(self.V_k) * self.inv_std
            pca_mah = float(np.linalg.norm(pca_scaled))

            # Nearest neighbor distance
            knn_dist = float(np.min(np.linalg.norm(self.train_features - feat, axis=1)))

            diagnostics = {
                "optical": opt_metrics,
                "residual_norm": round(res_norm, 4),
                "residual_threshold": self.residual_threshold,
                "mahalanobis_distance": round(pca_mah, 2),
                "knn_distance": round(knn_dist, 2),
                "decision": "ACCEPTED" if res_norm <= self.residual_threshold else "REJECTED_OOD"
            }

            if res_norm > self.residual_threshold:
                return False, "OUT_OF_DOMAIN_FEATURE", (
                    f"Input image feature embedding lies outside authentic steel surface manifold "
                    f"(Residual norm {res_norm:.2f} exceeds threshold {self.residual_threshold:.1f})."
                ), diagnostics

            return True, None, "SUPPORTED_DOMAIN", diagnostics

        except Exception as e:
            return False, "VALIDATION_ERROR", f"Domain validation error: {str(e)}", {}


domain_gate = SteelDomainGate()
