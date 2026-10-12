import { spawn, spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
const state = path.join(root, ".wrangler/production-view");
const snapshot = path.join(root, ".wrangler/production-market.sql");
const env = {
  ...process.env,
  CLOUDFLARE_CF_FETCH_ENABLED: "false",
  WRANGLER_SEND_METRICS: "false",
  WRANGLER_WRITE_LOGS: "false",
  WRANGLER_LOG_PATH: path.join(root, ".wrangler/logs"),
  WRANGLER_REGISTRY_PATH: path.join(root, ".wrangler/dev-registry"),
  MINIFLARE_REGISTRY_PATH: path.join(root, ".wrangler/registry"),
};

function runWrangler(args, { json = false, quiet = false } = {}) {
  const result = spawnSync(process.execPath, [
    "--import", "./scripts/sites-env.mjs", wrangler, ...args,
  ], {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: json || quiet ? ["ignore", "pipe", quiet ? "pipe" : "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (quiet) process.stderr.write(result.stderr ?? "");
    throw new Error(`Wrangler exited with status ${result.status ?? 1}.`);
  }
  if (!json) return;
  const resultSets = JSON.parse(result.stdout);
  return resultSets.flatMap((set) => set.results ?? []);
}

function remoteRows(sql) {
  return runWrangler([
    "d1", "execute", "DB", "--remote", "--config", "wrangler.migrations.json",
    "--json", "--command", sql,
  ], { json: true });
}

function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insert(table, columns, rows, map = (row) => row) {
  if (!rows.length) return "";
  const names = columns.map((column) => `\`${column}\``).join(",");
  const values = rows.map((row) => {
    const mapped = map(row);
    const values = Array.isArray(mapped) ? mapped : columns.map((column) => mapped[column]);
    return `(${values.map(literal).join(",")})`;
  }).join(",\n");
  return `INSERT OR REPLACE INTO \`${table}\` (${names}) VALUES\n${values};\n`;
}

try {
  await mkdir(path.dirname(state), { recursive: true });
  // This dedicated directory is replaced on every sync; normal local D1 is untouched.
  await rm(state, { recursive: true, force: true });
  runWrangler([
    "d1", "migrations", "apply", "DB", "--local", "--config", "wrangler.migrations.json",
    "--persist-to", state,
  ], { quiet: true });
  runWrangler([
    "d1", "execute", "DB", "--local", "--config", "wrangler.migrations.json",
    "--persist-to", state, "--command", "ALTER TABLE listings ADD COLUMN items TEXT;", "--yes",
  ], { quiet: true });

  // Copy only public Market data. Never copy phone numbers, addresses, auth
  // sessions, payments, private collections, or seller-owned Vault instances.
  const profiles = remoteRows(`SELECT DISTINCT p.id,'local-preview-'||p.id AS auth_subject,p.username,p.display_name,p.region,p.locale,p.currency,p.timezone,p.favorite_leader,p.public_collection,p.created_at,p.updated_at,p.tier,p.pro_expires_at,NULL AS phone FROM profiles p JOIN listings l ON l.seller_id=p.id`);
  const origins = remoteRows(`SELECT o.owner_id,o.city,COALESCE(json_extract(o.label,'$.methods'),'[]') AS methods,o.created_at,o.updated_at FROM seller_shipping_origins o WHERE o.owner_id IN (SELECT seller_id FROM listings)`);
  const games = remoteRows(`SELECT DISTINCT g.id,g.slug,g.name FROM games g JOIN card_identities i ON i.game_id=g.id JOIN card_printings cp ON cp.identity_id=i.id WHERE cp.id IN (SELECT printing_id FROM listings UNION SELECT json_extract(item.value,'$.printingId') FROM listings l,json_each(CASE WHEN json_valid(l.items) THEN l.items ELSE '[]' END) item)`);
  const identities = remoteRows(`SELECT DISTINCT i.id,i.game_id,i.code,i.name,i.color,i.type,i.cost,i.power,i.effect,i.implementation,i.created_at,i.deleted_at FROM card_identities i JOIN card_printings cp ON cp.identity_id=i.id WHERE cp.id IN (SELECT printing_id FROM listings UNION SELECT json_extract(item.value,'$.printingId') FROM listings l,json_each(CASE WHEN json_valid(l.items) THEN l.items ELSE '[]' END) item)`);
  const printings = remoteRows(`SELECT DISTINCT cp.id,cp.identity_id,cp.language,cp.set_code,cp.rarity,cp.variant,NULL AS asset_source_id,cp.image_url,cp.created_at,cp.printing_code FROM card_printings cp WHERE cp.id IN (SELECT printing_id FROM listings UNION SELECT json_extract(item.value,'$.printingId') FROM listings l,json_each(CASE WHEN json_valid(l.items) THEN l.items ELSE '[]' END) item)`);
  const listings = remoteRows(`SELECT l.id,l.seller_id,l.printing_id,NULL AS instance_id,l.title,l.amount,l.currency,l.quantity,l.condition,l.type,l.city,l.status,l.demo,l.created_at,l.expires_at,l.items,l.negotiable FROM listings l`);

  const sql = [
    insert("profiles", ["id","auth_subject","username","display_name","region","locale","currency","timezone","favorite_leader","public_collection","created_at","updated_at","tier","pro_expires_at","phone"], profiles),
    insert("games", ["id","slug","name"], games),
    insert("card_identities", ["id","game_id","code","name","color","type","cost","power","effect","implementation","created_at","deleted_at"], identities),
    insert("card_printings", ["id","identity_id","language","set_code","rarity","variant","asset_source_id","image_url","created_at","printing_code"], printings),
    insert("seller_shipping_origins", ["owner_id","label","recipient_name","phone","address_line","city","postal_code","area_id","latitude","longitude","created_at","updated_at"], origins, (row) => [row.owner_id,JSON.stringify({methods:typeof row.methods==='string'?JSON.parse(row.methods):row.methods}),null,null,"",row.city,"",null,null,null,row.created_at,row.updated_at]),
    insert("listings", ["id","seller_id","printing_id","instance_id","title","amount","currency","quantity","condition","type","city","status","demo","created_at","expires_at","items","negotiable"], listings, (row) => {
      let items = row.items;
      try {
        if (typeof items === "string") items = JSON.stringify(JSON.parse(items).map(({ instanceId: _instanceId, ...item }) => item));
      } catch { items = null; }
      return [row.id,row.seller_id,row.printing_id,null,row.title,row.amount,row.currency,row.quantity,row.condition,row.type,row.city,row.status,row.demo,row.created_at,row.expires_at,items,row.negotiable];
    }),
  ].join("\n");

  await writeFile(snapshot, sql, "utf8");
  runWrangler([
    "d1", "execute", "DB", "--local", "--config", "wrangler.migrations.json",
    "--persist-to", state, "--file", snapshot, "--yes",
  ]);
} finally {
  await rm(snapshot, { force: true });
}

if (process.argv.includes("--sync-only")) process.exit(0);

const devEnv = { ...env, VIVREPLAY_LOCAL_D1_STATE: ".wrangler/production-view" };
const dev = spawn(process.execPath, [path.join(root, "scripts/run-framework.mjs"), "dev"], {
  cwd: root,
  env: devEnv,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => dev.kill(signal));
}
dev.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : code ?? 1;
});
