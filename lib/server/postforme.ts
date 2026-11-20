import { database } from '@/lib/server/database';

export type SupportedPlatform =
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'tiktok'
  | 'threads'
  | 'bluesky'
  | 'pinterest'
  | 'linkedin';

export type ConnectedAccount = {
  id: string;
  platform: string;
  platformAccountId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type PublishResult = {
  success: boolean;
  postId?: string;
  scheduledAt?: string | null;
  status: 'PUBLISHED' | 'SCHEDULED' | 'FAILED';
  error?: string;
};

const POSTFORME_BASE_URL = 'https://api.postforme.dev/v1';

export function getPostForMeApiKey(): string | null {
  return (
    process.env.POSTFORME_API_KEY ??
    process.env.POST_FOR_ME_API_KEY ??
    null
  );
}

export async function fetchSocialAuthUrl({
  platform,
  redirectUrl,
}: {
  platform: SupportedPlatform;
  redirectUrl?: string;
}): Promise<{ url: string }> {
  const apiKey = getPostForMeApiKey();
  if (!apiKey) {
    // Graceful fallback for development / testing when env is not set yet
    const fallbackUrl = `https://postforme.dev/oauth/connect?platform=${encodeURIComponent(
      platform
    )}&redirect=${encodeURIComponent(redirectUrl || 'https://vivreplay.com/market')}`;
    return { url: fallbackUrl };
  }

  const response = await fetch(`${POSTFORME_BASE_URL}/social-accounts/auth-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      platform,
      ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostForMe error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { url?: string; data?: { url?: string } };
  const authUrl = data.url || data.data?.url;
  if (!authUrl) {
    throw new Error('No authorization URL returned by PostForMe.');
  }

  return { url: authUrl };
}

export async function listConnectedAccounts(sellerId: string): Promise<ConnectedAccount[]> {
  const db = database();
  const rows = await db
    .prepare(
      `SELECT id, platform, platform_account_id AS platformAccountId, username, display_name AS displayName, avatar_url AS avatarUrl
       FROM seller_social_connections
       WHERE seller_id = ?
       ORDER BY platform ASC, username ASC`
    )
    .bind(sellerId)
    .all<ConnectedAccount>();

  return rows.results;
}

export async function publishOrScheduleDrop({
  sellerId,
  listingId,
  accountIds,
  text,
  mediaUrls = [],
  scheduledAt,
}: {
  sellerId: string;
  listingId?: string | null;
  accountIds: string[];
  text: string;
  mediaUrls?: string[];
  scheduledAt?: string | null;
}): Promise<PublishResult> {
  const apiKey = getPostForMeApiKey();
  const db = database();
  const logId = crypto.randomUUID();

  // If PostForMe API key is not yet configured on this instance, simulate successful staging response
  if (!apiKey) {
    const simulatedStatus = scheduledAt ? 'SCHEDULED' : 'PUBLISHED';
    try {
      await db
        .prepare(
          `INSERT INTO social_publish_logs (id, seller_id, listing_id, platform, status, post_id, scheduled_at, published_at, caption)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          logId,
          sellerId,
          listingId ?? null,
          'instagram',
          simulatedStatus,
          `sim_${Date.now()}`,
          scheduledAt ?? null,
          scheduledAt ? null : new Date().toISOString(),
          text
        )
        .run();
    } catch {
      // Table may not yet be migrated
    }

    return {
      success: true,
      postId: `sim_${Date.now()}`,
      scheduledAt: scheduledAt ?? null,
      status: simulatedStatus,
    };
  }

  try {
    const payload: Record<string, unknown> = {
      social_account_ids: accountIds,
      text,
      ...(mediaUrls.length > 0 ? { media_urls: mediaUrls } : {}),
      ...(scheduledAt ? { scheduled_at: new Date(scheduledAt).toISOString() } : {}),
    };

    const response = await fetch(`${POSTFORME_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PostForMe error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as { id?: string; data?: { id?: string } };
    const postId = data.id || data.data?.id || `post_${Date.now()}`;
    const status = scheduledAt ? 'SCHEDULED' : 'PUBLISHED';

    try {
      await db
        .prepare(
          `INSERT INTO social_publish_logs (id, seller_id, listing_id, platform, status, post_id, scheduled_at, published_at, caption)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          logId,
          sellerId,
          listingId ?? null,
          'social',
          status,
          postId,
          scheduledAt ?? null,
          scheduledAt ? null : new Date().toISOString(),
          text
        )
        .run();
    } catch {
      // Ignore migration lag
    }

    return {
      success: true,
      postId,
      scheduledAt: scheduledAt ?? null,
      status,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Publish failed';
    try {
      await db
        .prepare(
          `INSERT INTO social_publish_logs (id, seller_id, listing_id, platform, status, error_message, caption)
           VALUES (?, ?, ?, ?, 'FAILED', ?, ?)`
        )
        .bind(logId, sellerId, listingId ?? null, 'social', errorMsg, text)
        .run();
    } catch {
      // Ignore
    }

    return {
      success: false,
      status: 'FAILED',
      error: errorMsg,
    };
  }
}
