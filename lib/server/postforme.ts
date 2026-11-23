import { database } from '@/lib/server/database';
import { marketListingPath, marketListingSelectorFromPath } from '@/lib/market/listing-url';
import { MARKET_FREE_SOCIAL_POSTS_PER_MONTH, MARKET_PRO_MONTHLY_SOCIAL_POSTS_PER_MONTH } from '@/lib/market/policy';
import type { PublicSocialConnection } from '@/lib/social-links';

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
  publishedAccounts?: Array<{ platform: string; username: string }>;
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

export function isFacebookConfigured(): boolean {
  return !!(process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID);
}

export function isThreadsConfigured(): boolean {
  return !!(process.env.THREADS_APP_ID || process.env.INSTAGRAM_APP_ID);
}

export async function fetchSocialAuthUrl({
  platform,
  redirectUrl,
}: {
  platform: SupportedPlatform;
  redirectUrl?: string;
}): Promise<{ url: string }> {
  // 1) Direct Instagram Login (no Facebook Page required) when INSTAGRAM_LOGIN_APP_ID is configured
  if (platform === 'instagram' && process.env.INSTAGRAM_LOGIN_APP_ID) {
    const redirectUri =
      process.env.INSTAGRAM_REDIRECT_URI ||
      `${process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com'}/api/market/social/callback`;
    const state = `instagram_direct:${crypto.randomUUID()}`;
    const params = new URLSearchParams({
      enable_fb_login: '0',
      force_authentication: '1',
      client_id: process.env.INSTAGRAM_LOGIN_APP_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'instagram_business_basic,instagram_business_content_publish',
      state,
    });

    return {
      url: `https://www.instagram.com/oauth/authorize?${params.toString()}`,
    };
  }

  // 2) Instagram API with Unified Login (Facebook Login for Business with config_id)
  if (platform === 'instagram') {
    const clientId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
    const configId = process.env.INSTAGRAM_CONFIG_ID || '1455450343222088';
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 
      `${process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com'}/api/market/social/callback`;

    if (!clientId) {
      throw new Error('Instagram App ID not configured. Set INSTAGRAM_LOGIN_APP_ID or FACEBOOK_APP_ID in environment.');
    }

    const state = `instagram:${crypto.randomUUID()}`;
    const params = new URLSearchParams({
      client_id: clientId,
      config_id: configId,
      redirect_uri: redirectUri,
      response_type: 'code',
      display: 'popup',
      prompt: 'login',
      state: state,
    });

    return { 
      url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}` 
    };
  }

  // Facebook OAuth
  if (platform === 'facebook') {
    const clientId = process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID;
    const redirectUri = `${process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com'}/api/market/social/callback`;

    if (!clientId) {
      throw new Error('Facebook App ID not configured');
    }

    const state = `facebook:${crypto.randomUUID()}`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      scope: 'pages_manage_posts,pages_read_engagement,pages_show_list,public_profile',
    });

    return { 
      url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}` 
    };
  }

  // Threads OAuth
  if (platform === 'threads') {
    const clientId = process.env.THREADS_APP_ID || process.env.INSTAGRAM_APP_ID;
    const redirectUri = `${process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com'}/api/market/social/callback`;

    if (!clientId) {
      throw new Error('Threads App ID not configured');
    }

    const state = `threads:${crypto.randomUUID()}`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      scope: 'threads_basic,threads_content_publish',
    });

    return { 
      url: `https://threads.net/oauth/authorize?${params.toString()}` 
    };
  }

  // Fallback to PostForMe API for other platforms
  const apiKey = getPostForMeApiKey();
  if (!apiKey) {
    throw new Error(`${platform} connection requires PostForMe API key or direct OAuth implementation`);
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
    throw new Error(`Social connection error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { url?: string; data?: { url?: string } };
  const authUrl = data.url || data.data?.url;
  if (!authUrl) {
    throw new Error('No authorization URL returned by social service.');
  }

  return { url: authUrl };
}

export async function getPublicSellerSocials(sellerId: string): Promise<PublicSocialConnection[]> {
  if (!sellerId) return [];
  const db = database();
  try {
    const rows = await db
      .prepare(
        `SELECT platform, platform_account_id AS platformAccountId, username, display_name AS displayName
         FROM seller_social_connections
         WHERE seller_id = ?
         ORDER BY created_at ASC`
      )
      .bind(sellerId)
      .all<PublicSocialConnection>();
    return rows.results ?? [];
  } catch {
    return [];
  }
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

type StoredSocialAccount = {
  id: string;
  platform: string;
  platformAccountId: string;
  username: string;
  accessToken: string | null;
  refreshToken: string | null;
};

/**
 * Post directly to Instagram using Graph API (supports single image or carousel up to 10 items)
 */
export async function publishToInstagram({
  igUserId,
  accessToken,
  caption,
  mediaUrls = [],
  graphHost = 'graph.facebook.com',
}: {
  igUserId: string;
  accessToken?: string | null;
  caption: string;
  mediaUrls?: string[];
  graphHost?: 'graph.facebook.com' | 'graph.instagram.com';
}): Promise<{ success: boolean; postId?: string; error?: string }> {
  const token = accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    return { success: false, error: 'Missing Instagram access token for this account' };
  }
  if (mediaUrls.length === 0) {
    return { success: false, error: 'Instagram requires at least 1 image URL' };
  }

  try {
    let creationId: string;
    const base = `https://${graphHost}/v21.0/${igUserId}`;

    if (mediaUrls.length === 1) {
      const containerParams = new URLSearchParams({
        access_token: token,
        caption,
        image_url: mediaUrls[0],
      });
      const res = await fetch(
        `${base}/media?${containerParams.toString()}`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error(`Instagram media container failed: ${await res.text()}`);
      creationId = ((await res.json()) as { id: string }).id;
    } else {
      const itemIds: string[] = [];
      for (const url of mediaUrls.slice(0, 10)) {
        const itemParams = new URLSearchParams({
          access_token: token,
          image_url: url,
          is_carousel_item: 'true',
        });
        const itemRes = await fetch(
          `${base}/media?${itemParams.toString()}`,
          { method: 'POST' }
        );
        if (!itemRes.ok) throw new Error(`Instagram carousel item failed: ${await itemRes.text()}`);
        itemIds.push(((await itemRes.json()) as { id: string }).id);
      }

      const carouselParams = new URLSearchParams({
        access_token: token,
        media_type: 'CAROUSEL',
        caption,
        children: itemIds.join(','),
      });
      const carouselRes = await fetch(
        `${base}/media?${carouselParams.toString()}`,
        { method: 'POST' }
      );
      if (!carouselRes.ok) throw new Error(`Instagram carousel failed: ${await carouselRes.text()}`);
      creationId = ((await carouselRes.json()) as { id: string }).id;
    }

    const publishParams = new URLSearchParams({
      access_token: token,
      creation_id: creationId,
    });
    const publishRes = await fetch(
      `${base}/media_publish?${publishParams.toString()}`,
      { method: 'POST' }
    );
    if (!publishRes.ok) throw new Error(`Instagram publish failed: ${await publishRes.text()}`);
    const publishData = (await publishRes.json()) as { id: string };

    return { success: true, postId: publishData.id };
  } catch (error) {
    console.error('[Instagram] Publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Instagram publish failed' };
  }
}

/**
 * Post directly to a Facebook Page using Graph API
 */
export async function publishToFacebookPage({
  pageId,
  accessToken,
  message,
  mediaUrls = [],
}: {
  pageId: string;
  accessToken: string | null;
  message: string;
  mediaUrls?: string[];
}): Promise<{ success: boolean; postId?: string; error?: string }> {
  if (!accessToken) {
    return { success: false, error: 'Missing Facebook Page access token' };
  }

  try {
    if (mediaUrls.length === 1) {
      const params = new URLSearchParams({
        access_token: accessToken,
        url: mediaUrls[0],
        caption: message,
      });
      const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos?${params.toString()}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Facebook photo post failed: ${await res.text()}`);
      const data = (await res.json()) as { id?: string; post_id?: string };
      return { success: true, postId: data.post_id || data.id };
    }

    const attachedMedia: Array<{ media_fbid: string }> = [];
    for (const url of mediaUrls.slice(0, 10)) {
      const uploadParams = new URLSearchParams({
        access_token: accessToken,
        url,
        published: 'false',
      });
      const uploadRes = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/photos?${uploadParams.toString()}`,
        { method: 'POST' }
      );
      if (!uploadRes.ok) throw new Error(`Facebook photo upload failed: ${await uploadRes.text()}`);
      const uploadData = (await uploadRes.json()) as { id: string };
      attachedMedia.push({ media_fbid: uploadData.id });
    }

    const feedRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        message,
        ...(attachedMedia.length > 0 ? { attached_media: attachedMedia } : {}),
      }),
    });
    if (!feedRes.ok) throw new Error(`Facebook feed post failed: ${await feedRes.text()}`);
    const feedData = (await feedRes.json()) as { id: string };
    return { success: true, postId: feedData.id };
  } catch (error) {
    console.error('[Facebook] Publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Facebook publish failed' };
  }
}

