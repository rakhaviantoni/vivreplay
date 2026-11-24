import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { isCurrentUserAdmin } from '@/lib/server/admin-auth';
import { ensureAdminPushSchema } from '@/lib/server/admin-push';
import { db, errorResponse, guard } from '@/lib/server/store';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().int().positive().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(80).max(200),
    auth: z.string().min(20).max(100),
  }),
});

const removeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return Response.json({ error: 'Admin access is required.' }, { status: 403 });
  }
  try {
    await ensureAdminPushSchema();
    const row = await db()
      .prepare('SELECT COUNT(*) AS count FROM admin_push_subscriptions')
      .first<{ count: number }>();
    return Response.json(
      {
        enabled: Boolean(env.VAPID_PUBLIC_KEY),
        publicKey: env.VAPID_PUBLIC_KEY ?? null,
        subscriptionCount: row?.count ?? 0,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) {
    return Response.json({ error: 'Admin access is required.' }, { status: 403 });
  }
  try {
    guard(request);
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_JWK) {
      return Response.json({ error: 'Push notifications are not configured yet.' }, { status: 503 });
    }
    const value = subscriptionSchema.parse(await request.json());
    const endpoint = new URL(value.endpoint);
    if (endpoint.protocol !== 'https:') {
      return Response.json({ error: 'Invalid push service endpoint.' }, { status: 400 });
    }
    await ensureAdminPushSchema();
    await db()
      .prepare(
        `INSERT INTO admin_push_subscriptions (id, endpoint, p256dh, auth, user_agent, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(endpoint) DO UPDATE SET
           p256dh = excluded.p256dh,
           auth = excluded.auth,
           user_agent = excluded.user_agent,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        crypto.randomUUID(),
        value.endpoint,
        value.keys.p256dh,
        value.keys.auth,
        request.headers.get('user-agent')?.slice(0, 240) ?? null,
      )
      .run();
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await isCurrentUserAdmin())) {
    return Response.json({ error: 'Admin access is required.' }, { status: 403 });
  }
  try {
    guard(request);
    const value = removeSchema.parse(await request.json());
    await ensureAdminPushSchema();
    await db()
      .prepare('DELETE FROM admin_push_subscriptions WHERE endpoint = ?')
      .bind(value.endpoint)
      .run();
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
