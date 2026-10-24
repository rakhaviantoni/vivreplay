#!/usr/bin/env python3
"""Fill production with the complete Indonesian CardTell catalog already in local D1."""
import argparse
import json
import os
import sqlite3
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/129855bc08bf1d2e48ada2640c897d48cb9d17aeb5bfc86a259e33d119dbe76f.sqlite"
WRANGLER = ROOT / "node_modules/.bin/wrangler"
CONFIG = "dist/server/wrangler.json"


def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def normalize_number(value):
    token = str(value or "").split("/", 1)[0].strip()
    return str(int(token)) if token.isdigit() else token.upper()


def wrangler_json(args):
    result = subprocess.run([str(WRANGLER), *args], cwd=ROOT, text=True, capture_output=True,
                            env={**os.environ, "WRANGLER_LOG_PATH": str(Path(tempfile.gettempdir()) / "vivreplay-cardtell-sync.log")})
    if result.returncode:
        raise RuntimeError(result.stderr[-4000:] or result.stdout[-4000:])
    output = result.stdout
    return json.loads(output)


def insert_batches(connection, table, rows, conflict="ignore"):
    if not rows:
        return []
    columns = [column[1] for column in connection.execute(f"PRAGMA table_info(`{table}`)")]
    present = [column for column in columns if column in rows[0]]
    prefix = f"INSERT {'OR IGNORE ' if conflict == 'ignore' else ''}INTO `{table}` ({','.join(f'`{c}`' for c in present)}) VALUES "
    suffix = ""
    if conflict == "printing":
        suffix = " ON CONFLICT(`id`) DO UPDATE SET " + ",".join([
            "`rarity`=CASE WHEN trim(COALESCE(tcg_card_printings.`rarity`,''))='' THEN excluded.`rarity` ELSE tcg_card_printings.`rarity` END",
            "`attribute`=CASE WHEN trim(COALESCE(tcg_card_printings.`attribute`,''))='' THEN excluded.`attribute` ELSE tcg_card_printings.`attribute` END",
            "`card_image_url`=CASE WHEN trim(COALESCE(tcg_card_printings.`card_image_url`,''))='' THEN excluded.`card_image_url` ELSE tcg_card_printings.`card_image_url` END",
            "`source_payload`=json_patch(COALESCE(excluded.`source_payload`,'{}'),COALESCE(tcg_card_printings.`source_payload`,'{}'))",
        ])
    statements, values, size = [], [], 0
    for row in rows:
        value = "(" + ",".join(sql_value(row.get(column)) for column in present) + ")"
        if values and size + len(value) > 48_000:
            statements.append(prefix + ",".join(values) + suffix + ";")
            values, size = [], 0
        values.append(value)
        size += len(value) + 1
    if values:
        statements.append(prefix + ",".join(values) + suffix + ";")
    return statements


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write the missing local catalog data to production")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = parser.parse_args()
    if not args.db.exists():
        raise SystemExit(f"Local D1 database not found: {args.db}")

    connection = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    local_rows = connection.execute("SELECT * FROM tcg_card_printings WHERE source_kind='cardtell' AND language='ID' ORDER BY id").fetchall()
    local_by_cardtell_id = {}
    for row in local_rows:
        payload = json.loads(row["source_payload"] or "{}")
        cardtell_id = str(payload.get("cardtellId") or "")
        if cardtell_id.isdigit():
            local_by_cardtell_id[cardtell_id] = dict(row)
    remote_rows = wrangler_json(["d1", "execute", "vivreplay", "--remote", "--config", CONFIG, "--json", "--command",
        "SELECT group_concat(json_extract(source_payload,'$.cardtellId')) AS cardtellIds FROM tcg_card_printings WHERE source_kind='cardtell' AND language='ID'"])
    remote_ids = {value for result in remote_rows for row in result.get("results", []) for value in str(row.get("cardtellIds") or "").split(',') if value}
    missing_ids = set(local_by_cardtell_id) - remote_ids
    print(json.dumps({"localPrintings": len(local_by_cardtell_id), "productionPrintings": len(remote_ids),
                      "missingPrintings": len(missing_ids), "localCharizardPrintings": sum("charizard" in str(json.loads(local_by_cardtell_id[item]["source_payload"]).get("name", "")).lower() for item in local_by_cardtell_id),
                      "mode": "apply" if args.apply else "preview"}, indent=2))
    if not args.apply or not missing_ids:
        connection.close()
        return

    selected = [local_by_cardtell_id[item] for item in sorted(local_by_cardtell_id, key=int)]
    missing = [local_by_cardtell_id[item] for item in sorted(missing_ids, key=int)]
    printing_ids = {row["id"] for row in missing}
    identity_ids = {row["identity_id"] for row in missing}
    set_ids = {row["set_id"] for row in missing if row["set_id"]}

    def query_by_ids(table, column, ids):
        result = []
        ids = list(ids)
        for start in range(0, len(ids), 500):
            part = ids[start:start + 500]
            result.extend(dict(row) for row in connection.execute(
                f"SELECT * FROM `{table}` WHERE `{column}` IN ({','.join('?' for _ in part)})", part))
        return result

    sets = query_by_ids("tcg_sets", "id", set_ids)
    identities = query_by_ids("tcg_card_identities", "id", identity_ids)
    localizations = query_by_ids("tcg_card_localizations", "identity_id", identity_ids)
    rules = query_by_ids("tcg_card_rules", "identity_id", identity_ids)
    assets = query_by_ids("tcg_card_asset_sources", "printing_id", printing_ids)

    set_codes = sorted({str(row["set_code"]).lower() for row in selected if row["set_code"]})
    tcgdex_rows = []
    for start in range(0, len(set_codes), 40):
        codes = set_codes[start:start + 40]
        literals = ",".join(sql_value(code) for code in codes)
        tcgdex_rows.extend(connection.execute(f"""SELECT set_code,language,rarity,variant,
          json_extract(source_payload,'$.localId') AS localId,
          json_extract(source_payload,'$.collectorNumber') AS collectorNumber,
          json_extract(source_payload,'$.regulationMark') AS regulationMark
          FROM tcg_card_printings WHERE source_kind='tcgdex' AND language IN ('JP','EN') AND lower(set_code) IN ({literals})""").fetchall())
    cross_language = {}
    for row in tcgdex_rows:
        key = (str(row["set_code"]).lower(), normalize_number(row["localId"] or row["collectorNumber"]))
        if key[1]:
            cross_language.setdefault(key, []).append(dict(row))
    added_rarity = added_regulation = 0
    enriched_printings = []
    for raw in selected:
        row = dict(raw)
        payload = json.loads(row["source_payload"] or "{}")
        sources = sorted(cross_language.get((str(row["set_code"]).lower(), normalize_number(payload.get("localId") or payload.get("collectorNumber"))), []),
                         key=lambda source: (source["language"] != "JP", source["variant"] != "Standard"))
        if not str(row.get("rarity") or "").strip():
            rarity = next((str(source["rarity"]).strip() for source in sources if str(source.get("rarity") or "").strip()), "")
            if rarity:
                row["rarity"] = rarity
                payload["rarity"] = rarity
                added_rarity += 1
        if not str(payload.get("regulationMark") or "").strip():
            regulation = next((str(source["regulationMark"]).strip() for source in sources if str(source.get("regulationMark") or "").strip()), "")
            if regulation:
                payload["regulationMark"] = regulation
                added_regulation += 1
        row["source_payload"] = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        enriched_printings.append(row)

    statements = []
    for table, rows, conflict in [
        ("tcg_sets", sets, "ignore"),
        ("tcg_card_identities", identities, "ignore"),
        ("tcg_card_localizations", localizations, "ignore"),
        ("tcg_card_rules", rules, "ignore"),
        ("tcg_card_printings", enriched_printings, "printing"),
        ("tcg_card_asset_sources", assets, "ignore"),
    ]:
        statements.extend(insert_batches(connection, table, rows, conflict))
    connection.close()

    with tempfile.NamedTemporaryFile("w", suffix=".sql", prefix="cardtell-local-sync-", delete=False) as handle:
        sql_path = Path(handle.name)
        handle.write("\n".join(statements))
    print(json.dumps({"printingsSynced": len(enriched_printings), "newPrintingsAdded": len(missing), "raritiesFromOtherLanguages": added_rarity,
                      "regulationsFromOtherLanguages": added_regulation, "sqlStatements": len(statements)}, indent=2))
    try:
        subprocess.run([str(WRANGLER), "d1", "execute", "vivreplay", "--remote", "--config", CONFIG, "--file", str(sql_path)], cwd=ROOT, check=True)
    finally:
        sql_path.unlink(missing_ok=True)
    print("Production CardTell sync completed.")


if __name__ == "__main__":
    main()
