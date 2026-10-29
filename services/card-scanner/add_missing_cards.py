"""
Appends missing cards from catalog_seed.json.gz into catalog_embeddings.npy and catalog_metadata.json
"""

import os
import json
import gzip
import urllib.request
import numpy as np
import cv2
import torch
from matcher import CardMatcher


def sync_missing():
    data_dir = "data"
    emb_path = os.path.join(data_dir, "catalog_embeddings.npy")
    meta_path = os.path.join(data_dir, "catalog_metadata.json")
    seed_path = os.path.join(data_dir, "catalog_seed.json.gz")

    if not os.path.exists(emb_path) or not os.path.exists(meta_path) or not os.path.exists(seed_path):
        print("[Sync] Missing required files in data/ directory.")
        return

    matcher = CardMatcher(index_dir=data_dir)
    existing_ids = {item["id"] for item in matcher.catalog_metadata}
    print(f"[Sync] Existing indexed cards: {len(existing_ids)}")

    with gzip.open(seed_path, "rt", encoding="utf-8") as f:
        seed_cards = json.load(f)

    missing = [c for c in seed_cards if c["id"] not in existing_ids and c.get("imageUrl")]
    print(f"[Sync] Found {len(missing)} missing cards to index.")

    if not missing:
        print("[Sync] All cards are already indexed.")
        return

    new_embeddings = []
    new_metadata = []

    for card in missing:
        url = card["imageUrl"]
        if url.startswith("/"):
            url = f"https://vivreplay.com{url.replace('/small/', '/')}"

        print(f"Downloading: {card.get('name')} ({card.get('code')}) from {url}")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (CardScanner/1.0; VivrePlay)"})
            with urllib.request.urlopen(req, timeout=12) as response:
                img_bytes = response.read()
            arr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                print(f"Could not decode image for {card['id']}")
                continue

            emb = matcher.extract_embedding(img)
            new_embeddings.append(emb)
            new_metadata.append({
                "id": card["id"],
                "code": card.get("code", ""),
                "name": card.get("name", ""),
                "game": card.get("game", "one-piece"),
                "setCode": card.get("setCode", ""),
                "cardNumber": card.get("cardNumber", ""),
                "language": card.get("language", "EN"),
                "rarity": card.get("rarity", ""),
                "variant": card.get("variant", "Standard"),
                "imageUrl": url
            })
            print(f"Indexed: {card.get('name')} ({card.get('code')})")
        except Exception as err:
            print(f"Failed to index {card['id']}: {err}")

    if not new_embeddings:
        print("[Sync] No new embeddings were generated.")
        return

    updated_matrix = np.vstack([matcher.catalog_matrix, np.array(new_embeddings, dtype=np.float32)])
    updated_meta = matcher.catalog_metadata + new_metadata

    np.save(emb_path, updated_matrix)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(updated_meta, f, ensure_ascii=False)

    print(f"[Sync] Successfully added {len(new_metadata)} cards! New total: {len(updated_meta)}")


if __name__ == "__main__":
    sync_missing()
