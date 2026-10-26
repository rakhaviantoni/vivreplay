"""
Quick utility to update catalog_metadata.json with clean card numbers from catalog_seed.json.gz
without having to re-compute visual embeddings.
"""

import os
import json
import gzip

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(os.path.join(DATA_DIR, "data")):
    DATA_DIR = os.path.join(DATA_DIR, "data")
else:
    DATA_DIR = os.path.join(DATA_DIR, "data")

seed_file = os.path.join(DATA_DIR, "catalog_seed.json.gz")
if not os.path.exists(seed_file):
    seed_file = os.path.join(DATA_DIR, "catalog_seed.json")

meta_file = os.path.join(DATA_DIR, "catalog_metadata.json")

if not os.path.exists(seed_file):
    print(f"Error: {seed_file} not found")
    exit(1)

if not os.path.exists(meta_file):
    print(f"Error: {meta_file} not found")
    exit(1)

print(f"Loading seed from {seed_file}...")
if seed_file.endswith(".gz"):
    with gzip.open(seed_file, "rt", encoding="utf-8") as f:
        seed_cards = json.load(f)
else:
    with open(seed_file, "r", encoding="utf-8") as f:
        seed_cards = json.load(f)

card_map = {c["id"]: c.get("cardNumber", "") for c in seed_cards}

print(f"Loading existing metadata from {meta_file}...")
with open(meta_file, "r", encoding="utf-8") as f:
    metadata = json.load(f)

updated = 0
for item in metadata:
    card_id = item.get("id")
    if card_id in card_map:
        new_num = card_map[card_id]
        if item.get("cardNumber") != new_num:
            item["cardNumber"] = new_num
            updated += 1
    elif str(item.get("cardNumber", "")).startswith("CT-"):
        item["cardNumber"] = ""
        updated += 1

with open(meta_file, "w", encoding="utf-8") as f:
    json.dump(metadata, f, ensure_ascii=False)

print(f"Successfully updated {updated} card numbers in {meta_file}!")
