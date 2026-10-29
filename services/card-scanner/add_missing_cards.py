"""
Appends missing cards from catalog_seed.json.gz into catalog_embeddings.npy and catalog_metadata.json
"""

import os
import json
import gzip
import urllib.request
import urllib.error
import numpy as np
import cv2
import torch
from matcher import CardMatcher


def resolve_image_candidates(card):
    url = card.get("imageUrl") or ""
    if url.startswith("/"):
        url = f"https://vivreplay.com{url.replace('/small/', '/')}"

    candidates = [url] if url else []

    code = card.get("code", "").strip()
    set_code = card.get("setCode", "").strip()
    lang = (card.get("language") or "en").lower()

    # One Piece alternatives for cards with stale promotional/limited URLs
    if card.get("game") == "one-piece" or (set_code and set_code.startswith("OP")):
        if set_code and code:
            candidates.extend([
                f"https://cards.oplaytcg.com/{set_code}/{lang}/{code}.webp",
                f"https://cards.oplaytcg.com/{set_code}/{lang}/small/{code}.webp",
                f"https://cards.oplaytcg.com/{set_code}/{lang}/small/{code}_p1.webp",
                f"https://cards.oplaytcg.com/{set_code}/{lang}/small/{code}_p2.webp",
                f"https://cards.oplaytcg.com/{set_code}/{lang}/small/{code}_p3.webp",
            ])

    # Pokemon alternatives for TCGDex assets
    if "assets.tcgdex.net" in url:
        candidates.extend([
            url.replace("/high.webp", "/low.webp"),
            url.replace("/high.webp", ".webp"),
            url.replace("/high.webp", ".png"),
        ])
    if card.get("game") == "pokemon" and set_code and card.get("cardNumber"):
        clean_num = card["cardNumber"].split("/")[0].strip()
        candidates.extend([
            f"https://images.pokemontcg.io/{set_code.lower()}/{clean_num}_hires.png",
            f"https://images.pokemontcg.io/{set_code.lower()}/{clean_num}.png",
        ])

    # Platform asset fallback
    card_id = card.get("id")
    if card_id:
        candidates.append(f"https://vivreplay.com/api/card-assets/{card_id}")

    # Deduplicate while preserving order
    seen = set()
    result = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            result.append(c)
    return result


def fetch_card_image(card):
    candidates = resolve_image_candidates(card)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
    }

    for url in candidates:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as response:
                if response.status != 200:
                    continue
                img_bytes = response.read()

            if not img_bytes or len(img_bytes) < 100:
                continue

            # Automatically decompress gzip if server compressed response
            if img_bytes[:2] == b'\x1f\x8b':
                try:
                    img_bytes = gzip.decompress(img_bytes)
                except Exception:
                    pass

            arr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is not None and img.size > 0:
                return img, url
        except Exception:
            continue

    return None, None


def sync_missing():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "data")
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
        print(f"Downloading: {card.get('name')} ({card.get('code')})...")
        try:
            img, successful_url = fetch_card_image(card)
            if img is None:
                print(f"Could not download or decode image for {card.get('name')} ({card.get('code')}) [{card['id']}]")
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
                "imageUrl": successful_url
            })
            print(f"Indexed: {card.get('name')} ({card.get('code')}) via {successful_url}")
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
