# iPaymu checkout setup

VivrePlay creates iPaymu Redirect Payment sessions for Market card orders and Market Pro. iPaymu hosts payment-method selection and sends the signed callback that changes an order to paid. The app does not expose merchant credentials to the browser.

## Configure the sandbox

Add the sandbox VA and API key as local server-only environment values, set `IPAYMU_MODE=sandbox`, then start the local Worker. Set the Market Pro amount and period to a known test value. Sandbox credentials are separate from production credentials.

For a Market sandbox order, also configure Biteship and enable both `VIVREPLAY_MARKET_CHECKOUT_ENABLED` and `VIVREPLAY_MARKET_SELLER_OPERATIONS_READY`. Those flags must only be enabled after order and seller fulfillment operations have been reviewed.

The payment return URL is `/checkout/order/{id}`. Configure the iPaymu callback to `https://vivreplay.com/api/checkout/ipaymu/callback` for production, or the reachable public test URL for sandbox testing. The application accepts JSON and form-encoded callbacks and verifies `X-Signature` with the merchant VA before applying a payment.

## Configure production

Add `IPAYMU_VA`, `IPAYMU_API_KEY`, and `IPAYMU_EGRESS_PROXY_SECRET` as Cloudflare Worker secrets. Set `IPAYMU_EGRESS_PROXY_URL=https://scan.vivreplay.com/api/ipaymu-egress` as a Worker variable and `IPAYMU_MODE=production`. Set `VIVREPLAY_PUBLIC_URL=https://vivreplay.com`, the Market Pro price and duration, and then set `IPAYMU_PRODUCTION_READY=true` only after both requirements below have been confirmed in iPaymu:

- Register and obtain approval for `vivreplay.com` and every callback/return domain used by checkout.
- Register the VPS outbound IP `43.156.49.12` with iPaymu. Production iPaymu API calls go through the VPS relay; checkout callbacks still go directly to VivrePlay. Confirm that `curl -4 https://api.ipify.org` run on the VPS returns this address before relying on it.

The relay runs beside the scanner at `/api/ipaymu-egress`. Generate a 32-byte key with `openssl rand -hex 32`, then configure the same value as `IPAYMU_PROXY_SECRET` on the VPS and `IPAYMU_EGRESS_PROXY_SECRET` in Cloudflare. Keep it out of source control and chat. For systemd, put it in `/etc/vivreplay/card-scanner.env` with mode `600`; for Docker Compose, set it in the VPS-side `.env` file. Deploy the scanner update, confirm `https://scan.vivreplay.com/health` responds, then register the VPS's outbound IPv4 address with iPaymu. Check that address on the VPS itself (for example, `curl -4 https://api.ipify.org`) rather than using the `scan.vivreplay.com` DNS address, which may be Cloudflare-proxied.

Deploy the web Worker only after the relay is live and both secret values are configured. Add the URL as a Worker variable and the shared key with `wrangler secret put IPAYMU_EGRESS_PROXY_SECRET`. Production payment requests fail closed when this route is missing; they never fall back to Cloudflare's changing egress address. The VPS allows only the specific iPaymu API routes used by checkout, verifies a short-lived HMAC, and rejects replayed requests.

Set the iPaymu dashboard callback URL to `https://vivreplay.com/api/checkout/ipaymu/callback`. The online Market checkout additionally requires the Biteship key and the two Market checkout operation flags above.

Cloudflare Workers do not promise a dedicated static outbound IP by default. The VPS relay supplies the registered static egress route for signed iPaymu API calls.

## Verify a live transaction

First test checkout creation, callback signature verification, payment status, Pro activation, and Market inventory changes with iPaymu sandbox credentials. Then use a low-value, real production product and a payment channel approved for the merchant account. Confirm the callback changes the order once, the order page displays the confirmed state, and the expected product fulfillment runs. Refund the test charge from the appropriate iPaymu merchant flow and verify the refund with the same payment provider. Production payments are real charges; do not use a simulated sandbox result as proof of production processing.

Required production values are deliberately not committed to this repository.
