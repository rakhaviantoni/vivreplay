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
    return NextResponse.redirect(
      new URL(`/market?social_error=${encodeURIComponent(errorMsg)}`, request.url)
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
        tokenResponse.refresh_token || null,
        tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString() : null,
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();

    // Redirect back to market with success
    return NextResponse.redirect(new URL('/market?social_connected=instagram', request.url));
  } catch (err) {
    console.error('[Social OAuth] Failed to connect account:', err);
    const errorMsg = err instanceof Error ? err.message : 'connection_failed';
    return NextResponse.redirect(
      new URL(`/market?social_error=${encodeURIComponent(errorMsg)}`, request.url)
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

  // Get Instagram Business accounts connected to this user
  const accountsResponse = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account&access_token=${accessToken}`
  );

  if (!accountsResponse.ok) {
    const error = await accountsResponse.text();
    throw new Error(`Failed to fetch Instagram accounts: ${error}`);
  }

  const accountsData = (await accountsResponse.json()) as {
    data?: Array<{
      instagram_business_account?: {
        id: string;
      };
    }>;
  };

  const igAccount = accountsData.data?.find((page) => page.instagram_business_account);
  if (!igAccount?.instagram_business_account) {
    throw new Error('No Instagram Business Account found. Please convert your Instagram account to a Business account and connect it to a Facebook Page.');
  }

  const igAccountId = igAccount.instagram_business_account.id;

  // Get Instagram account details
  const igResponse = await fetch(
    `https://graph.facebook.com/v21.0/${igAccountId}?fields=id,username,name,profile_picture_url,followers_count&access_token=${accessToken}`
  );

  if (!igResponse.ok) {
    const error = await igResponse.text();
    throw new Error(`Failed to fetch Instagram profile: ${error}`);
  }

  const igData = (await igResponse.json()) as {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
    followers_count?: number;
  };

  return igData;
}
