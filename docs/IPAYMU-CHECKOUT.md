# iPaymu checkout setup

VivrePlay creates iPaymu Redirect Payment sessions for Market card orders and Market Pro. iPaymu hosts payment-method selection and sends the signed callback that changes an order to paid. The app does not expose merchant credentials to the browser.

## Configure the sandbox

Add the sandbox VA and API key as local server-only environment values, set `IPAYMU_MODE=sandbox`, then start the local Worker. Set the Market Pro amount and period to a known test value. Sandbox credentials are separate from production credentials.

For a Market sandbox order, also configure Biteship and enable both `VIVREPLAY_MARKET_CHECKOUT_ENABLED` and `VIVREPLAY_MARKET_SELLER_OPERATIONS_READY`. Those flags must only be enabled after order and seller fulfillment operations have been reviewed.

The payment return URL is `/checkout/order/{id}`. Configure the iPaymu callback to `https://vivreplay.com/api/checkout/ipaymu/callback` for production, or the reachable public test URL for sandbox testing. The application accepts JSON and form-encoded callbacks and verifies `X-Signature` with the merchant VA before applying a payment.

## Configure production

Add `IPAYMU_VA`, `IPAYMU_API_KEY`, and `IPAYMU_MODE=production` as Cloudflare Worker secrets. Set `VIVREPLAY_PUBLIC_URL=https://vivreplay.com`, the Market Pro price and duration, and then set `IPAYMU_PRODUCTION_READY=true` only after both requirements below have been confirmed in iPaymu:

- Register and obtain approval for `vivreplay.com` and every callback/return domain used by checkout.
- Register a static outbound IP used by the payment API requests.

Set the iPaymu dashboard callback URL to `https://vivreplay.com/api/checkout/ipaymu/callback`. The online Market checkout additionally requires the Biteship key and the two Market checkout operation flags above.

Cloudflare Workers do not promise a dedicated static outbound IP by default. If the Worker does not have an approved static egress route, production checkout remains disabled until one is arranged.

## Verify a live transaction

First test checkout creation, callback signature verification, payment status, Pro activation, and Market inventory changes with iPaymu sandbox credentials. Then use a low-value, real production product and a payment channel approved for the merchant account. Confirm the callback changes the order once, the order page displays the confirmed state, and the expected product fulfillment runs. Refund the test charge from the appropriate iPaymu merchant flow and verify the refund with the same payment provider. Production payments are real charges; do not use a simulated sandbox result as proof of production processing.

Required production values are deliberately not committed to this repository.
