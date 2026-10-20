import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
const state = path.join(root, ".wrangler/production-view");
const stagingState = path.join(root, ".wrangler/production-view-staging");
const backupState = path.join(root, ".wrangler/production-view-backup");
const syncLock = path.join(root, ".wrangler/production-view-sync.lock");
const catalogSnapshot = path.join(root, `.wrangler/production-catalog-${process.pid}.sql`);
const publicCatalogTables = [
  "tcg_games",
  "tcg_sets",
  "tcg_card_identities",
  "tcg_card_localizations",
  "tcg_card_rules",
  "tcg_card_printings",
  "tcg_card_asset_sources",
  "tcg_card_assets",
  "tcg_card_rulings",
  "tcg_rulesets",
  "tcg_card_rule_revisions",
  "tcg_sealed_products",
];
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
  if (resultSets.some((set) => set.success === false)) {
    throw new Error("Wrangler reported a failed D1 statement.");
  }
  return resultSets.flatMap((set) => set.results ?? []);
}

function remoteRows(sql) {
  return runWrangler([
    "d1", "execute", "DB", "--remote", "--config", "wrangler.migrations.json",
    "--json", "--command", sql,
  ], { json: true });
}

function remoteCatalogPage(table, offset, limit = 1000) {
  if (!publicCatalogTables.includes(table)) throw new Error(`Refusing to mirror non-public table ${table}.`);
  return remoteRows(`SELECT * FROM \`${table}\` LIMIT ${limit} OFFSET ${offset}`);
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

async function writeCatalogSnapshot() {
  await writeFile(catalogSnapshot, "", "utf8");
  const counts = {};
  for (const table of publicCatalogTables) {
    let offset = 0;
    let copied = 0;
    while (true) {
      const rows = remoteCatalogPage(table, offset);
      if (!rows.length) break;
      const columns = Object.keys(rows[0]);
      const chunks = [];
      for (let index = 0; index < rows.length; index += 10) {
        chunks.push(insert(table, columns, rows.slice(index, index + 10)));
      }
      await writeFile(catalogSnapshot, chunks.join("\n"), { encoding: "utf8", flag: "a" });
      copied += rows.length;
      offset += rows.length;
      if (rows.length < 1000) break;
    }
    counts[table] = copied;
    console.log(`Mirrored ${copied.toLocaleString()} ${table} rows.`);
  }
  return counts;
}

function localTableCount(table, persistTo = state) {
  if (!publicCatalogTables.includes(table)) throw new Error(`Refusing to verify non-public table ${table}.`);
  const rows = runWrangler([
    "d1", "execute", "DB", "--local", "--config", "wrangler.migrations.json",
    "--persist-to", persistTo, "--json", "--command", `SELECT COUNT(*) AS row_count FROM \`${table}\``,
  ], { json: true });
  return Number(rows[0]?.row_count ?? 0);
}

async function pathExists(target) {
  try { await access(target); return true; }
  catch { return false; }
}

async function acquireSyncLock() {
  try {
    await writeFile(syncLock, String(process.pid), { flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const owner = Number((await readFile(syncLock, "utf8").catch(() => "")).trim());
    if (Number.isInteger(owner) && owner > 0) {
      try { process.kill(owner, 0); }
      catch (probeError) {
        if (probeError?.code === "ESRCH") {
          await rm(syncLock, { force: true });
          return acquireSyncLock();
        }
      }
    }
    throw new Error(`A production-data mirror is already running${owner ? ` (PID ${owner})` : ""}. Wait for it to finish, then restart dev.`);
  }
  return () => rm(syncLock, { force: true });
}

await mkdir(path.dirname(state), { recursive: true });
const releaseSyncLock = await acquireSyncLock();
try {
  // Recover a previously interrupted publish before starting another mirror.
  if (await pathExists(backupState)) {
    if (await pathExists(state)) await rm(backupState, { recursive: true, force: true });
    else await rename(backupState, state);
  }
  await rm(stagingState, { recursive: true, force: true });
  // Mirror catalog tables only. The production account and seller data used by
  // Market is intentionally excluded from local development snapshots.
  const catalogCounts = await writeCatalogSnapshot();

  // Build and verify in isolation so a failed refresh never erases the last
  // working local catalog. The normal local D1 state remains untouched.
  runWrangler([
    "d1", "migrations", "apply", "DB", "--local", "--config", "wrangler.migrations.json",
    "--persist-to", stagingState,
  ], { quiet: true });
  runWrangler([
    "d1", "execute", "DB", "--local", "--config", "wrangler.migrations.json",
    "--persist-to", stagingState, "--command", "ALTER TABLE listings ADD COLUMN items TEXT;", "--yes",
  ], { quiet: true });
  runWrangler([
    "d1", "execute", "DB", "--local", "--config", "wrangler.migrations.json",
    "--persist-to", stagingState, "--json", "--file", catalogSnapshot, "--yes",
  ], { json: true });
  for (const [table, expected] of Object.entries(catalogCounts)) {
    const actual = localTableCount(table, stagingState);
    if (actual !== expected) {
      throw new Error(`Staged ${table} count is ${actual}; production has ${expected}.`);
    }
  }
  console.log("Local catalog row counts match production.");

  if (await pathExists(state)) await rename(state, backupState);
  try { await rename(stagingState, state); }
  catch (error) {
    if (await pathExists(backupState)) await rename(backupState, state);
    throw error;
  }
  await rm(backupState, { recursive: true, force: true });
} finally {
  await rm(catalogSnapshot, { force: true });
  await rm(stagingState, { recursive: true, force: true });
  if (await pathExists(backupState) && !(await pathExists(state))) await rename(backupState, state);
  await releaseSyncLock();
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