/**
 * Post directly to Threads using Threads Graph API
 */
export async function publishToThreads({
  threadsUserId,
  accessToken,
  text,
  mediaUrls = [],
}: {
  threadsUserId: string;
  accessToken: string | null;
  text: string;
  mediaUrls?: string[];
}): Promise<{ success: boolean; postId?: string; error?: string }> {
  if (!accessToken) {
    return { success: false, error: 'Missing Threads access token' };
  }

  try {
    let creationId: string;

    if (mediaUrls.length === 0) {
      const params = new URLSearchParams({
        access_token: accessToken,
        media_type: 'TEXT',
        text,
      });
      const res = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads?${params.toString()}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Threads text container failed: ${await res.text()}`);
      creationId = ((await res.json()) as { id: string }).id;
    } else if (mediaUrls.length === 1) {
      const params = new URLSearchParams({
        access_token: accessToken,
        media_type: 'IMAGE',
        image_url: mediaUrls[0],
        text,
      });
      const res = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads?${params.toString()}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Threads image container failed: ${await res.text()}`);
      creationId = ((await res.json()) as { id: string }).id;
    } else {
      const itemIds: string[] = [];
      for (const url of mediaUrls.slice(0, 10)) {
        const itemParams = new URLSearchParams({
          access_token: accessToken,
          media_type: 'IMAGE',
          image_url: url,
          is_carousel_item: 'true',
        });
        const itemRes = await fetch(
          `https://graph.threads.net/v1.0/${threadsUserId}/threads?${itemParams.toString()}`,
          { method: 'POST' }
        );
        if (!itemRes.ok) throw new Error(`Threads carousel item failed: ${await itemRes.text()}`);
        itemIds.push(((await itemRes.json()) as { id: string }).id);
      }

      const carouselParams = new URLSearchParams({
        access_token: accessToken,
        media_type: 'CAROUSEL',
        children: itemIds.join(','),
        text,
      });
      const carouselRes = await fetch(
        `https://graph.threads.net/v1.0/${threadsUserId}/threads?${carouselParams.toString()}`,
        { method: 'POST' }
      );
      if (!carouselRes.ok) throw new Error(`Threads carousel failed: ${await carouselRes.text()}`);
      creationId = ((await carouselRes.json()) as { id: string }).id;
    }

    const publishParams = new URLSearchParams({
      access_token: accessToken,
      creation_id: creationId,
    });
    const publishRes = await fetch(
      `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish?${publishParams.toString()}`,
      { method: 'POST' }
    );
    if (!publishRes.ok) throw new Error(`Threads publish failed: ${await publishRes.text()}`);
    const publishData = (await publishRes.json()) as { id: string };

    return { success: true, postId: publishData.id };
  } catch (error) {
    console.error('[Threads] Publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Threads publish failed' };
  }
}

