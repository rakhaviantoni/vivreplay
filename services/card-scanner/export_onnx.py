"""
Export MobileNetV3-Small feature extractor to ONNX for faster CPU inference.
Run on the scanner VPS if `onnx` + `onnxruntime` are installed:
    python export_onnx.py
"""

import os
import torch
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights


def main() -> None:
    os.makedirs("data", exist_ok=True)
    out_path = os.path.join("data", "mobilenet_v3_small.onnx")

    model = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT)
    model.classifier = torch.nn.Identity()
    model.eval()

    dummy = torch.randn(1, 3, 224, 224)
    torch.onnx.export(
        model,
        dummy,
        out_path,
        input_names=["input"],
        output_names=["embedding"],
        dynamic_axes={"input": {0: "batch"}, "embedding": {0: "batch"}},
        opset_version=17,
    )
    print(f"Exported ONNX model to {out_path}")


if __name__ == "__main__":
    main()
