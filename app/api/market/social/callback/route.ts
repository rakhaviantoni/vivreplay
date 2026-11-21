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
  const appId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 
    `${process.env.VIVREPLAY_PUBLIC_URL || 'https://vivreplay.com'}/api/market/social/callback`;

  if (!appId || !appSecret) {
    throw new Error('Instagram/Facebook app credentials not configured');
  }

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(`https://api.instagram.com/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    user_id: number;
    expires_in?: number;
    refresh_token?: string;
  };

  return data;
}

async function fetchInstagramUserInfo(accessToken: string) {
  const response = await fetch(
    `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch user info: ${error}`);
  }

  const data = (await response.json()) as {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
    account_type?: string;
  };

  return data;
}