export async function resolveCanonicalListingId(
  db: ReturnType<typeof database>,
  rawListingId?: string | null
): Promise<string | null> {
  const trimmed = rawListingId?.trim();
  if (!trimmed) return null;

  let segment = trimmed;
  if (segment.includes('/market/')) {
    segment = segment.split('/market/')[1]?.split('?')[0]?.split('#')[0] ?? segment;
  }
  segment = decodeURIComponent(segment).replace(/^\/+|\/+$/g, '');
  if (!segment) return null;

  try {
    const selector = marketListingSelectorFromPath(segment);
    if (selector?.kind === 'id') {
      const row = await db
        .prepare(`SELECT id FROM listings WHERE id = ? LIMIT 1`)
        .bind(selector.id)
        .first<{ id: string }>();
      return row?.id ?? null;
    }
    if (selector?.kind === 'prefix') {
      const row = await db
        .prepare(`SELECT id FROM listings WHERE id >= ? AND id < ? LIMIT 1`)
        .bind(selector.lower, selector.upper)
        .first<{ id: string }>();
      return row?.id ?? null;
    }
    const row = await db
      .prepare(`SELECT id FROM listings WHERE id = ? LIMIT 1`)
      .bind(segment)
      .first<{ id: string }>();
    return row?.id ?? null;
  } catch {
    return null;
  }
}

