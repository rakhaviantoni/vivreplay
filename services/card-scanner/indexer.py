"""
Offline / batch indexer for TCG card artwork.
Downloads catalog card images, generates 576-dim visual embeddings using MobileNetV3,
and saves the vector index for sub-10ms similarity search.
"""

import os
import sys
import json
import gzip
import argparse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any
import numpy as np
import cv2
from tqdm import tqdm
from matcher import CardMatcher


def download_image(url: str, cache_dir: str, card_id: str) -> str:
    """Downloads an image from URL and caches it locally."""
    if url.startswith("/"):
        url = f"https://vivreplay.com{url.replace('/small/', '/')}"

    ext = url.split("?")[0].split(".")[-1]
    if len(ext) > 4 or not ext:
        ext = "jpg"
    filename = f"{card_id}.{ext}"
    target = os.path.join(cache_dir, filename)

    if os.path.exists(target) and os.path.getsize(target) > 500:
        return target

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (CardScanner/1.0; VivrePlay)"}
    )
    with urllib.request.urlopen(req, timeout=10) as response, open(target, "wb") as f:
        f.write(response.read())

    return target


def build_index(input_json: str, output_dir: str, max_workers: int = 12):
    """
    Reads cards from input_json, downloads artworks, generates embeddings,
    and writes catalog_embeddings.npy + catalog_metadata.json.
    """
    os.makedirs(output_dir, exist_ok=True)
    cache_dir = os.path.join(output_dir, "image_cache")
    os.makedirs(cache_dir, exist_ok=True)

    if input_json.endswith(".gz"):
        with gzip.open(input_json, "rt", encoding="utf-8") as f:
            cards: List[Dict[str, Any]] = json.load(f)
    else:
        with open(input_json, "r", encoding="utf-8") as f:
            cards: List[Dict[str, Any]] = json.load(f)

    print(f"[Indexer] Loaded {len(cards)} cards from {input_json}")

    # Filter cards with valid image URLs
    valid_cards = [c for c in cards if c.get("imageUrl")]
    print(f"[Indexer] Processing {len(valid_cards)} cards with valid images...")

    matcher = CardMatcher(index_dir=output_dir)

    metadata: List[Dict[str, Any]] = []
    embeddings: List[np.ndarray] = []

    print("[Indexer] Downloading images and computing embeddings...")
    success_count = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_card = {
            executor.submit(download_image, card["imageUrl"], cache_dir, card["id"]): card
            for card in valid_cards
        }

        for future in tqdm(as_completed(future_to_card), total=len(valid_cards), desc="Indexing"):
            card = future_to_card[future]
            try:
                local_path = future.result()
                img = cv2.imread(local_path)
                if img is None:
                    continue

                emb = matcher.extract_embedding(img)
                embeddings.append(emb)
                metadata.append({
                    "id": card["id"],
                    "code": card.get("code", ""),
                    "name": card.get("name", ""),
                    "game": card.get("game", "one-piece"),
                    "setCode": card.get("setCode", ""),
                    "cardNumber": card.get("cardNumber", ""),
                    "language": card.get("language", "EN"),
                    "rarity": card.get("rarity", ""),
                    "variant": card.get("variant", "Standard"),
                    "imageUrl": card.get("imageUrl", "")
                })
                success_count += 1
            except Exception as e:
                # Skip invalid or 404 images
                continue

    if not embeddings:
        print("[Indexer] Error: No embeddings were generated.")
        return

    matrix = np.vstack(embeddings).astype(np.float32)

    emb_out = os.path.join(output_dir, "catalog_embeddings.npy")
    meta_out = os.path.join(output_dir, "catalog_metadata.json")

    np.save(emb_out, matrix)
    with open(meta_out, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"\n[Indexer] SUCCESS! Indexed {success_count} cards.")
    print(f"[Indexer] Embeddings saved to: {emb_out} ({os.path.getsize(emb_out) / 1024 / 1024:.2f} MB)")
    print(f"[Indexer] Metadata saved to: {meta_out}")


if __name__ == "__main__":
    default_input = "data/catalog_seed.json.gz" if os.path.exists("data/catalog_seed.json.gz") else "data/catalog_seed.json"
    parser = argparse.ArgumentParser(description="Build visual search index for TCG card scanner")
    parser.add_argument("--input", default=default_input, help="Path to cards catalog JSON/GZ file")
    parser.add_argument("--output", default="data", help="Output directory for index files")
    parser.add_argument("--workers", type=int, default=12, help="Parallel download workers")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Input file not found: {args.input}")
        print("Export the catalog first using: npx tsx scripts/export-catalog-for-scanner.ts")
        sys.exit(1)

    build_index(args.input, args.output, args.workers)
