import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command)) throw new Error("Expected dev or build.");
const managedLinux = readExecutionProfile() === "managed-linux";

// Ensure vinext's link shim preserves navigation exports across client tree-shaking
try {
  const { readFileSync, writeFileSync } = await import("node:fs");
  const linkShimPath = fileURLToPath(new URL("../node_modules/vinext/dist/shims/link.js", import.meta.url));
  let code = readFileSync(linkShimPath, "utf8");
  if (!code.includes('import * as navigationModule from "./navigation.js";')) {
    code = code.replace(
      'import { jsx } from "react/jsx-runtime";',
      'import { jsx } from "react/jsx-runtime";\nimport * as navigationModule from "./navigation.js";'
    ).replace(
      'let loadedNavigationModule = null;\nlet navigationModulePromise = null;',
      'let loadedNavigationModule = navigationModule;\nlet navigationModulePromise = Promise.resolve(navigationModule);'
    ).replace(
      'return navigationModulePromise ??= import("./navigation.js").then((module) => {\n\t\tloadedNavigationModule = module;\n\t\treturn module;\n\t});',
      'return navigationModulePromise;'
    );
    writeFileSync(linkShimPath, code, "utf8");
  }

  // Ensure Cloudflare fetch handler injects Google tag directly into <head> for crawlers and verification
  const fetchHandlerPath = fileURLToPath(new URL("../node_modules/vinext/dist/server/fetch-handler.js", import.meta.url));
  let handlerCode = readFileSync(fetchHandlerPath, "utf8");
  if (!handlerCode.includes('VivrePlay Market order reminder job')) {
    handlerCode = `import handler from "virtual:vinext-worker-entry";

// VivrePlay deferred home styles
const GTAG_SNIPPET = \`<!-- Google tag (gtag.js) -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-2Z50572QD3');
  (function(){
    var started = false;
    function loadTag(){
      if (started) return;
      started = true;
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=G-2Z50572QD3';
      document.head.appendChild(script);
    }
    function schedule(){
      if ('requestIdleCallback' in window) window.requestIdleCallback(loadTag, {timeout: 4000});
      else window.setTimeout(loadTag, 1800);
    }
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, {once: true});
  })();
</script>\`;

const HOME_CRITICAL_CSS = \`<style id="home-critical-css">
:root{--vp-ink:#28251f;--vp-paper:#f4ecdc;--vp-line:#dfd1b8;--vp-gold:#b77a19;--vp-gold-deep:#855514;--game-font:Arial,Helvetica,sans-serif;--display-font:Arial,Helvetica,sans-serif}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#f4ecdc;color:#28251f}body{font:16px Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}a{color:inherit;text-decoration:none}.site-shell{min-height:100vh;background:linear-gradient(90deg,#f1e7d2,#f7f0e2 52%,#eee2ca)}
.masthead{position:sticky;top:0;z-index:40;height:66px;padding:0 clamp(18px,4vw,64px);display:flex;align-items:center;gap:30px;background:#fff9edee;border-bottom:1px solid #dfd1b8;color:#28251f}.wordmark{display:flex;align-items:center;gap:9px;color:#28251f;font:700 22px Arial,Helvetica,sans-serif}.wordmark img{display:block;width:28px;height:28px}.masthead-actions{margin-left:auto;display:flex;align-items:center;gap:10px}.context-row{display:none}
.home-page{max-width:1520px;margin:auto}.home-hero{position:relative;min-height:535px;display:grid;grid-template-columns:minmax(390px,.95fr) 1.05fr;overflow:hidden;padding:80px clamp(18px,5vw,78px);background:repeating-linear-gradient(90deg,#80642a10 0 1px,transparent 1px 42px),linear-gradient(100deg,#f9f1e3,#f3e5ce)}.home-hero-map{position:absolute;inset:0;z-index:0;display:block;overflow:hidden;pointer-events:none}.home-hero-map img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 44%}.home-hero-copy{position:relative;z-index:2}.home-hero h1{margin:16px 0 18px;font:500 clamp(53px,5.8vw,86px)/.91 Arial,Helvetica,sans-serif;letter-spacing:-.055em;color:#30291f}.home-hero h1 em{color:#b77a19;font-weight:400}.home-hero-copy>p:not(.eyebrow){max-width:440px;color:#6d6458;font-size:15px;line-height:1.65}.hero-actions{display:flex;align-items:center;gap:18px;margin-top:27px}.button{display:inline-flex;align-items:center;min-height:42px;padding:0 16px;border:0;border-radius:8px;background:#b77a19;color:#fffaf0;font-weight:700}.text-action{display:inline-flex;align-items:center;gap:6px;color:#725519;font-size:12px;font-weight:700}.hero-stats{display:flex;gap:0;margin-top:46px}.hero-stats div{padding:0 21px;border-left:1px solid #d8c8ad}.hero-stats div:first-child{padding-left:0;border:0}.hero-stats dt{font-size:10px;color:#827564;text-transform:uppercase;letter-spacing:.08em}.hero-stats dd{margin:4px 0 0;font:500 24px Arial,Helvetica,sans-serif;color:#3b3327}.hero-printings{position:relative;z-index:2;min-height:365px}.hero-card{position:absolute;width:190px;transform-origin:50% 100%;filter:drop-shadow(8px 12px 9px #2e1e0b2e)}
@media(max-width:700px){.masthead{height:58px;padding-inline:14px;gap:10px}.primary-nav{display:none}.masthead-actions{gap:6px}.home-hero{display:flex;flex-direction:column;min-height:0;padding:44px 18px 28px}.home-hero h1{font-size:clamp(43px,12vw,57px)}.home-hero-copy>p:not(.eyebrow){font-size:14px}.hero-actions{gap:12px;margin-top:20px}.hero-stats{margin-top:28px}.hero-stats div{padding-inline:10px}.hero-stats dd{font-size:18px}.hero-printings{height:205px;min-height:205px;margin-inline:-18px}.hero-card{width:112px}.hero-card-0{left:3%;top:20px;transform:rotate(-12deg)}.hero-card-1{left:23%;top:10px;transform:rotate(-5deg)}.hero-card-2{left:43%;top:0;transform:rotate(2deg)}.hero-card-3{left:63%;top:12px;transform:rotate(9deg)}}
</style>\`;

class HeadRewriter {
  constructor(home) { this.home = home; }
  element(element) {
    element.prepend(GTAG_SNIPPET, { html: true });
    if (this.home) element.prepend(HOME_CRITICAL_CSS, { html: true });
  }
}

class HomeStylesheetRewriter {
  constructor(home) { this.home = home; }
  element(element) {
    if (!this.home) return;
    const href = element.getAttribute('href') || '';
    if (!href.includes('/_next/static/css/')) return;
    element.setAttribute('media', 'print');
    element.setAttribute('onload', "this.media='all'");
  }
}

var fetch_handler_default = {
  async fetch(request, env, ctx) {
    const response = await handler.fetch(request, env, ctx);
    const contentType = response?.headers?.get("content-type");
    if (contentType && contentType.includes("text/html") && typeof HTMLRewriter !== "undefined") {
      const pathname = new URL(request.url).pathname;
      const home = pathname === '/' || pathname === '/id';
      return new HTMLRewriter()
        .on("head", new HeadRewriter(home))
        .on("link[rel=stylesheet]", new HomeStylesheetRewriter(home))
        .transform(response);
    }
    return response;
  },
  async scheduled(controller, env, ctx) {
    // VivrePlay Market order reminder job
    const secret = env.PRO_MEMBERSHIP_CRON_SECRET;
    if (!secret) {
      console.error("Scheduled Market notifications are not configured");
      return;
    }
    const scheduledAt = new Date(controller.scheduledTime);
    const paths = ["/api/cron/market-orders"];
    if (scheduledAt.getUTCHours() === 2 && scheduledAt.getUTCMinutes() === 0) paths.push("/api/cron/pro-membership");
    const work = Promise.all(paths.map(async (path) => {
      const request = new Request("https://vivreplay.com" + path, {
        method: "POST",
        headers: { authorization: "Bearer " + secret },
      });
      const response = await handler.fetch(request, env, ctx);
      if (!response.ok) {
        console.error("Scheduled Market job failed", path, response.status, await response.text());
        throw new Error("Scheduled Market job failed (" + response.status + ")");
      }
    }));
    ctx.waitUntil(work);
    await work;
  }
};

export { fetch_handler_default as default };
`;
    writeFileSync(fetchHandlerPath, handlerCode, "utf8");
  }
} catch {
  // Ignore if path not found
}

if (managedLinux && command === "build") {
  const result = spawnSync("bash", [
    fileURLToPath(new URL("./build-verified.sh", import.meta.url)), ...args,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Import in this process so the preview owner retains its PID and signals.
const cli = new URL(managedLinux
  ? "../node_modules/vite/bin/vite.js"
  : "../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), command,
  ...(!managedLinux && command === "dev" ? ["--port", "5173"] : []), ...args];
await import(cli.href);