export async function publishOrScheduleDrop({
  sellerId,
  listingId,
  accountIds,
  text,
  mediaUrls = [],
  scheduledAt,
  includeSoldPrice = false,
}: {
  sellerId: string;
  listingId?: string | null;
  accountIds: string[];
  text: string;
  mediaUrls?: string[];
  scheduledAt?: string | null;
  includeSoldPrice?: boolean;
}): Promise<PublishResult> {
  const apiKey = getPostForMeApiKey();
  const db = database();
  const canonicalListingId = await resolveCanonicalListingId(db, listingId);
  const logId = crypto.randomUUID();
  const publicOrigin = process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com';
  const absoluteMediaUrls = mediaUrls.map((u) => {
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (u.startsWith('blob:') || u.startsWith('data:')) {
      throw new Error('Local browser media URL must be uploaded before publishing.');
    }
    return `${publicOrigin}${u.startsWith('/') ? '' : '/'}${u}`;
  });

  // Direct Meta Publishing when PostForMe API key is not configured
  if (!apiKey) {
    if (accountIds.length === 0) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Please connect and select at least one social account.',
      };
    }

    const placeholders = accountIds.map(() => '?').join(',');
    const accountsResult = await db
      .prepare(
        `SELECT id, platform, platform_account_id AS platformAccountId, username, access_token AS accessToken, refresh_token AS refreshToken
         FROM seller_social_connections
         WHERE seller_id = ? AND id IN (${placeholders})`
      )
      .bind(sellerId, ...accountIds)
      .all<StoredSocialAccount>();

    let selectedAccounts = accountsResult.results ?? [];
    if (selectedAccounts.length === 0) {
      return {
        success: false,
        status: 'FAILED',
        error: 'No valid connected social accounts found.',
      };
    }

    // Prevent duplicate publish/schedule for the same listing & platform
    if (canonicalListingId) {
      try {
        const existing = await db
          .prepare(
            `SELECT platform FROM social_publish_logs
             WHERE seller_id = ? AND listing_id = ? AND status IN ('PUBLISHED', 'SCHEDULED')`
          )
          .bind(sellerId, canonicalListingId)
          .all<{ platform: string }>();
        const alreadyDone = new Set<string>();
        for (const row of existing.results ?? []) {
          for (const p of row.platform.split(',')) {
            if (p.trim()) alreadyDone.add(p.trim().toLowerCase());
          }
        }
        selectedAccounts = selectedAccounts.filter(
          (a) => !alreadyDone.has(a.platform.toLowerCase())
        );
        if (selectedAccounts.length === 0) {
          return {
            success: false,
            status: 'FAILED',
            error: 'This listing has already been published or scheduled to the selected platform(s).',
          };
        }
      } catch {
        // Ignore if table not migrated
      }
    }

    // If scheduled for later, store queued entry in social_publish_logs
    if (scheduledAt) {
      try {
        await db
          .prepare(
            `INSERT INTO social_publish_logs (id, seller_id, listing_id, platform, status, post_id, scheduled_at, published_at, caption, include_sold_price)
             VALUES (?, ?, ?, ?, 'SCHEDULED', ?, ?, NULL, ?, ?)`
          )
          .bind(
            logId,
            sellerId,
            canonicalListingId,
            selectedAccounts.map((a) => a.platform).join(','),
            `sched_${Date.now()}`,
            new Date(scheduledAt).toISOString(),
            text,
            includeSoldPrice ? 1 : 0
          )
          .run();
      } catch {
        // Ignore if table not migrated
      }

      return {
        success: true,
        postId: `sched_${Date.now()}`,
        scheduledAt: new Date(scheduledAt).toISOString(),
        status: 'SCHEDULED',
        publishedAccounts: selectedAccounts.map((a) => ({
          platform: a.platform,
          username: a.username,
        })),
      };
    }

    // Publish immediately to each selected Meta account
    const errors: string[] = [];
    const postIds: string[] = [];
    const publishedAccounts: Array<{ platform: string; username: string }> = [];

    for (const acc of selectedAccounts) {
      let res: { success: boolean; postId?: string; error?: string };
      const p = acc.platform.toLowerCase();

      if (p === 'instagram') {
        res = await publishToInstagram({
          igUserId: acc.platformAccountId,
          accessToken: acc.accessToken,
          caption: text,
          mediaUrls: absoluteMediaUrls,
          graphHost: acc.refreshToken === 'ig_login' ? 'graph.instagram.com' : 'graph.facebook.com',
        });
      } else if (p === 'facebook') {
        res = await publishToFacebookPage({
          pageId: acc.platformAccountId,
          accessToken: acc.accessToken,
          message: text,
          mediaUrls: absoluteMediaUrls,
        });
      } else if (p === 'threads') {
        res = await publishToThreads({
          threadsUserId: acc.platformAccountId,
          accessToken: acc.accessToken,
          text,
          mediaUrls: absoluteMediaUrls,
        });
      } else {
        res = { success: false, error: `Direct publishing for ${acc.platform} is not supported yet` };
      }

      const itemLogId = crypto.randomUUID();
      if (res.success && res.postId) {
        postIds.push(res.postId);
        publishedAccounts.push({ platform: acc.platform, username: acc.username });
        try {
          await db
            .prepare(
              `INSERT INTO social_publish_logs (id, seller_id, listing_id, platform, status, post_id, scheduled_at, published_at, caption, include_sold_price)
               VALUES (?, ?, ?, ?, 'PUBLISHED', ?, NULL, ?, ?, ?)`
            )
            .bind(
              itemLogId,
              sellerId,
              canonicalListingId,
              acc.platform,
              res.postId,
              new Date().toISOString(),
              text,
              includeSoldPrice ? 1 : 0
            )
            .run();
        } catch {
          // Ignore migration lag
        }
      } else {
        const errText = res.error || 'Publish failed';
        errors.push(`@${acc.username} (${acc.platform}): ${errText}`);
        try {
          await db
            .prepare(
              `INSERT INTO social_publish_logs (id, seller_id, listing_id, platform, status, error_message, caption)
               VALUES (?, ?, ?, ?, 'FAILED', ?, ?)`
            )
            .bind(itemLogId, sellerId, canonicalListingId, acc.platform, errText, text)
            .run();
        } catch {
          // Ignore
        }
      }
    }

    if (postIds.length === 0) {
      return {
        success: false,
        status: 'FAILED',
        error: errors.join(' | ') || 'Failed to publish to selected accounts',
      };
    }

    return {
      success: true,
      postId: postIds.join(','),
      scheduledAt: null,
      status: 'PUBLISHED',
      publishedAccounts,
      ...(errors.length > 0 ? { error: `Published with warnings: ${errors.join(' | ')}` } : {}),
    };
  }

  try {
    const payload: Record<string, unknown> = {
      social_account_ids: accountIds,
      text,
      ...(absoluteMediaUrls.length > 0 ? { media_urls: absoluteMediaUrls } : {}),
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
      throw new Error(`Social publishing error (${response.status}): ${err}`);
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
          canonicalListingId,
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
        .bind(logId, sellerId, canonicalListingId, 'social', errorMsg, text)
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

export type SocialPublishLogItem = {
  id: string;
  platform: string;
  status: string;
  postId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  caption: string | null;
  username: string | null;
  permalink: string | null;
  mediaUrl: string | null;
  canRemoteDelete: boolean;
};

function isMetaDeletedError(status: number, body: Record<string, unknown> | null): boolean {
  if (status === 404) return true;
  const err = body?.error as { code?: number; error_subcode?: number; message?: string } | undefined;
  if (!err) return false;
  if (err.code === 100 || err.error_subcode === 33) return true;
  const msg = (err.message ?? '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('unsupported get request') ||
    msg.includes('object with id') ||
    msg.includes('cannot be loaded')
  );
}

async function fetchMetaPostState(
  platform: string,
  postId: string,
  acc: StoredSocialAccount
): Promise<{
  deleted: boolean;
  permalink?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
}> {
  if (!acc.accessToken) return { deleted: false };
  const p = platform.toLowerCase();
  let url = '';
  if (p === 'instagram') {
    const host = acc.refreshToken === 'ig_login' ? 'graph.instagram.com' : 'graph.facebook.com';
    const ver = host === 'graph.instagram.com' ? 'v22.0' : 'v22.0';
    url = `https://${host}/${ver}/${encodeURIComponent(postId)}?fields=id,permalink,caption,media_url,thumbnail_url,timestamp&access_token=${encodeURIComponent(acc.accessToken)}`;
  } else if (p === 'facebook') {
    url = `https://graph.facebook.com/v22.0/${encodeURIComponent(postId)}?fields=id,permalink_url,message,full_picture,created_time&access_token=${encodeURIComponent(acc.accessToken)}`;
  } else if (p === 'threads') {
    url = `https://graph.threads.net/v1.0/${encodeURIComponent(postId)}?fields=id,permalink,text,media_url,thumbnail_url,timestamp&access_token=${encodeURIComponent(acc.accessToken)}`;
  } else {
    return { deleted: false };
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      if (isMetaDeletedError(res.status, data)) {
        return { deleted: true };
      }
      return { deleted: false };
    }
    return {
      deleted: false,
      permalink: (data?.permalink as string | undefined) ?? (data?.permalink_url as string | undefined) ?? null,
      mediaUrl:
        (data?.thumbnail_url as string | undefined) ??
        (data?.media_url as string | undefined) ??
        (data?.full_picture as string | undefined) ??
        null,
      caption:
        (data?.caption as string | undefined) ??
        (data?.message as string | undefined) ??
        (data?.text as string | undefined) ??
        null,
    };
  } catch {
    return { deleted: false };
  }
}

export async function fetchAndVerifySocialPublishLogs(
  sellerId: string,
  rawListingId: string
): Promise<SocialPublishLogItem[]> {
  const db = database();
  const canonicalListingId = await resolveCanonicalListingId(db, rawListingId);
  if (!canonicalListingId) return [];

  const [logsRes, accsRes] = await Promise.all([
    db
      .prepare(
        `SELECT id, platform, status, post_id AS postId, scheduled_at AS scheduledAt, published_at AS publishedAt, caption
         FROM social_publish_logs
         WHERE seller_id = ? AND listing_id = ? AND status IN ('PUBLISHED', 'SCHEDULED')
         ORDER BY created_at DESC`
      )
      .bind(sellerId, canonicalListingId)
      .all<{
        id: string;
        platform: string;
        status: string;
        postId: string | null;
        scheduledAt: string | null;
        publishedAt: string | null;
        caption: string | null;
      }>(),
    db
      .prepare(
        `SELECT id, platform, platform_account_id AS platformAccountId, username, access_token AS accessToken, refresh_token AS refreshToken
         FROM seller_social_connections
         WHERE seller_id = ?`
      )
      .bind(sellerId)
      .all<StoredSocialAccount>(),
  ]);

  const accountsByPlatform = new Map<string, StoredSocialAccount>();
  for (const acc of accsRes.results ?? []) {
    const key = acc.platform.toLowerCase();
    if (!accountsByPlatform.has(key)) accountsByPlatform.set(key, acc);
  }

  const activeLogs: SocialPublishLogItem[] = [];
  for (const row of logsRes.results ?? []) {
    const p = row.platform.split(',')[0]?.trim().toLowerCase() ?? row.platform.toLowerCase();
    const acc = accountsByPlatform.get(p);

    let permalink: string | null = null;
    let mediaUrl: string | null = null;
    let liveCaption: string | null = row.caption;

    if (row.status === 'PUBLISHED' && row.postId && acc?.accessToken) {
      const state = await fetchMetaPostState(p, row.postId, acc);
      if (state.deleted) {
        await db
          .prepare(`UPDATE social_publish_logs SET status = 'DELETED' WHERE id = ? AND seller_id = ?`)
          .bind(row.id, sellerId)
          .run()
          .catch(() => {});
        continue;
      }
      if (state.permalink) permalink = state.permalink;
      if (state.mediaUrl) mediaUrl = state.mediaUrl;
      if (state.caption) liveCaption = state.caption;
    }

    activeLogs.push({
      id: row.id,
      platform: row.platform,
      status: row.status,
      postId: row.postId,
      scheduledAt: row.scheduledAt,
      publishedAt: row.publishedAt,
      caption: liveCaption,
      username: acc?.username ?? null,
      permalink,
      mediaUrl,
      canRemoteDelete: p === 'facebook' || p === 'threads',
    });
  }

  return activeLogs;
}

export async function deleteOrUnlinkSocialPublishLog(
  sellerId: string,
  logId: string
): Promise<{ success: boolean; remoteDeleted: boolean; error?: string }> {
  const db = database();
  const row = await db
    .prepare(
      `SELECT id, platform, status, post_id AS postId
       FROM social_publish_logs
       WHERE id = ? AND seller_id = ?
       LIMIT 1`
    )
    .bind(logId, sellerId)
    .first<{ id: string; platform: string; status: string; postId: string | null }>();

  if (!row) {
    return { success: false, remoteDeleted: false, error: 'Publish record not found' };
  }

  const p = row.platform.split(',')[0]?.trim().toLowerCase() ?? row.platform.toLowerCase();
  let remoteDeleted = false;

  if (row.status === 'PUBLISHED' && row.postId && (p === 'facebook' || p === 'threads')) {
    const acc = await db
      .prepare(
        `SELECT id, platform, platform_account_id AS platformAccountId, username, access_token AS accessToken, refresh_token AS refreshToken
         FROM seller_social_connections
         WHERE seller_id = ? AND LOWER(platform) = ?
         LIMIT 1`
      )
      .bind(sellerId, p)
      .first<StoredSocialAccount>();

    if (acc?.accessToken) {
      const deleteUrl =
        p === 'facebook'
          ? `https://graph.facebook.com/v22.0/${encodeURIComponent(row.postId)}?access_token=${encodeURIComponent(acc.accessToken)}`
          : `https://graph.threads.net/v1.0/${encodeURIComponent(row.postId)}?access_token=${encodeURIComponent(acc.accessToken)}`;
      try {
        const res = await fetch(deleteUrl, { method: 'DELETE', signal: AbortSignal.timeout(5000) });
        if (res.ok) remoteDeleted = true;
      } catch {
        // Proceed with local DELETED status even if remote already gone
      }
    }
  }

  await db
    .prepare(`UPDATE social_publish_logs SET status = 'DELETED' WHERE id = ? AND seller_id = ?`)
    .bind(row.id, sellerId)
    .run();

  return { success: true, remoteDeleted };
}

export type SocialListingStage = 'BOOKED' | 'SOLD' | 'AVAILABLE';

function formatStageStatusLine(
  stage: SocialListingStage,
  includeSoldPrice: boolean,
  soldPrice?: number | null
): string {
  if (stage === 'BOOKED') {
    return 'BOOKED on VivrePlay (awaiting payment)';
  }
  if (stage === 'SOLD') {
    if (includeSoldPrice && soldPrice && soldPrice > 0) {
      return `SOLD on VivrePlay for Rp ${Math.round(soldPrice).toLocaleString('id-ID')}`;
    }
    return 'SOLD on VivrePlay';
  }
  return 'AVAILABLE AGAIN on VivrePlay';
}

function stripPreviousStageBanner(caption: string): string {
  return caption
    .replace(/^\[(BOOKED|SOLD|AVAILABLE AGAIN)[^\]]*\]\s*\n*/i, '')
    .trim();
}

