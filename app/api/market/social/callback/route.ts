import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { database } from '@/lib/server/database';

/**
 * OAuth callback handler for Instagram (via Facebook/Meta)
 * This endpoint receives the auth code after user grants permissions
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
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

  try {
    // Exchange code for access token
    const tokenResponse = await exchangeCodeForToken(code);
    
    // Get user info from platform
    const userInfo = await fetchInstagramUserInfo(tokenResponse.access_token);

    // Save to database
    const db = database();
    const connectionId = crypto.randomUUID();
    
    await db
      .prepare(
        `INSERT INTO seller_social_connections 
         (id, seller_id, platform, platform_account_id, username, display_name, avatar_url, access_token, refresh_token, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(seller_id, platform, platform_account_id) 
         DO UPDATE SET 
           access_token = excluded.access_token,
           refresh_token = excluded.refresh_token,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at`
      )
      .bind(
        connectionId,
        session.user.id,
        'instagram',
        userInfo.id,
        userInfo.username,
        userInfo.name || null,
        userInfo.profile_picture_url || null,
        tokenResponse.access_token,
        null, // Facebook/Instagram user access token has no refresh_token
        tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString() : null,
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();

    // Return HTML that notifies opener and closes popup, or redirects
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#fffaf0;color:#2b2319;">
        <h3>Connected Instagram: @${userInfo.username}</h3>
        <p>Closing window...</p>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({ type: 'vivreplay:social:connected', platform: 'instagram', username: ${JSON.stringify(userInfo.username)} }, '*');
              setTimeout(() => window.close(), 600);
            } else {
              window.location.href = '/market?social_connected=instagram';
            }
          } catch (e) {
            window.location.href = '/market?social_connected=instagram';
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
  // First, get the user's Instagram Business Account ID via Facebook Pages
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

  // Find first page with Instagram Business Account
  const pageWithIG = accountsData.data?.find((page) => page.instagram_business_account);
  
  if (!pageWithIG?.instagram_business_account) {
    // More helpful error message
    const hasPages = accountsData.data && accountsData.data.length > 0;
    if (!hasPages) {
      throw new Error('No Facebook Pages found. Please create a Facebook Page and connect your Instagram Business account to it.');
    } else {
      const pageNames = accountsData.data.map(p => p.name).join(', ');
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
