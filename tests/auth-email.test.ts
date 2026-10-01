import test from "node:test";
import assert from "node:assert/strict";
import { getAppUrl, productionEmailUrl, renderAuthEmail } from "../lib/auth-email";

test("outbound email always uses the public VivrePlay domain", () => {
  const prior = process.env.BETTER_AUTH_URL;
  const priorFrom = process.env.VIVREPLAY_EMAIL_FROM;
  process.env.BETTER_AUTH_URL = "http://localhost:5173";
  process.env.VIVREPLAY_EMAIL_FROM = "VivrePlay <accounts@rakhaviantoni.com>";
  assert.equal(getAppUrl(), "https://vivreplay.com");
  assert.equal(
    productionEmailUrl("http://localhost:5173/api/auth/verify-email?token=secure", "https://vivreplay.com/sign-in"),
    "https://vivreplay.com/api/auth/verify-email?token=secure",
  );
  const email = renderAuthEmail({ action: "verify", to: "captain@example.com", url: "http://localhost:5173/api/auth/verify-email?token=secure" });
  assert.match(email.html, /https:\/\/vivreplay\.com\/api\/auth\/verify-email\?token=secure/);
  assert.doesNotMatch(email.html, /localhost/);
  assert.match(email.html, /prefers-color-scheme:dark/);
  assert.match(email.html, /class="email-button"/);
  assert.equal(email.from, "VivrePlay <noreply@vivreplay.com>");
  process.env.VIVREPLAY_EMAIL_FROM = "VivrePlay <hello@vivreplay.com>";
  assert.equal(renderAuthEmail({ action: "welcome", to: "captain@example.com" }).from, "VivrePlay <hello@vivreplay.com>");
  if (prior === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = prior;
  if (priorFrom === undefined) delete process.env.VIVREPLAY_EMAIL_FROM;
  else process.env.VIVREPLAY_EMAIL_FROM = priorFrom;
});
