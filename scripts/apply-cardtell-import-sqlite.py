#!/usr/bin/env python3
"""Apply the Cardtell catalog import to the local Wrangler D1 SQLite database."""
import argparse
import sqlite3
import sys
import tempfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / ".wrangler/state/v3/d1/miniflare-D1DatabaseObject"


def find_database() -> Path:
    for path in STATE.glob("*.sqlite"):
        try:
            connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=2)
            found = connection.execute("SELECT id FROM tcg_games WHERE slug='pokemon' LIMIT 1").fetchone()
            connection.close()
            if found:
                return path
        except sqlite3.Error:
            continue
    raise SystemExit("Could not locate the local Pokémon D1 database.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--game-id", action="store_true")
    parser.add_argument("sql_file", nargs="?")
    args = parser.parse_args()
    path = find_database()
    connection = sqlite3.connect(path, timeout=30)
    connection.execute("PRAGMA busy_timeout=30000")
    if args.game_id:
        row = connection.execute("SELECT id FROM tcg_games WHERE slug='pokemon' LIMIT 1").fetchone()
        if not row:
            raise SystemExit("Pokémon game row is missing from local D1.")
        print(row[0])
        connection.close()
        return
    if not args.sql_file:
        raise SystemExit("Pass the generated catalog SQL file.")

    backup = Path(tempfile.gettempdir()) / f"vivreplay-d1-before-cardtell-catalog-import-{datetime.now().strftime('%Y%m%d-%H%M%S')}.sqlite"
    backup_connection = sqlite3.connect(backup)
    connection.backup(backup_connection)
    backup_connection.close()
    try:
        sql = Path(args.sql_file).read_text()
        connection.executescript("BEGIN IMMEDIATE;\n" + sql + "\nCOMMIT;")
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    print(f"Applied local catalog SQL to {path}. Backup: {backup}")


if __name__ == "__main__":
    main()
