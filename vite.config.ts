import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "86245ee8-4a6e-450d-a4ed-dc6d843aa079";

const { d1 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

const localBindingConfig = {
  name: "vivreplay",
  main: "vinext/server/fetch-handler",
  compatibility_flags: ["nodejs_compat"],
  workers_dev: true,
  preview_urls: true,
  routes: [
    { pattern: "vivreplay.com", custom_domain: true },
    { pattern: "www.vivreplay.com", custom_domain: true },
  ],
  vars: {
    BETTER_AUTH_URL: "https://vivreplay.com",
    NEXT_PUBLIC_SUPABASE_URL: "https://shqwaqxpxsyjafxdcibj.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_yg4vygJx5VP-ecakkYF8WA_WTwBloIZ",
    SUPABASE_JWKS_URL:
      "https://shqwaqxpxsyjafxdcibj.supabase.co/auth/v1/.well-known/jwks.json",
  } as Record<string, string>,
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
          migrations_dir: "drizzle",
        },
    ]
    : [],
  r2_buckets: [{ binding: "CARD_IMAGES", bucket_name: "tcg-card-images" }],
};

export default defineConfig(async ({ command, mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), "");
  if (command === "serve") {
    localBindingConfig.vars.BETTER_AUTH_URL = "http://localhost:5173";
    localBindingConfig.vars.VIVREPLAY_LOCAL_TURNSTILE_TEST_MODE = "true";
    localBindingConfig.vars.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";

    // Cloudflare's local worker only receives explicit bindings. Keep the AI
    // gateway credential local to Miniflare, sourced from ignored .env files.
    for (const key of [
      "AZEKHA_AI_GATEWAY_TOKEN",
      "AZEKHA_AI_GATEWAY_API_KEY",
      "AI_GATEWAY_INTERNAL_TOKEN",
      "OPENAI_API_KEY",
      "SUMOPOD_API_KEY",
      "ZAI_API_KEY",
    ]) {
      if (localEnv[key]) {
        localBindingConfig.vars[key] = localEnv[key];
        break;
      }
    }

    // Server-only local credential: Vite's Node env is separate from the
    // Cloudflare Worker env, so pass the shipping key into the dev binding.
    for (const key of ["BITESHIP_API_KEY", "BITESHIP_WEBHOOK_SECRET", "BITESHIP_WEBHOOK_INSTALLATION_MODE"]) {
      if (localEnv[key]?.trim()) {
        localBindingConfig.vars[key] = localEnv[key].trim();
      }
    }
  }

  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        localBindingConfig.vars.NEXT_PUBLIC_SUPABASE_URL
      ),
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        localBindingConfig.vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ),
      "process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY": JSON.stringify(
        command === "serve"
          ? "1x00000000000000000000AA"
          : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
            localEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
            "0x4AAAAAAFLjvjAWmkfLwlgD"
      ),
    },
    server: {
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      sites({ mockAuth: !managedLinux }),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
