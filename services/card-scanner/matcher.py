"""
Visual feature extractor and fast vector matching engine.
Uses a lightweight MobileNetV3 / ResNet model to extract 512-dim visual embeddings
and performs sub-5ms cosine similarity search across catalog cards.
"""

import os
import json
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import cv2
import torch
import torchvision.transforms as T
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights


class CardMatcher:
    def __init__(self, index_dir: str = "data"):
        self.index_dir = index_dir
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Load MobileNetV3-Small feature extractor
        weights = MobileNet_V3_Small_Weights.DEFAULT
        model = mobilenet_v3_small(weights=weights)
        # Replace classifier with Identity to get feature embedding (576 dims)
        model.classifier = torch.nn.Identity()
        model.eval()
        self.model = model.to(self.device)

        self.transform = T.Compose([
            T.ToPILImage(),
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

        self.catalog_matrix: Optional[np.ndarray] = None  # Shape: (N, 576)
        self.catalog_metadata: List[Dict[str, Any]] = []
        self.matrices_by_game: Dict[str, Tuple[np.ndarray, List[Dict[str, Any]]]] = {}
        self.onnx_session = None
        self.onnx_input_name: Optional[str] = None

        self._try_load_onnx()
        self.load_index()

    def _try_load_onnx(self) -> None:
        """Uses ONNX Runtime when exported model + package are present; otherwise falls back to PyTorch."""
        onnx_path = os.path.join(self.index_dir, "mobilenet_v3_small.onnx")
        if not os.path.exists(onnx_path):
            return
        try:
            import onnxruntime as ort  # type: ignore
            self.onnx_session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
            self.onnx_input_name = self.onnx_session.get_inputs()[0].name
            print(f"[Matcher] Loaded ONNX Runtime model from {onnx_path}")
        except Exception as exc:
            self.onnx_session = None
            self.onnx_input_name = None
            print(f"[Matcher] ONNX load skipped ({exc}); using PyTorch")

    def load_index(self) -> bool:
        """Loads precomputed catalog embeddings and metadata if available."""
        emb_path = os.path.join(self.index_dir, "catalog_embeddings.npy")
        meta_path = os.path.join(self.index_dir, "catalog_metadata.json")

        if os.path.exists(emb_path) and os.path.exists(meta_path):
            self.catalog_matrix = np.load(emb_path).astype(np.float32)
            with open(meta_path, "r", encoding="utf-8") as f:
                raw_meta = json.load(f)
                for item in raw_meta:
                    if str(item.get("cardNumber", "")).startswith("CT-"):
                        item["cardNumber"] = ""
                self.catalog_metadata = raw_meta

            # Pre-slice per-game matrices so search() never copies slices per request.
            self.matrices_by_game = {}
            for game_key in ("pokemon", "one-piece"):
                indices = [i for i, m in enumerate(self.catalog_metadata) if m.get("game") == game_key]
                if indices:
                    self.matrices_by_game[game_key] = (
                        np.ascontiguousarray(self.catalog_matrix[indices]),
                        [self.catalog_metadata[i] for i in indices],
                    )

            print(f"[Matcher] Loaded {len(self.catalog_metadata)} catalog card embeddings from {self.index_dir}")
            return True
        else:
            print(f"[Matcher] No index found at {self.index_dir}. Run `python indexer.py` to build.")
            return False

    @torch.no_grad()
    def extract_embeddings_batch(self, cards_bgr: List[np.ndarray]) -> np.ndarray:
        """Computes L2-normalized 576-dim embedding vectors for a batch of BGR card images."""
        if not cards_bgr:
            return np.empty((0, 576), dtype=np.float32)
        tensors = [self.transform(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)) for img in cards_bgr]
        batch_tensor = torch.stack(tensors, dim=0)
        if self.onnx_session is not None and self.onnx_input_name is not None:
            features = self.onnx_session.run(None, {self.onnx_input_name: batch_tensor.numpy()})[0]
        else:
            features = self.model(batch_tensor.to(self.device)).cpu().numpy()
        norms = np.linalg.norm(features, axis=1, keepdims=True)
        norms = np.where(norms > 1e-6, norms, 1.0)
        return (features / norms).astype(np.float32)

    def extract_embedding(self, card_bgr: np.ndarray) -> np.ndarray:
        """Computes a normalized 576-dimensional embedding vector from a BGR card image."""
        return self.extract_embeddings_batch([card_bgr])[0]

    def search_batch(self, query_imgs: List[np.ndarray], top_k: int = 5, game: Optional[str] = None) -> List[List[Dict[str, Any]]]:
        """Runs a single batched embedding pass + matrix multiply for one or more query images."""
        if not query_imgs or self.catalog_matrix is None or len(self.catalog_metadata) == 0:
            return [[] for _ in query_imgs]

        if game in self.matrices_by_game:
            matrix, metadata = self.matrices_by_game[game]
        else:
            matrix, metadata = self.catalog_matrix, self.catalog_metadata

        query_vecs = self.extract_embeddings_batch(query_imgs)  # (B, 576)
        scores_matrix = np.dot(query_vecs, matrix.T)  # (B, N)
        k = min(top_k, len(metadata))

        batch_results: List[List[Dict[str, Any]]] = []
        for row_scores in scores_matrix:
            top_indices = np.argsort(-row_scores)[:k]
            results: List[Dict[str, Any]] = []
            for rank, idx in enumerate(top_indices):
                score = float(row_scores[idx])
                results.append({
                    "card": metadata[idx],
                    "score": round(score, 4),
                    "confidence": round(score, 4),
                    "rank": rank + 1,
                })
            batch_results.append(results)
        return batch_results

    def search(self, query_img: np.ndarray, top_k: int = 5, game: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Extracts embedding from query card and finds the closest matching cards.
        Returns top matches sorted by cosine similarity score.
        """
        return self.search_batch([query_img], top_k=top_k, game=game)[0]
