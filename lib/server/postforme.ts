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

export function isTwitterConfigured(): boolean {
  return !!process.env.TWITTER_CLIENT_ID;
}

export async function fetchSocialAuthUrl({
  platform,
  redirectUrl,
}: {
  platform: SupportedPlatform;
  redirectUrl?: string;
}): Promise<{ url: string }> {
  // Direct Instagram OAuth via Facebook
  // Note: This connects Instagram BUSINESS accounts via Facebook Page
  // Users must have Instagram Business/Creator account connected to Facebook Page
  if (platform === 'instagram') {
    const clientId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
    const configId = process.env.INSTAGRAM_CONFIG_ID || '1455450343222088';
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 
      `${process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com'}/api/market/social/callback`;

    if (!clientId) {
      throw new Error('Instagram App ID not configured. Set INSTAGRAM_APP_ID or FACEBOOK_APP_ID in environment.');
    }

    // Encode platform in state so the shared callback knows which Meta flow returned
    const state = `instagram:${crypto.randomUUID()}`;
    
    // IMPORTANT: When using config_id, Meta IGNORES the scope parameter!
    // The scopes MUST be configured in the Instagram Login Configuration in Meta Dashboard.
    // Required scopes for posting:
    // - instagram_basic (required)
    // - instagram_content_publish (required for posting)
    // - pages_show_list (required to see Facebook Pages)
    // - pages_read_engagement (required to read page data)
    // - business_management (recommended for Business accounts)
    
    // Try WITHOUT config_id first - this gives us more control over scopes
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      // Explicit scopes - will be used when config_id is not present
      scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management',
    });
    
    // Restore config_id: the configuration was confirmed to have the right
    // permissions, and Facebook Login for Business apps require it.
    if (configId) {
      params.set('config_id', configId);
    }

    return { 
      url: `https://www.facebook.com/dialog/oauth?${params.toString()}` 
    };
  }

  // Facebook OAuth (same as Instagram but different scopes)
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

  // Threads OAuth (similar to Instagram)
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

  // Twitter/X OAuth flow
  if (platform === 'twitter' || (platform as string) === 'x') {
    const clientId = process.env.TWITTER_CLIENT_ID;
    
    if (!clientId) {
      throw new Error('Twitter OAuth not configured. Set TWITTER_CLIENT_ID in environment.');
    }

    const redirectUri = `${process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com'}/api/market/social/callback`;
    const state = crypto.randomUUID();
    const codeChallenge = crypto.randomUUID(); // In production, use proper PKCE

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'plain',
      scope: 'tweet.read tweet.write users.read offline.access',
    });

    return { 
      url: `https://twitter.com/i/oauth2/authorize?${params.toString()}` 
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
};

/**
 * Post directly to Instagram using Graph API (supports single image or carousel up to 10 items)
 */
export async function publishToInstagram({
  igUserId,
  accessToken,
  caption,
  mediaUrls = [],
}: {
  igUserId: string;
  accessToken?: string | null;
  caption: string;
  mediaUrls?: string[];
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

    if (mediaUrls.length === 1) {
      const containerParams = new URLSearchParams({
        access_token: token,
        caption,
        image_url: mediaUrls[0],
      });
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media?${containerParams.toString()}`,
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
          `https://graph.facebook.com/v21.0/${igUserId}/media?${itemParams.toString()}`,
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
        `https://graph.facebook.com/v21.0/${igUserId}/media?${carouselParams.toString()}`,
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
      `https://graph.facebook.com/v21.0/${igUserId}/media_publish?${publishParams.toString()}`,
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
  const absoluteMediaUrls = mediaUrls.map((u) =>
    u.startsWith('http://') || u.startsWith('https://')
      ? u
      : `${publicOrigin}${u.startsWith('/') ? '' : '/'}${u}`
  );

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
        `SELECT id, platform, platform_account_id AS platformAccountId, username, access_token AS accessToken
         FROM seller_social_connections
         WHERE seller_id = ? AND id IN (${placeholders})`
      )
      .bind(sellerId, ...accountIds)
      .all<StoredSocialAccount>();

    const selectedAccounts = accountsResult.results ?? [];
    if (selectedAccounts.length === 0) {
      return {
        success: false,
        status: 'FAILED',
        error: 'No valid connected social accounts found.',
      };
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
