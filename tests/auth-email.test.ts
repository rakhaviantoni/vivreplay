import test from "node:test";
import assert from "node:assert/strict";
import { getAppUrl, productionEmailUrl, renderAuthEmail, supportWhatsAppUrl } from "../lib/auth-email";

test("outbound email always uses the public VivrePlay domain", () => {
  const prior = process.env.BETTER_AUTH_URL;
  const priorFrom = process.env.VIVREPLAY_EMAIL_FROM;
  process.env.BETTER_AUTH_URL = "http://localhost:5173";
  process.env.VIVREPLAY_EMAIL_FROM = "VivrePlay <accounts@rakhaviantoni.com>";
  assert.equal(getAppUrl(), "https://vivreplay.com");
  assert.equal(
    productionEmailUrl("http://localhost:5173/api/auth/verify-email?token=secure", "https://vivreplay.com/sign-in"),
    "https://vivreplay.com/api/auth/verify-email?token=secure&callbackURL=https%3A%2F%2Fvivreplay.com%2Fauth%2Fverified%3Freturn_to%3D%252Fprofile",
  );
  const email = renderAuthEmail({ action: "verify", to: "captain@example.com", url: "http://localhost:5173/api/auth/verify-email?token=secure" });
  assert.match(email.html, /https:\/\/vivreplay\.com\/api\/auth\/verify-email\?token=secure/);
  assert.doesNotMatch(email.html, /localhost/);
  assert.match(email.html, /prefers-color-scheme:dark/);
  assert.match(email.html, /class="email-button"/);
  assert.match(email.html, /max-width:620px;background:#fffdf8;border:1px solid #e1dbcf;border-radius:10px/);
  assert.match(email.html, /background:#f5efe2;border-bottom:2px solid #c99b3c/);
  assert.match(email.html, /vivreplay\.com\/help/);
  assert.match(email.html, /vivreplay\.com\/legal\/refund/);
  assert.equal(email.from, "VivrePlay <noreply@vivreplay.com>");
  process.env.VIVREPLAY_EMAIL_FROM = "VivrePlay <hello@vivreplay.com>";
  assert.equal(renderAuthEmail({ action: "welcome", to: "captain@example.com" }).from, "VivrePlay <hello@vivreplay.com>");
  if (prior === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = prior;
  if (priorFrom === undefined) delete process.env.VIVREPLAY_EMAIL_FROM;
  else process.env.VIVREPLAY_EMAIL_FROM = priorFrom;
});

test("support WhatsApp links include localized order complaint context", () => {
  const english = new URL(supportWhatsAppUrl("en", "VPM-123"));
  const indonesian = new URL(supportWhatsAppUrl("id-ID", "VPM-123"));
  assert.equal(english.searchParams.get("text"), "Hi VivrePlay, I'd like to report an issue with order VPM-123. The issue is: ");
  assert.equal(indonesian.searchParams.get("text"), "Halo VivrePlay, saya ingin mengajukan komplain untuk pesanan VPM-123. Kendala saya: ");
  assert.equal(new URL(supportWhatsAppUrl("en")).searchParams.get("text"), "Hi VivrePlay, I need help with ");
});
