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
    if (listingId) {
      try {
        const existing = await db
          .prepare(
            `SELECT platform FROM social_publish_logs
             WHERE seller_id = ? AND listing_id = ? AND status IN ('PUBLISHED', 'SCHEDULED')`
          )
          .bind(sellerId, listingId)
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
            `INSERT INTO social_publish_logs (id, seller_id, listing_id, platform, status, post_id, scheduled_at, published_at, caption)
             VALUES (?, ?, ?, ?, 'SCHEDULED', ?, ?, NULL, ?)`
          )
          .bind(
            logId,
            sellerId,
            listingId ?? null,
            selectedAccounts.map((a) => a.platform).join(','),
            `sched_${Date.now()}`,
            new Date(scheduledAt).toISOString(),
            text
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
      };
    }

    // Publish immediately to each selected Meta account
    const errors: string[] = [];
    const postIds: string[] = [];

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
        try {
          await db
            .prepare(
              `INSERT INTO social_publish_logs (id, seller_id, listing_id, platform, status, post_id, scheduled_at, published_at, caption)
               VALUES (?, ?, ?, ?, 'PUBLISHED', ?, NULL, ?, ?)`
            )
            .bind(
              itemLogId,
              sellerId,
              listingId ?? null,
              acc.platform,
              res.postId,
              new Date().toISOString(),
              text
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
            .bind(itemLogId, sellerId, listingId ?? null, acc.platform, errText, text)
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