export async function syncSocialListingStage({
  listingIds,
  stage,
  soldPrice,
}: {
  listingIds: string[];
  stage: SocialListingStage;
  soldPrice?: number | null;
}): Promise<void> {
  const uniqueIds = [...new Set(listingIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const db = database();
  for (const listingId of uniqueIds) {
    try {
      const logsRes = await db
        .prepare(
          `SELECT id, seller_id AS sellerId, platform, post_id AS postId, caption,
                  COALESCE(include_sold_price, 0) AS includeSoldPrice,
                  last_synced_stage AS lastSyncedStage
           FROM social_publish_logs
           WHERE listing_id = ? AND status = 'PUBLISHED' AND post_id IS NOT NULL
             AND (last_synced_stage IS NULL OR last_synced_stage != ?)`
        )
        .bind(listingId, stage)
        .all<{
          id: string;
          sellerId: string;
          platform: string;
          postId: string;
          caption: string | null;
          includeSoldPrice: number;
          lastSyncedStage: string | null;
        }>();

      const logs = logsRes.results ?? [];
      if (logs.length === 0) continue;

      for (const log of logs) {
        const p = log.platform.split(',')[0]?.trim().toLowerCase() ?? log.platform.toLowerCase();
        const acc = await db
          .prepare(
            `SELECT id, platform, platform_account_id AS platformAccountId, username,
                    access_token AS accessToken, refresh_token AS refreshToken
             FROM seller_social_connections
             WHERE seller_id = ? AND LOWER(platform) = ?
             LIMIT 1`
          )
          .bind(log.sellerId, p)
          .first<StoredSocialAccount>();

        if (!acc?.accessToken) continue;

        const statusLine = formatStageStatusLine(stage, Boolean(log.includeSoldPrice), soldPrice);
        let synced = false;

        if (p === 'facebook') {
          const baseCaption = stripPreviousStageBanner(log.caption ?? '');
          const updatedMessage = baseCaption ? `[${statusLine}]\n\n${baseCaption}` : `[${statusLine}]`;
          const fbRes = await fetch(
            `https://graph.facebook.com/v22.0/${encodeURIComponent(log.postId)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                message: updatedMessage,
                access_token: acc.accessToken,
              }).toString(),
              signal: AbortSignal.timeout(5000),
            }
          ).catch(() => null);
          if (fbRes?.ok) {
            synced = true;
            await db
              .prepare(`UPDATE social_publish_logs SET caption = ? WHERE id = ?`)
              .bind(updatedMessage, log.id)
              .run()
              .catch(() => {});
          }
        } else if (p === 'instagram') {
          const host = acc.refreshToken === 'ig_login' ? 'graph.instagram.com' : 'graph.facebook.com';
          const igRes = await fetch(
            `https://${host}/v22.0/${encodeURIComponent(log.postId)}/comments`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                message: statusLine,
                access_token: acc.accessToken,
              }).toString(),
              signal: AbortSignal.timeout(5000),
            }
          ).catch(() => null);
          if (igRes?.ok) synced = true;
        } else if (p === 'threads') {
          const createRes = await fetch(
            `https://graph.threads.net/v1.0/${encodeURIComponent(acc.platformAccountId)}/threads`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                media_type: 'TEXT',
                text: statusLine,
                reply_to_id: log.postId,
                access_token: acc.accessToken,
              }).toString(),
              signal: AbortSignal.timeout(5000),
            }
          ).catch(() => null);
          const createData = (await createRes?.json().catch(() => null)) as { id?: string } | null;
          if (createRes?.ok && createData?.id) {
            const pubRes = await fetch(
              `https://graph.threads.net/v1.0/${encodeURIComponent(acc.platformAccountId)}/threads_publish`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  creation_id: createData.id,
                  access_token: acc.accessToken,
                }).toString(),
                signal: AbortSignal.timeout(5000),
              }
            ).catch(() => null);
            if (pubRes?.ok) synced = true;
          }
        }

        if (synced) {
          await db
            .prepare(`UPDATE social_publish_logs SET last_synced_stage = ? WHERE id = ?`)
            .bind(stage, log.id)
            .run()
            .catch(() => {});
        }
      }
    } catch {
      // Never block order/checkout lifecycle on social sync failures
    }
  }
}

