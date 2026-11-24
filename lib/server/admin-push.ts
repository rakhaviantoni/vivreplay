import { env } from 'cloudflare:workers';
import { db } from '@/lib/server/store';

const encoder = new TextEncoder();
let schemaReady = false;

export async function ensureAdminPushSchema() {
  if (schemaReady) return;
  await db()
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
        id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
  schemaReady = true;
}

const b64url = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const unb64url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

const join = (...parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const buffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const hmac = async (keyBytes: Uint8Array, data: Uint8Array) => {
  const key = await crypto.subtle.importKey(
    'raw',
    buffer(keyBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer(data)));
};

const expand = async (prk: Uint8Array, info: Uint8Array, length: number) =>
  (await hmac(prk, join(info, new Uint8Array([1])))).slice(0, length);

async function encryptedPayload(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
) {
  const clientPublic = unb64url(subscription.p256dh);
  const authSecret = unb64url(subscription.auth);
  const serverKeys = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair;
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));
  const peerKey = await crypto.subtle.importKey(
    'raw',
    buffer(clientPublic),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: peerKey }, serverKeys.privateKey, 256),
  );
  const ikm = await expand(
    await hmac(authSecret, shared),
    join(encoder.encode('WebPush: info\0'), clientPublic, serverPublic),
    32,
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = await expand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await expand(prk, encoder.encode('Content-Encoding: nonce\0'), 12);
  const plaintext = join(encoder.encode(payload), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', buffer(cek), { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: buffer(nonce), tagLength: 128 },
      aesKey,
      buffer(plaintext),
    ),
  );
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return join(salt, recordSize, new Uint8Array([serverPublic.length]), serverPublic, ciphertext);
}

export async function notifyAdminsPush(input: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  const vapidPublic = env.VAPID_PUBLIC_KEY;
  const privateJwk = env.VAPID_PRIVATE_JWK;
  if (!vapidPublic || !privateJwk) return;

  try {
    await ensureAdminPushSchema();
    const subscriptions = (
      await db()
        .prepare('SELECT id, endpoint, p256dh, auth FROM admin_push_subscriptions')
        .all<{ id: string; endpoint: string; p256dh: string; auth: string }>()
    ).results;
    if (!subscriptions.length) return;

    const payload = JSON.stringify({
      title: input.title,
      body: input.body.slice(0, 240),
      url: input.url?.startsWith('/') ? input.url : '/admin?section=overview',
      tag: input.tag ?? 'vivreplay-admin',
    });

    const vapid = JSON.parse(privateJwk) as JsonWebKey;
    const signingKey = await crypto.subtle.importKey(
      'jwk',
      vapid,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    const authorization = async (endpoint: string) => {
      const audience = new URL(endpoint).origin;
      const header = b64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
      const body = b64url(
        encoder.encode(
          JSON.stringify({
            aud: audience,
            exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
            sub: 'mailto:hello@vivreplay.com',
          }),
        ),
      );
      const unsigned = `${header}.${body}`;
      const signature = new Uint8Array(
        await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, encoder.encode(unsigned)),
      );
      return `vapid t=${unsigned}.${b64url(signature)}, k=${vapidPublic}`;
    };

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const body = await encryptedPayload(sub, payload);
          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              Authorization: await authorization(sub.endpoint),
              'Content-Encoding': 'aes128gcm',
              'Content-Type': 'application/octet-stream',
              TTL: '2419200',
            },
            body,
          });
          if (response.status === 404 || response.status === 410) {
            await db().prepare('DELETE FROM admin_push_subscriptions WHERE id = ?').bind(sub.id).run();
          }
        } catch (err) {
          console.error('admin_push_delivery_failed', err instanceof Error ? err.message : 'unknown');
        }
      }),
    );
  } catch (err) {
    console.error('admin_push_delivery_failed', err instanceof Error ? err.message : 'unknown');
  }
}
