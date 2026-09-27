import test from "node:test";
import assert from "node:assert/strict";
import { getAppUrl, productionEmailUrl, renderAuthEmail } from "../lib/auth-email";

test("outbound email always uses the public VivrePlay domain", () => {
  const prior = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "http://localhost:5173";
  assert.equal(getAppUrl(), "https://vivreplay.com");
  assert.equal(
    productionEmailUrl("http://localhost:5173/api/auth/verify-email?token=secure", "https://vivreplay.com/sign-in"),
    "https://vivreplay.com/api/auth/verify-email?token=secure",
  );
  const email = renderAuthEmail({ action: "verify", to: "captain@example.com", url: "http://localhost:5173/api/auth/verify-email?token=secure" });
  assert.match(email.html, /https:\/\/vivreplay\.com\/api\/auth\/verify-email\?token=secure/);
  assert.doesNotMatch(email.html, /localhost/);
  if (prior === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = prior;
});