export type SellerSocialPublishLogItem = SocialPublishLogItem & {
  listingId: string | null;
  listingTitle: string | null;
  listingHref: string | null;
  listingType: string | null;
  listingStatus: string | null;
  listingAmount: number | null;
  listingCurrency: string | null;
  createdAt: string | null;
};

export async function fetchAllSellerSocialPublishLogs(
  sellerId: string
): Promise<SellerSocialPublishLogItem[]> {
  const db = database();
  const [logsRes, accsRes] = await Promise.all([
    db
      .prepare(
        `SELECT
           s.id,
           s.listing_id AS listingId,
           s.platform,
           s.status,
           s.post_id AS postId,
           s.scheduled_at AS scheduledAt,
           s.published_at AS publishedAt,
           s.caption,
           s.created_at AS createdAt,
           l.title AS listingTitle,
           l.type AS listingType,
           l.status AS listingStatus,
           l.amount AS listingAmount,
           l.currency AS listingCurrency
         FROM social_publish_logs s
         LEFT JOIN listings l ON l.id = s.listing_id
         WHERE s.seller_id = ? AND s.status IN ('PUBLISHED', 'SCHEDULED')
         ORDER BY s.created_at DESC
         LIMIT 60`
      )
      .bind(sellerId)
      .all<{
        id: string;
        listingId: string | null;
        platform: string;
        status: string;
        postId: string | null;
        scheduledAt: string | null;
        publishedAt: string | null;
        caption: string | null;
        createdAt: string | null;
        listingTitle: string | null;
        listingType: string | null;
        listingStatus: string | null;
        listingAmount: number | null;
        listingCurrency: string | null;
      }>(),
    db
      .prepare(
        `SELECT id, platform, platform_account_id AS platformAccountId, username, access_token AS accessToken, refresh_token AS refreshToken
         FROM seller_social_connections
         WHERE seller_id = ?`
      )
      .bind(sellerId)
      .all<StoredSocialAccount>(),
  ]);

  const accountsByPlatform = new Map<string, StoredSocialAccount>();
  for (const acc of accsRes.results ?? []) {
    const key = acc.platform.toLowerCase();
    if (!accountsByPlatform.has(key)) accountsByPlatform.set(key, acc);
  }

  const rows = logsRes.results ?? [];
  // Hydrate live Meta permalinks & thumbnails in parallel for up to the most recent 24 published logs
  const results = await Promise.all(
    rows.map(async (row, index): Promise<SellerSocialPublishLogItem | null> => {
      const p = row.platform.split(',')[0]?.trim().toLowerCase() ?? row.platform.toLowerCase();
      const acc = accountsByPlatform.get(p);

      let permalink: string | null = null;
      let mediaUrl: string | null = null;
      let liveCaption: string | null = row.caption;

      if (index < 24 && row.status === 'PUBLISHED' && row.postId && acc?.accessToken) {
        const state = await fetchMetaPostState(p, row.postId, acc);
        if (state.deleted) {
          await db
            .prepare(`UPDATE social_publish_logs SET status = 'DELETED' WHERE id = ? AND seller_id = ?`)
            .bind(row.id, sellerId)
            .run()
            .catch(() => {});
          return null;
        }
        if (state.permalink) permalink = state.permalink;
        if (state.mediaUrl) mediaUrl = state.mediaUrl;
        if (state.caption) liveCaption = state.caption;
      }

      const listingHref =
        row.listingId && row.listingTitle
          ? marketListingPath(row.listingTitle, row.listingId)
          : row.listingId
            ? `/market/${encodeURIComponent(row.listingId)}`
            : null;

      return {
        id: row.id,
        listingId: row.listingId,
        listingTitle: row.listingTitle,
        listingHref,
        listingType: row.listingType,
        listingStatus: row.listingStatus,
        listingAmount: row.listingAmount,
        listingCurrency: row.listingCurrency,
        createdAt: row.createdAt,
        platform: row.platform,
        status: row.status,
        postId: row.postId,
        scheduledAt: row.scheduledAt,
        publishedAt: row.publishedAt,
        caption: liveCaption,
        username: acc?.username ?? null,
        permalink,
        mediaUrl,
        canRemoteDelete: p === 'facebook' || p === 'threads',
      };
    })
  );

  return results.filter((item): item is SellerSocialPublishLogItem => item !== null);
}

