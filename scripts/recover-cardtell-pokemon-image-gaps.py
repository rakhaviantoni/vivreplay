#!/usr/bin/env python3
"""Attach exact Cardtell images to Indonesian printings when name, number, and set family agree."""
import argparse
import glob
import json
import re
import sqlite3
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/129855bc08bf1d2e48ada2640c897d48cb9d17aeb5bfc86a259e33d119dbe76f.sqlite"
DEFAULT_CACHE = Path("/private/var/folders/9t/_bjml0555c1bzywt6lr0zy740000gn/T/vivreplay-cardtell-pokemon-id")


def normalize(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", ascii_value)


def description_number(value: object) -> str | None:
    match = re.search(r"\b(\d{1,4})\s*/\s*\d{1,4}\b", str(value or ""))
    return str(int(match.group(1))) if match else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="update local D1; default is preview")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    args = parser.parse_args()
    if not args.db.exists() or not args.cache.exists():
        raise SystemExit("Local D1 or Cardtell catalog cache was not found.")

    products: dict[int, dict] = {}
    for filename in glob.glob(str(args.cache / "*.json")):
        try:
            response = json.loads(Path(filename).read_text())
        except (OSError, json.JSONDecodeError):
            continue
        for product in response.get("results", []):
            if isinstance(product, dict) and isinstance(product.get("id"), int) and product.get("name"):
                products[product["id"]] = product

    by_name_number: dict[tuple[str, str], list[dict]] = {}
    for product in products.values():
        number = description_number(product.get("description")) or description_number(product.get("shortDescription"))
        if number:
            by_name_number.setdefault((normalize(product["name"]), number), []).append(product)

    connection = sqlite3.connect(args.db, timeout=30)
    connection.row_factory = sqlite3.Row
    rows = connection.execute("""
        SELECT p.id,p.set_code,p.printing_code,p.source_payload,p.card_image_url,i.name,
               CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.name') ELSE NULL END AS localized_name
        FROM tcg_card_printings p
        JOIN tcg_card_identities i ON i.id=p.identity_id
        JOIN tcg_games g ON g.id=i.game_id
        LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small'
        WHERE g.slug='pokemon' AND p.language='ID' AND a.id IS NULL
          AND NULLIF(p.card_image_url,'') IS NULL
    """).fetchall()
    jobs = []
    ambiguous = []
    for row in rows:
        number_match = re.search(r"\d{1,4}", row["printing_code"] or "")
        set_match = re.match(r"([A-Z0-9]+)", (row["set_code"] or "").upper())
        number = str(int(number_match.group())) if number_match else None
        set_prefix = set_match.group(1) if set_match else ""
        key = (normalize(row["localized_name"] or row["name"] or ""), number or "")
        candidates = by_name_number.get(key, [])
        compatible = [item for item in candidates
                      if set_prefix and re.match(r"([A-Z0-9]+)", str(item.get("shortDescription", "")).upper())
                      and set_prefix.startswith(re.match(r"([A-Z0-9]+)", str(item.get("shortDescription", "")).upper()).group(1))
                      and len(re.match(r"([A-Z0-9]+)", str(item.get("shortDescription", "")).upper()).group(1)) >= 3]
        if len(compatible) == 1:
            product = compatible[0]
            image = product.get("image", "")
            match = re.fullmatch(r"/images/products/(\d{1,12})\.png(?:\?[^#]*)?", image)
            if match:
                jobs.append({"printing_id": row["id"], "set_code": row["set_code"], "number": row["printing_code"],
                             "name": row["localized_name"] or row["name"], "cardtell_id": int(match.group(1)),
                             "image_url": f"https://cardtell.id/images/products/{match.group(1)}.png"})
        elif candidates:
            ambiguous.append({"printing": row["set_code"] + "-" + str(row["printing_code"]), "name": key[0], "candidates": len(compatible)})

    print(json.dumps({"mode": "apply" if args.apply else "preview", "missing_image_printings": len(rows),
                      "unique_matches": len(jobs), "unmatched_or_ambiguous": len(rows) - len(jobs),
                      "examples": jobs[:12], "ambiguous_examples": ambiguous[:12]}, ensure_ascii=False, indent=2))
    if args.apply and jobs:
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.executemany("UPDATE tcg_card_printings SET card_image_url=? WHERE id=? AND language='ID' AND NULLIF(card_image_url,'') IS NULL",
                                   [(job["image_url"], job["printing_id"]) for job in jobs])
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        print(f"Attached {len(jobs)} exact Cardtell image sources. Images are served through VivrePlay's Pokémon art route and cached in R2 on request.")
    connection.close()


if __name__ == "__main__":
    main()
