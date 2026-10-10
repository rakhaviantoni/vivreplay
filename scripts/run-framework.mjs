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
  if (!handlerCode.includes('HTMLRewriter')) {
    handlerCode = `import handler from "virtual:vinext-worker-entry";

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

class HeadRewriter {
  element(element) {
    element.prepend(GTAG_SNIPPET, { html: true });
  }
}

var fetch_handler_default = {
  async fetch(request, env, ctx) {
    const response = await handler.fetch(request, env, ctx);
    const contentType = response?.headers?.get("content-type");
    if (contentType && contentType.includes("text/html") && typeof HTMLRewriter !== "undefined") {
      return new HTMLRewriter().on("head", new HeadRewriter()).transform(response);
    }
    return response;
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
