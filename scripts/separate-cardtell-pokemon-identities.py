#!/usr/bin/env python3
"""Give Indonesian Pokémon printings their own identities without changing other languages."""
import argparse
import hashlib
import json
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/129855bc08bf1d2e48ada2640c897d48cb9d17aeb5bfc86a259e33d119dbe76f.sqlite"


def stable_id(key: str) -> str:
    value = bytearray(hashlib.sha256(f"vivreplay:cardtell-pokemon-id:{key}".encode()).digest()[:16])
    value[6] = (value[6] & 0x0F) | 0x50
    value[8] = (value[8] & 0x3F) | 0x80
    raw = value.hex()
    return f"{raw[:8]}-{raw[8:12]}-{raw[12:16]}-{raw[16:20]}-{raw[20:]}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write the repair; default is preview only")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="local D1 SQLite file")
    args = parser.parse_args()
    if not args.db.exists():
        raise SystemExit(f"Local catalog not found: {args.db}")

    connection = sqlite3.connect(args.db, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=30000")
    rows = connection.execute("""
        SELECT p.id,p.identity_id AS old_identity_id,i.game_id,i.code AS old_code,i.name AS old_name,
               i.color,i.card_type,i.cost,i.power,i.effect_text,p.source_payload,p.source_kind,
               p.set_code,p.set_name,p.printing_code,l.name AS localized_name,
               l.effect_text AS localized_effect,l.traits_text AS localized_traits,
               r.colors AS rule_colors,r.counter_amount AS rule_counter,r.attributes AS rule_attributes,
               r.traits AS rule_traits,r.rules_revision AS rule_revision,r.life AS rule_life
        FROM tcg_card_printings p
        JOIN tcg_card_identities i ON i.id=p.identity_id
        JOIN tcg_games g ON g.id=i.game_id
        LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language='ID'
        LEFT JOIN tcg_card_rules r ON r.identity_id=i.id
        WHERE g.slug='pokemon' AND p.language='ID'
          AND EXISTS (SELECT 1 FROM tcg_card_printings other
                      WHERE other.identity_id=p.identity_id AND other.language!='ID')
        ORDER BY p.id
    """).fetchall()
    records = []
    for row in rows:
        payload = json.loads(row["source_payload"])
        cardtell_id = str(payload.get("cardtellId", ""))
        name = str(row["localized_name"] or payload.get("name") or row["old_name"] or "").strip()
        if row["source_kind"] == "cardtell" and not cardtell_id.isdigit():
            raise SystemExit(f"Missing Cardtell product ID for printing {row['id']}")
        if not name:
            raise SystemExit(f"Missing Indonesian card name for printing {row['id']}")
        identity_code = (f"PK-CT-{cardtell_id}" if row["source_kind"] == "cardtell" else
                         f"PK-ID-{row['set_code']}-{row['printing_code']}-{row['id'][:4].upper()}")
        record = dict(row)
        record.update(payload=payload, cardtell_id=cardtell_id, name=name,
                      identity_code=identity_code,
                      identity_id=stable_id(f"identity:{cardtell_id}" if row["source_kind"] == "cardtell" else f"identity:indonesian-printing:{row['id']}"),
                      card_type=str(payload.get("category") or row["card_type"] or "Pokémon"),
                      effect_text=str(row["localized_effect"] if row["localized_effect"] is not None else row["effect_text"] or ""),
                      traits_text=str(row["localized_traits"] or row["card_type"] or ""))
        records.append(record)

    if len({row["identity_id"] for row in records}) != len(records) or len({row["identity_code"] for row in records}) != len(records):
        raise SystemExit("Duplicate target identity IDs or codes found; no changes made.")
    for row in records:
        collision = connection.execute("SELECT 1 FROM tcg_card_identities WHERE game_id=? AND code=? LIMIT 1",
                                       (row["game_id"], row["identity_code"])).fetchone()
        if collision:
            raise SystemExit(f"Target identity already exists: {row['identity_code']}; no changes made.")
        collision = connection.execute("SELECT 1 FROM tcg_card_identities WHERE id=? LIMIT 1", (row["identity_id"],)).fetchone()
        if collision:
            raise SystemExit(f"Target identity ID already exists for {row['identity_code']}; no changes made.")

    print(json.dumps({"mode": "apply" if args.apply else "preview", "printings_to_separate": len(records),
                      "examples": [{"set": row["set_code"], "number": row["printing_code"],
                                    "previous_identity": row["old_code"], "indonesian_card": row["name"],
                                    "new_identity": row["identity_code"]} for row in records[:8]],
                      "database": str(args.db)}, ensure_ascii=False, indent=2))
    if not args.apply or not records:
        connection.close()
        return

    backup = Path(tempfile.gettempdir()) / f"vivreplay-d1-before-cardtell-identity-repair-{datetime.now().strftime('%Y%m%d-%H%M%S')}.sqlite"
    backup_db = sqlite3.connect(backup)
    connection.backup(backup_db)
    backup_db.close()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.executemany("""
            INSERT INTO tcg_card_identities
              (id,game_id,code,name,color,card_type,cost,power,effect_text,created_at,updated_at)
            VALUES (:identity_id,:game_id,:identity_code,:name,'Colorless',:card_type,0,0,'',:created_at,:updated_at)
        """, [{**row, "created_at": now, "updated_at": now} for row in records])
        connection.executemany("""
            INSERT INTO tcg_card_localizations
              (identity_id,language,name,effect_text,traits_text,source_record_id,updated_at)
            VALUES (:identity_id,'ID',:name,'',:card_type,NULL,:updated_at)
        """, [{**row, "updated_at": now} for row in records])
        connection.executemany("""
            INSERT INTO tcg_card_rules
              (identity_id,colors,card_type,cost,power,counter_amount,attributes,traits,rules_revision,updated_at)
            VALUES (:identity_id,'[]',:card_type,0,0,0,:attributes,'[]','cardtell-id-v1',:updated_at)
        """, [{**row, "attributes": json.dumps([row["card_type"]]), "updated_at": now} for row in records])
        connection.executemany("UPDATE tcg_card_printings SET identity_id=? WHERE id=? AND identity_id=?",
                               [(row["identity_id"], row["id"], row["old_identity_id"]) for row in records])
        old_ids = sorted({row["old_identity_id"] for row in records})
        for offset in range(0, len(old_ids), 800):
            batch = old_ids[offset:offset + 800]
            placeholders = ",".join("?" for _ in batch)
            connection.execute(f"""
                DELETE FROM tcg_card_localizations
                WHERE language='ID' AND identity_id IN ({placeholders})
                  AND NOT EXISTS (SELECT 1 FROM tcg_card_printings p
                                  WHERE p.identity_id=tcg_card_localizations.identity_id
                                    AND p.language='ID' AND p.source_kind='cardtell')
            """, batch)
        remaining = connection.execute("""
            SELECT COUNT(*) FROM tcg_card_printings p
            JOIN tcg_card_identities i ON i.id=p.identity_id
            JOIN tcg_games g ON g.id=i.game_id
            WHERE g.slug='pokemon' AND p.language='ID'
              AND EXISTS (SELECT 1 FROM tcg_card_printings other
                          WHERE other.identity_id=p.identity_id AND other.language!='ID')
        """).fetchone()[0]
        if remaining:
            raise RuntimeError(f"Verification failed: {remaining} Indonesian printings still share an identity with another language.")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    print(f"Separated {len(records)} Indonesian printings. Backup saved to {backup}")


if __name__ == "__main__":
    main()
