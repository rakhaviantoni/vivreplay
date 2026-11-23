export type PolarDigitalKind = 'CREDITS' | 'PRO' | 'BOOST';

function readPolarEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

export function polarMode(): 'sandbox' | 'production' {
  const staging = readPolarEnv('VIVREPLAY_DEPLOY_ENV') === 'staging';
  if (staging) return 'sandbox';
  const raw = readPolarEnv('POLAR_MODE').toLowerCase();
  return raw === 'sandbox' ? 'sandbox' : 'production';
}

export function polarProductIdFor(kind: PolarDigitalKind, proBillingCycle?: 'monthly' | 'annual'): string {
  if (kind === 'PRO') {
    return proBillingCycle === 'annual'
      ? readPolarEnv('POLAR_PRO_ANNUAL_PRODUCT_ID') || readPolarEnv('POLAR_PRO_MONTHLY_PRODUCT_ID')
      : readPolarEnv('POLAR_PRO_MONTHLY_PRODUCT_ID');
  }
  if (kind === 'BOOST') {
    return readPolarEnv('POLAR_BOOST_PRODUCT_ID');
  }
  return readPolarEnv('POLAR_CREDITS_PRODUCT_ID');
}

export function hasPolarConfig(kind?: PolarDigitalKind, proBillingCycle?: 'monthly' | 'annual'): boolean {
  const token = readPolarEnv('POLAR_ACCESS_TOKEN');
  if (!token) return false;
  if (!kind) return true;
  return Boolean(polarProductIdFor(kind, proBillingCycle));
}

export async function createPolarCheckout(params: {
  kind: PolarDigitalKind;
  proBillingCycle?: 'monthly' | 'annual';
  amountCents?: number;
  orderId: string;
  profileId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  successUrl: string;
  extraMetadata?: Record<string, string | number | boolean>;
}): Promise<{ id: string; url: string }> {
  const token = readPolarEnv('POLAR_ACCESS_TOKEN');
  if (!token) {
    throw new Error('USD checkout is temporarily unavailable.');
  }
  const productId = polarProductIdFor(params.kind, params.proBillingCycle);
  if (!productId) {
    throw new Error(`USD checkout is temporarily unavailable for ${params.kind}.`);
  }
  const baseUrl = polarMode() === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
  const body: Record<string, unknown> = {
    products: [productId],
    success_url: params.successUrl,
    metadata: {
      orderId: params.orderId,
      kind: params.kind,
      profileId: params.profileId,
      ...(params.extraMetadata ?? {}),
    },
  };
  if (params.amountCents && params.amountCents > 0) {
    body.amount = Math.round(params.amountCents);
  }
  if (params.customerEmail) {
    body.customer_email = params.customerEmail;
  }
  if (params.customerName) {
    body.customer_name = params.customerName;
  }

  const response = await fetch(`${baseUrl}/v1/checkouts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; url?: string; detail?: string; error?: string };
  if (!response.ok || !payload.id || !payload.url) {
    throw new Error(payload.detail || payload.error || 'Could not start USD checkout session.');
  }
  return { id: payload.id, url: payload.url };
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Verifies Standard Webhooks HMAC-SHA256 signature used by Polar.sh webhooks.
 */
export async function verifyPolarWebhookSignature(
  rawBody: string,
  headers: Headers,
  secretOverride?: string,
): Promise<boolean> {
  const secret = (secretOverride ?? readPolarEnv('POLAR_WEBHOOK_SECRET')).trim();
  if (!secret) return false;
  const webhookId = headers.get('webhook-id') ?? '';
  const webhookTimestamp = headers.get('webhook-timestamp') ?? '';
  const webhookSignature = headers.get('webhook-signature') ?? '';
  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

  const tsNum = Number(webhookTimestamp);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    return false;
  }

  const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    const binary = atob(cleanSecret);
    keyBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) keyBytes[i] = binary.charCodeAt(i);
  } catch {
    keyBytes = new TextEncoder().encode(cleanSecret);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const macBuffer = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(signedContent));
  const expectedBytes = new Uint8Array(macBuffer);

  const candidates = webhookSignature.split(/\s+/).filter(Boolean);
  for (const candidate of candidates) {
    const [version, sigB64] = candidate.split(',', 2);
    if (version !== 'v1' || !sigB64) continue;
    try {
      const bin = atob(sigB64);
      const sigBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) sigBytes[i] = bin.charCodeAt(i);
      if (constantTimeEqual(expectedBytes, sigBytes)) return true;
    } catch {
      continue;
    }
  }
  return false;
}
