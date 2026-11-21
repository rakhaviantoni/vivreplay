import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/database';
import { user } from '@/lib/server/store';

/**
 * OAuth callback handler for Meta (Instagram, Facebook, Threads)
 * This endpoint receives the auth code after user grants permissions
 */
export async function GET(request: NextRequest) {
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.redirect(new URL('/auth/signin?error=unauthorized', request.url));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    const errorMsg = errorDescription || error;
    console.error('[Social OAuth] Error:', errorMsg);
    return new NextResponse(
      `<!DOCTYPE html><html><body><script>
        try {
          if (window.opener) {
            window.opener.postMessage({ type: 'vivreplay:social:error', error: ${JSON.stringify(errorMsg)} }, '*');
            setTimeout(() => window.close(), 600);
          } else {
            window.location.href = '/market?social_error=' + encodeURIComponent(${JSON.stringify(errorMsg)});
          }
        } catch (e) {
          window.location.href = '/market?social_error=' + encodeURIComponent(${JSON.stringify(errorMsg)});
        }
      </script><p>Connection cancelled. Closing...</p></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/market?social_error=no_code', request.url)
    );
  }

  const platformPart = (state || '').split(':')[0];
  const isDirectIgLogin = platformPart === 'instagram_direct';
  const platform: 'instagram' | 'facebook' | 'threads' =
    platformPart === 'facebook' || platformPart === 'threads' ? platformPart : 'instagram';

  try {
    let accountId: string;
    let username: string;
    let displayName: string | null = null;
    let avatarUrl: string | null = null;
    let accessToken: string;
    let refreshTokenMarker: string | null = null;
    let expiresAt: string | null = null;

    if (isDirectIgLogin) {
      const igToken = await exchangeDirectInstagramCode(code);
      accessToken = igToken.access_token;
      refreshTokenMarker = 'ig_login';
      expiresAt = igToken.expires_in
        ? new Date(Date.now() + igToken.expires_in * 1000).toISOString()
        : null;
      const igProfile = await fetchDirectInstagramProfile(accessToken);
      accountId = igProfile.user_id || igProfile.id;
      username = igProfile.username;
      displayName = igProfile.name || null;
      avatarUrl = igProfile.profile_picture_url || null;
    } else if (platform === 'threads') {
      const threadsToken = await exchangeThreadsCodeForToken(code);
      accessToken = threadsToken.access_token;
      expiresAt = threadsToken.expires_in
        ? new Date(Date.now() + threadsToken.expires_in * 1000).toISOString()
        : null;
      const profile = await fetchThreadsProfile(accessToken);
      accountId = profile.id;
      username = profile.username;
      displayName = profile.name || null;
      avatarUrl = profile.threads_profile_picture_url || null;
    } else {
      // Instagram or Facebook Page via Meta Graph API
      const tokenResponse = await exchangeCodeForToken(code);
      const longLived = await exchangeForLongLivedFbToken(tokenResponse.access_token);
      const userAccessToken = longLived.access_token;
      const userExpiresIn = longLived.expires_in ?? tokenResponse.expires_in;

      if (platform === 'facebook') {
        const page = await fetchFacebookPageInfo(userAccessToken);
        accountId = page.id;
        username = page.name;
        displayName = page.name;
        avatarUrl = page.pictureUrl;
        // Page tokens derived from a long-lived user token do not expire
        accessToken = page.access_token;
        expiresAt = null;
      } else {
        const userInfo = await fetchInstagramUserInfo(userAccessToken);
        accountId = userInfo.id;
        username = userInfo.username;
        displayName = userInfo.name || null;
        avatarUrl = userInfo.profile_picture_url || null;
        accessToken = userAccessToken;
        expiresAt = userExpiresIn
          ? new Date(Date.now() + userExpiresIn * 1000).toISOString()
          : null;
      }
    }

    // Save to database
    const db = database();
    const connectionId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO seller_social_connections 
         (id, seller_id, platform, platform_account_id, username, display_name, avatar_url, access_token, refresh_token, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(seller_id, platform, platform_account_id) 
         DO UPDATE SET 
           username = excluded.username,
           display_name = excluded.display_name,
           avatar_url = excluded.avatar_url,
           access_token = excluded.access_token,
           refresh_token = excluded.refresh_token,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at`
      )
      .bind(
        connectionId,
        profile.id,
        platform,
        accountId,
        username,
        displayName,
        avatarUrl,
        accessToken,
        refreshTokenMarker,
        expiresAt,
        nowIso,
        nowIso
      )
      .run();

    const platformLabel = platform === 'facebook' ? 'Facebook Page' : platform === 'threads' ? 'Threads' : 'Instagram';

    // Return HTML that notifies opener and closes popup, or redirects
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#fffaf0;color:#2b2319;">
        <h3>Connected ${platformLabel}: @${username}</h3>
        <p>Closing window...</p>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({ type: 'vivreplay:social:connected', platform: ${JSON.stringify(platform)}, username: ${JSON.stringify(username)} }, '*');
              setTimeout(() => window.close(), 600);
            } else {
              window.location.href = '/market?social_connected=' + encodeURIComponent(${JSON.stringify(platform)});
            }
          } catch (e) {
            window.location.href = '/market?social_connected=' + encodeURIComponent(${JSON.stringify(platform)});
          }
        </script>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (err) {
    console.error('[Social OAuth] Failed to connect account:', err);
    const errorMsg = err instanceof Error ? err.message : 'connection_failed';
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#fffaf0;color:#2b2319;">
        <h3>Connection Failed</h3>
        <p>${errorMsg}</p>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({ type: 'vivreplay:social:error', error: ${JSON.stringify(errorMsg)} }, '*');
              setTimeout(() => window.close(), 1500);
            } else {
              window.location.href = '/market?social_error=' + encodeURIComponent(${JSON.stringify(errorMsg)});
            }
          } catch (e) {
            window.location.href = '/market?social_error=' + encodeURIComponent(${JSON.stringify(errorMsg)});
          }
        </script>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function exchangeCodeForToken(code: string) {
  const clientId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 
    `${process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com'}/api/market/social/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Instagram/Facebook app credentials not configured');
  }

  // Exchange authorization code for access token using Facebook Graph API
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type: string;
    expires_in?: number;
  };

  return {
    access_token: data.access_token,
    user_id: 0, // Will be fetched from user info
    expires_in: data.expires_in,
  };
}

async function fetchInstagramUserInfo(accessToken: string) {
  // 1) Unified Login (System User Access Token): check /me/assigned_instagram_accounts first
  const assignedRes = await fetch(
    `https://graph.facebook.com/v21.0/me/assigned_instagram_accounts?fields=id,username,name,profile_picture_url&access_token=${accessToken}`
  );
  if (assignedRes.ok) {
    const assignedData = (await assignedRes.json()) as {
      data?: Array<{
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
      }>;
    };
    const ig = assignedData.data?.[0];
    if (ig?.id) {
      return {
        id: ig.id,
        username: ig.username || 'instagram_user',
        name: ig.name,
        profile_picture_url: ig.profile_picture_url,
      };
    }
  }

  // 2) Fallback: check Facebook user and linked Pages
  const meResponse = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
  );

  if (!meResponse.ok) {
    const error = await meResponse.text();
    throw new Error(`Failed to fetch Facebook user: ${error}`);
  }

  const meData = (await meResponse.json()) as {
    id: string;
    name?: string;
  };

  // Check what permissions we actually have
  console.log('[Instagram OAuth] Checking granted permissions...');
  const permissionsResponse = await fetch(
    `https://graph.facebook.com/v21.0/me/permissions?access_token=${accessToken}`
  );
  let grantedPermissions = 'unknown';
  if (permissionsResponse.ok) {
    const permissionsData = (await permissionsResponse.json()) as {
      data?: Array<{ permission: string; status: string }>;
    };
    grantedPermissions =
      permissionsData.data
        ?.filter((p) => p.status === 'granted')
        .map((p) => p.permission)
        .join(', ') || 'none';
    console.log('[Instagram OAuth] Granted permissions:', grantedPermissions);
  }

  // Get Instagram Business accounts connected to this user's pages
  // Include more fields for debugging
  const accountsResponse = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${accessToken}`
  );

  if (!accountsResponse.ok) {
    const error = await accountsResponse.text();
    throw new Error(`Failed to fetch Instagram accounts: ${error}`);
  }

  const accountsData = (await accountsResponse.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      instagram_business_account?: {
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
      };
    }>;
  };

  console.log('[Instagram OAuth] Pages data:', JSON.stringify(accountsData, null, 2));

  // Alternative: Try getting Instagram Business accounts directly
  console.log('[Instagram OAuth] Trying alternative method: /me/instagram_accounts...');
  const igAccountsResponse = await fetch(
    `https://graph.facebook.com/v21.0/me/instagram_accounts?access_token=${accessToken}`
  );
  if (igAccountsResponse.ok) {
    const igAccountsData = await igAccountsResponse.json();
    console.log('[Instagram OAuth] Direct IG accounts:', JSON.stringify(igAccountsData, null, 2));
  }

  // Find first page with Instagram Business Account
  const pageWithIG = accountsData.data?.find((page) => page.instagram_business_account);
  
  if (!pageWithIG?.instagram_business_account) {
    // Fallback: inspect debug_token granular_scopes target_ids (Meta Business Login may grant
    // specific IG or Page IDs even when /me/accounts is empty)
    const appId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (appId && appSecret) {
      try {
        const dbgRes = await fetch(
          `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
        );
        if (dbgRes.ok) {
          const dbg = (await dbgRes.json()) as {
            data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> };
          };
          const igTargetId = dbg.data?.granular_scopes?.find(
            (g) => (g.scope === 'instagram_basic' || g.scope === 'instagram_content_publish') && g.target_ids?.length
          )?.target_ids?.[0];
          if (igTargetId) {
            const igDirectRes = await fetch(
              `https://graph.facebook.com/v21.0/${igTargetId}?fields=id,username,name,profile_picture_url,followers_count&access_token=${accessToken}`
            );
            if (igDirectRes.ok) {
              const igDirect = (await igDirectRes.json()) as {
                id: string;
                username?: string;
                name?: string;
                profile_picture_url?: string;
                followers_count?: number;
              };
              if (igDirect.id) {
                return {
                  id: igDirect.id,
                  username: igDirect.username || 'instagram_user',
                  name: igDirect.name,
                  profile_picture_url: igDirect.profile_picture_url,
                  followers_count: igDirect.followers_count,
                };
              }
            }
          }
          const pageTargetId = dbg.data?.granular_scopes?.find(
            (g) => (g.scope === 'pages_show_list' || g.scope === 'pages_read_engagement') && g.target_ids?.length
          )?.target_ids?.[0];
          if (pageTargetId) {
            const pageDirectRes = await fetch(
              `https://graph.facebook.com/v21.0/${pageTargetId}?fields=id,name,instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${accessToken}`
            );
            if (pageDirectRes.ok) {
              const pageDirect = (await pageDirectRes.json()) as {
                instagram_business_account?: {
                  id: string;
                  username?: string;
                  name?: string;
                  profile_picture_url?: string;
                  followers_count?: number;
                };
              };
              if (pageDirect.instagram_business_account) {
                return {
                  id: pageDirect.instagram_business_account.id,
                  username: pageDirect.instagram_business_account.username || 'instagram_user',
                  name: pageDirect.instagram_business_account.name,
                  profile_picture_url: pageDirect.instagram_business_account.profile_picture_url,
                  followers_count: pageDirect.instagram_business_account.followers_count,
                };
              }
            }
          }
        }
      } catch {
        // Fall through to error message below
      }
    }

    // More helpful error message
    const hasPages = accountsData.data && accountsData.data.length > 0;
    if (!hasPages) {
      throw new Error(
        `No Facebook Pages found. Permissions granted to this login: ${grantedPermissions}. ` +
          'Make sure you select your Page on the Facebook consent screen and that your Instagram Business account is linked to it.'
      );
    } else {
      const pageNames = accountsData.data?.map(p => p.name).join(', ') || 'Unknown';
      throw new Error(`Found Facebook Pages (${pageNames}), but no Instagram Business Account is connected. Please go to your Facebook Page settings and connect your Instagram Business account.`);
    }
  }

  const igAccount = pageWithIG.instagram_business_account;
  
  // If username is missing from the nested query, fetch it separately
  if (!igAccount.username) {
    const igDetailResponse = await fetch(
      `https://graph.facebook.com/v21.0/${igAccount.id}?fields=id,username,name,profile_picture_url,followers_count&access_token=${accessToken}`
    );
    
    if (igDetailResponse.ok) {
      const igDetailData = (await igDetailResponse.json()) as {
        id: string;
        username: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
      };
      
      return igDetailData;
    }
  }

  return {
    id: igAccount.id,
    username: igAccount.username || 'instagram_user',
    name: igAccount.name,
    profile_picture_url: igAccount.profile_picture_url,
    followers_count: igAccount.followers_count,
  };
}

