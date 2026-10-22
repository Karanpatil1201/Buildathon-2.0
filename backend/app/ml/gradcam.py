import torch
import torch.nn.functional as F
import numpy as np
import cv2
from PIL import Image

class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None

        # Register hooks
        self.target_layer.register_forward_hook(self._save_activation)
        self.target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, module, input, output):
        self.activations = output

    def _save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0]

    def generate_heatmap(self, input_tensor, original_image_path, output_heatmap_path):
        self.model.eval()
        self.model.zero_grad()

        output = self.model(input_tensor)
        score = output[0, 0]
        score.backward(retain_graph=True)

        if self.gradients is None or self.activations is None:
            return None

        # Global average pooling on gradients
        weights = torch.mean(self.gradients, dim=[2, 3], keepdim=True)
        cam = torch.sum(weights * self.activations, dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = cam.squeeze().detach().cpu().numpy()

        # Normalize CAM
        if np.max(cam) - np.min(cam) > 1e-8:
            cam = (cam - np.min(cam)) / (np.max(cam) - np.min(cam))
        else:
            cam = np.zeros_like(cam)

        # Load original image for overlay
        orig_img = cv2.imread(str(original_image_path))
        if orig_img is None:
            return None

        h, w, _ = orig_img.shape
        cam_resized = cv2.resize(cam, (w, h))
        heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_INFERNO)

        # Blend
        overlay = cv2.addWeighted(orig_img, 0.6, heatmap, 0.4, 0)
        cv2.imwrite(str(output_heatmap_path), overlay)
        return str(output_heatmap_path)
