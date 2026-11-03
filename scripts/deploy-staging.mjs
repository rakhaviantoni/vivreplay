import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const workerName = "vivreplay-staging";
const configPath = "dist/server/wrangler.staging.json";
const database = {
  binding: "DB",
  database_name: "vivreplay-staging",
  database_id: "3bbeb649-5c12-421c-821a-3718278516f3",
  migrations_dir: "../../drizzle",
};
const bucket = { binding: "CARD_IMAGES", bucket_name: "tcg-card-images-staging" };
const wrangler = "node_modules/.bin/wrangler";

const build = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    VIVREPLAY_DEPLOY_TARGET: "staging",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
  },
});
if (build.status !== 0) throw new Error("The staging build failed.");

function run(args, { input, allowFailure = false } = {}) {
  const result = spawnSync(wrangler, args, {
    encoding: "utf8",
    input,
    env: {
      ...process.env,
      WRANGLER_WRITE_LOGS: "false",
      WRANGLER_SEND_METRICS: "false",
    },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0 && !allowFailure) {
    process.stderr.write(output);
    throw new Error(`wrangler ${args.join(" ")} failed.`);
  }
  return output;
}

async function putSecret(name, value) {
  if (!value?.trim()) return false;
  run(["secret", "put", name, "--name", workerName], { input: `${value.trim()}\n` });
  return true;
}

function getStagingSecretNames() {
  const result = run(["secret", "list", "--name", workerName, "--format", "json"], {
    allowFailure: true,
  });
  try {
    return new Set(JSON.parse(result).map((secret) => secret.name));
  } catch {
    return new Set();
  }
}

function stageConfig(base, existingSecrets) {
  const config = structuredClone(base);
  const sandboxVa = process.env.VIVREPLAY_STAGING_IPAYMU_VA?.trim();
  const sandboxKey = process.env.VIVREPLAY_STAGING_IPAYMU_API_KEY?.trim();
  const hasSandboxCredentials = Boolean(
    (sandboxVa && sandboxKey) ||
    (existingSecrets.has("IPAYMU_VA") && existingSecrets.has("IPAYMU_API_KEY")),
  );
  const hasBiteshipKey = Boolean(
    process.env.VIVREPLAY_STAGING_BITESHIP_API_KEY?.trim() ||
    existingSecrets.has("BITESHIP_API_KEY"),
  );

  config.name = workerName;
  config.account_id ??= "7a7f6df22f9e37419cb0f625ca1cfd4f";
  config.workers_dev = true;
  config.preview_urls = true;
  config.routes = [];
  config.triggers = { crons: [] };
  config.vars = {
    ...config.vars,
    BETTER_AUTH_URL: process.env.VIVREPLAY_STAGING_URL?.trim() || "https://staging.invalid",
    VIVREPLAY_DEPLOY_ENV: "staging",
    IPAYMU_MODE: "sandbox",
    VIVREPLAY_MARKET_CHECKOUT_ENABLED: String(hasSandboxCredentials && hasBiteshipKey),
    VIVREPLAY_MARKET_SELLER_OPERATIONS_READY: String(hasBiteshipKey),
    VIVREPLAY_MARKET_LIVE_PAYMENTS_ENABLED: "false",
  };
  delete config.vars.IPAYMU_EGRESS_PROXY_URL;
  config.d1_databases = [database];
  config.r2_buckets = [bucket];
  return config;
}

async function ensureAuthSecret() {
  const result = run(["secret", "list", "--name", workerName, "--format", "json"], {
    allowFailure: true,
  });
  try {
    const existing = JSON.parse(result);
    if (existing.some((secret) => secret.name === "BETTER_AUTH_SECRET")) return;
  } catch {
    // A first deployment has no secrets yet.
  }
  await putSecret("BETTER_AUTH_SECRET", randomBytes(48).toString("base64url"));
}

const base = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
const existingSecrets = getStagingSecretNames();
const config = stageConfig(base, existingSecrets);
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

console.log("Applying schema migrations to the staging database.");
run(["d1", "migrations", "apply", database.database_name, "--remote", "--config", configPath]);
const migrationStatus = run(["d1", "migrations", "list", database.database_name, "--remote", "--config", configPath]);
if (!migrationStatus.includes("No migrations to apply")) {
  throw new Error("Staging D1 still has pending migrations; deployment stopped.");
}

const firstDeploy = run(["deploy", "--config", configPath]);
process.stdout.write(firstDeploy);
const workerUrl = firstDeploy.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0];
const stagingUrl = process.env.VIVREPLAY_STAGING_URL?.trim() || workerUrl;
if (!stagingUrl) {
  throw new Error("Could not determine the staging workers.dev URL from Wrangler output.");
}

await ensureAuthSecret();
await putSecret("IPAYMU_VA", process.env.VIVREPLAY_STAGING_IPAYMU_VA);
await putSecret("IPAYMU_API_KEY", process.env.VIVREPLAY_STAGING_IPAYMU_API_KEY);
await putSecret("BITESHIP_API_KEY", process.env.VIVREPLAY_STAGING_BITESHIP_API_KEY);
await putSecret("BITESHIP_WEBHOOK_SECRET", process.env.VIVREPLAY_STAGING_BITESHIP_WEBHOOK_SECRET);
await putSecret("GOOGLE_CLIENT_ID", process.env.VIVREPLAY_STAGING_GOOGLE_CLIENT_ID);
await putSecret("GOOGLE_CLIENT_SECRET", process.env.VIVREPLAY_STAGING_GOOGLE_CLIENT_SECRET);
await putSecret("RESEND_API_KEY", process.env.VIVREPLAY_STAGING_RESEND_API_KEY);

config.vars.BETTER_AUTH_URL = stagingUrl.replace(/\/$/, "");
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
const finalDeploy = run(["deploy", "--config", configPath]);
process.stdout.write(finalDeploy);
console.log(`Staging Worker: ${config.vars.BETTER_AUTH_URL}`);
if (!(process.env.VIVREPLAY_STAGING_IPAYMU_VA && process.env.VIVREPLAY_STAGING_IPAYMU_API_KEY) &&
    !(existingSecrets.has("IPAYMU_VA") && existingSecrets.has("IPAYMU_API_KEY"))) {
  console.log("Checkout is disabled until staging iPaymu sandbox credentials are configured.");
}
if (!process.env.VIVREPLAY_STAGING_BITESHIP_API_KEY && !existingSecrets.has("BITESHIP_API_KEY")) {
  console.log("Shipping operations are disabled until a staging Biteship API key is configured.");
}