async function exchangeForLongLivedFbToken(shortLivedToken: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const clientId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  if (!clientId || !clientSecret) {
    return { access_token: shortLivedToken };
  }

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`,
    { method: 'GET' }
  );

  if (!res.ok) {
    console.warn('[Social OAuth] Long-lived token exchange skipped:', await res.text());
    return { access_token: shortLivedToken };
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  return {
    access_token: data.access_token || shortLivedToken,
    expires_in: data.expires_in,
  };
}

async function fetchFacebookPageInfo(accessToken: string): Promise<{
  id: string;
  name: string;
  access_token: string;
  pictureUrl: string | null;
}> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,picture{url}&access_token=${accessToken}`
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch Facebook Pages: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      picture?: { data?: { url?: string } };
    }>;
  };

  const page = data.data?.[0];
  if (!page) {
    throw new Error('No Facebook Pages found. Make sure you select a Facebook Page during login.');
  }

  return {
    id: page.id,
    name: page.name,
    access_token: page.access_token,
    pictureUrl: page.picture?.data?.url ?? null,
  };
}

async function exchangeThreadsCodeForToken(code: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const clientId = process.env.THREADS_APP_ID || process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.THREADS_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;
  const redirectUri =
    process.env.THREADS_REDIRECT_URI ||
    `${process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com'}/api/market/social/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Threads app credentials not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const shortRes = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!shortRes.ok) {
    throw new Error(`Threads token exchange failed: ${await shortRes.text()}`);
  }

  const shortData = (await shortRes.json()) as { access_token: string };

  const longParams = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: clientSecret,
    access_token: shortData.access_token,
  });

  const longRes = await fetch(`https://graph.threads.net/access_token?${longParams.toString()}`);
  if (!longRes.ok) {
    return { access_token: shortData.access_token };
  }

  const longData = (await longRes.json()) as { access_token?: string; expires_in?: number };
  return {
    access_token: longData.access_token || shortData.access_token,
    expires_in: longData.expires_in,
  };
}

