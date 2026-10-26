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

        self.load_index()

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
            print(f"[Matcher] Loaded {len(self.catalog_metadata)} catalog card embeddings from {self.index_dir}")
            return True
        else:
            print(f"[Matcher] No index found at {self.index_dir}. Run `python indexer.py` to build.")
            return False

    @torch.no_grad()
    def extract_embedding(self, card_bgr: np.ndarray) -> np.ndarray:
        """Computes a normalized 576-dimensional embedding vector from a BGR card image."""
        card_rgb = cv2.cvtColor(card_bgr, cv2.COLOR_BGR2RGB)
        tensor = self.transform(card_rgb).unsqueeze(0).to(self.device)
        features = self.model(tensor).squeeze(0).cpu().numpy()
        # L2 normalization for cosine similarity via dot product
        norm = np.linalg.norm(features)
        if norm > 1e-6:
            features = features / norm
        return features

    def search(self, query_img: np.ndarray, top_k: int = 5, game: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Extracts embedding from query card and finds the closest matching cards.
        Returns top matches sorted by cosine similarity score.
        """
        if self.catalog_matrix is None or len(self.catalog_metadata) == 0:
            return []

        query_vec = self.extract_embedding(query_img)  # (576,)

        # Filter by game if specified
        if game in ("pokemon", "one-piece"):
            indices = [i for i, m in enumerate(self.catalog_metadata) if m.get("game") == game]
            if not indices:
                indices = list(range(len(self.catalog_metadata)))
            subset_matrix = self.catalog_matrix[indices]
            scores = np.dot(subset_matrix, query_vec)
            top_sub_idx = np.argsort(-scores)[:top_k]

            results = []
            for rank, sub_i in enumerate(top_sub_idx):
                idx = indices[sub_i]
                meta = self.catalog_metadata[idx]
                score = float(scores[sub_i])
                results.append({
                    "card": meta,
                    "score": round(score, 4),
                    "confidence": round(score, 4),
                    "rank": rank + 1
                })
            return results
        else:
            scores = np.dot(self.catalog_matrix, query_vec)
            top_indices = np.argsort(-scores)[:top_k]

            results = []
            for rank, idx in enumerate(top_indices):
                meta = self.catalog_metadata[idx]
                score = float(scores[idx])
                results.append({
                    "card": meta,
                    "score": round(score, 4),
                    "confidence": round(score, 4),
                    "rank": rank + 1
                })
            return results