export type SocialTesterRequestStatus = 'PENDING' | 'INVITED' | 'APPROVED' | 'DECLINED';

export type SocialTesterRequestRecord = {
  id: string;
  userId: string;
  username: string;
  displayName?: string | null;
  instagramHandle: string | null;
  facebookProfile: string | null;
  threadsHandle: string | null;
  platforms: string[];
  notes: string | null;
  status: SocialTesterRequestStatus;
  createdAt: string;
  updatedAt: string;
};

async function ensureSocialTesterRequestsTable() {
  const db = database();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS social_tester_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        instagram_handle TEXT,
        facebook_profile TEXT,
        threads_handle TEXT,
        platforms TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();
}

function parsePlatformsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function getUserSocialTesterRequest(
  userId: string
): Promise<SocialTesterRequestRecord | null> {
  await ensureSocialTesterRequestsTable();
  const db = database();
  const row = await db
    .prepare(
      `SELECT id, user_id AS userId, username, instagram_handle AS instagramHandle, facebook_profile AS facebookProfile, threads_handle AS threadsHandle, platforms, notes, status, created_at AS createdAt, updated_at AS updatedAt
       FROM social_tester_requests
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`
    )
    .bind(userId)
    .first<{
      id: string;
      userId: string;
      username: string;
      instagramHandle: string | null;
      facebookProfile: string | null;
      threadsHandle: string | null;
      platforms: string;
      notes: string | null;
      status: SocialTesterRequestStatus;
      createdAt: string;
      updatedAt: string;
    }>();

  if (!row) return null;
  return {
    ...row,
    platforms: parsePlatformsJson(row.platforms),
  };
}