async function fetchThreadsProfile(accessToken: string): Promise<{
  id: string;
  username: string;
  name?: string;
  threads_profile_picture_url?: string;
}> {
  const res = await fetch(
    `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${accessToken}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Threads profile: ${await res.text()}`);
  }
  return (await res.json()) as {
    id: string;
    username: string;
    name?: string;
    threads_profile_picture_url?: string;
  };
}

async function exchangeDirectInstagramCode(code: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const clientId = process.env.INSTAGRAM_LOGIN_APP_ID;
  const clientSecret = process.env.INSTAGRAM_LOGIN_APP_SECRET;
  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI ||
    `${process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com'}/api/market/social/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('INSTAGRAM_LOGIN_APP_ID / INSTAGRAM_LOGIN_APP_SECRET not configured');
  }

  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!shortRes.ok) {
    throw new Error(`Instagram token exchange failed: ${await shortRes.text()}`);
  }

  const shortData = (await shortRes.json()) as { access_token: string };

  const longParams = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: clientSecret,
    access_token: shortData.access_token,
  });

  const longRes = await fetch(`https://graph.instagram.com/access_token?${longParams.toString()}`);
  if (!longRes.ok) {
    return { access_token: shortData.access_token };
  }

  const longData = (await longRes.json()) as { access_token?: string; expires_in?: number };
  return {
    access_token: longData.access_token || shortData.access_token,
    expires_in: longData.expires_in,
  };
}

async function fetchDirectInstagramProfile(accessToken: string): Promise<{
  id: string;
  user_id?: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
}> {
  const res = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url&access_token=${accessToken}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Instagram profile: ${await res.text()}`);
  }
  return (await res.json()) as {
    id: string;
    user_id?: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
  };
}