export async function upsertUserSocialTesterRequest(
  userId: string,
  username: string,
  input: {
    instagramHandle?: string | null;
    facebookProfile?: string | null;
    threadsHandle?: string | null;
    platforms: string[];
    notes?: string | null;
  }
): Promise<SocialTesterRequestRecord> {
  await ensureSocialTesterRequestsTable();
  const db = database();
  const existing = await getUserSocialTesterRequest(userId);

  const ig = input.instagramHandle?.trim().replace(/^@+/, '') || null;
  const fb = input.facebookProfile?.trim() || null;
  const th = input.threadsHandle?.trim().replace(/^@+/, '') || null;
  const notes = input.notes?.trim().slice(0, 400) || null;
  const platformsJson = JSON.stringify(
    Array.from(new Set(input.platforms.map((p) => p.toLowerCase()).filter(Boolean)))
  );

  if (existing) {
    await db
      .prepare(
        `UPDATE social_tester_requests
         SET username = ?, instagram_handle = ?, facebook_profile = ?, threads_handle = ?, platforms = ?, notes = ?,
             status = CASE WHEN status = 'DECLINED' THEN 'PENDING' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`
      )
      .bind(username, ig, fb, th, platformsJson, notes, existing.id, userId)
      .run();
  } else {
    const id = `str_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await db
      .prepare(
        `INSERT INTO social_tester_requests (id, user_id, username, instagram_handle, facebook_profile, threads_handle, platforms, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`
      )
      .bind(id, userId, username, ig, fb, th, platformsJson, notes)
      .run();
  }

  const updated = await getUserSocialTesterRequest(userId);
  if (!updated) throw new Error('Failed to save tester request');
  return updated;
}

export async function listAdminSocialTesterRequests(): Promise<SocialTesterRequestRecord[]> {
  await ensureSocialTesterRequestsTable();
  const db = database();
  const res = await db
    .prepare(
      `SELECT r.id, r.user_id AS userId, r.username, p.display_name AS displayName,
              r.instagram_handle AS instagramHandle, r.facebook_profile AS facebookProfile, r.threads_handle AS threadsHandle,
              r.platforms, r.notes, r.status, r.created_at AS createdAt, r.updated_at AS updatedAt
       FROM social_tester_requests r
       LEFT JOIN profiles p ON p.id = r.user_id
       ORDER BY CASE r.status WHEN 'PENDING' THEN 0 WHEN 'INVITED' THEN 1 WHEN 'APPROVED' THEN 2 ELSE 3 END, r.updated_at DESC
       LIMIT 100`
    )
    .all<{
      id: string;
      userId: string;
      username: string;
      displayName: string | null;
      instagramHandle: string | null;
      facebookProfile: string | null;
      threadsHandle: string | null;
      platforms: string;
      notes: string | null;
      status: SocialTesterRequestStatus;
      createdAt: string;
      updatedAt: string;
    }>();

  return (res.results ?? []).map((row) => ({
    ...row,
    platforms: parsePlatformsJson(row.platforms),
  }));
}

export async function updateSocialTesterRequestStatus(
  id: string,
  status: SocialTesterRequestStatus
): Promise<boolean> {
  await ensureSocialTesterRequestsTable();
  const db = database();
  const res = await db
    .prepare(`UPDATE social_tester_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(status, id)
    .run();
  return Number(res.meta?.changes ?? 0) > 0;
}

export type SocialPublishQuotaInfo = {
  tier: 'free' | 'pro';
  usedThisMonth: number;
  monthlyLimit: number | null;
  remainingThisMonth: number | null;
  canSchedule: boolean;
};

export async function getSellerSocialPublishQuota(
  sellerId: string,
  tier?: string | null,
  proBillingPeriod?: string | null
): Promise<SocialPublishQuotaInfo> {
  const db = database();
  let resolvedTier = (tier ?? '').trim().toLowerCase();
  let resolvedPeriod = (proBillingPeriod ?? '').trim().toLowerCase();
  if (!resolvedTier || (resolvedTier === 'pro' && !resolvedPeriod)) {
    const profileRow = await db
      .prepare(`SELECT tier, pro_billing_period AS proBillingPeriod FROM profiles WHERE id = ?`)
      .bind(sellerId)
      .first<{ tier?: string | null; proBillingPeriod?: string | null }>()
      .catch(() => null);
    if (!resolvedTier) resolvedTier = (profileRow?.tier ?? 'free').trim().toLowerCase();
    if (!resolvedPeriod) resolvedPeriod = (profileRow?.proBillingPeriod ?? '').trim().toLowerCase();
  }
  const isPro = resolvedTier === 'pro';
  const isAnnual = isPro && resolvedPeriod === 'yearly';

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM social_publish_logs
       WHERE seller_id = ?
         AND status IN ('PUBLISHED', 'SCHEDULED')
         AND created_at >= datetime('now', '-30 days')`
    )
    .bind(sellerId)
    .first<{ count: number }>()
    .catch(() => ({ count: 0 }));

  const usedThisMonth = Number(countRow?.count ?? 0);
  const monthlyLimit = isAnnual
    ? null
    : isPro
      ? MARKET_PRO_MONTHLY_SOCIAL_POSTS_PER_MONTH
      : MARKET_FREE_SOCIAL_POSTS_PER_MONTH;
  const remainingThisMonth = monthlyLimit === null ? null : Math.max(0, monthlyLimit - usedThisMonth);

  return {
    tier: isPro ? 'pro' : 'free',
    usedThisMonth,
    monthlyLimit,
    remainingThisMonth,
    canSchedule: isPro,
  };
}
