import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to test Instagram/Facebook OAuth tokens
 * Usage: /api/market/social/debug-token?token=YOUR_TOKEN
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Missing token parameter. Usage: ?token=YOUR_TOKEN' },
      { status: 400 }
    );
  }

  try {
    const results: Record<string, any> = {};

    // 1. Check token validity and app info
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    
    if (appId && appSecret) {
      const debugResponse = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`
      );
      results.tokenDebug = await debugResponse.json();
    }

    // 2. Get user permissions
    const permissionsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${token}`
    );
    results.permissions = await permissionsResponse.json();

    // 3. Get user info
    const userResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${token}`
    );
    results.user = await userResponse.json();

    // 4. Get Facebook Pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${token}`
    );
    results.pages = await pagesResponse.json();

    // 5. Try getting Instagram accounts directly
    const igAccountsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/instagram_accounts?access_token=${token}`
    );
    results.instagramAccounts = await igAccountsResponse.json();

    // 6. Try getting businesses
    const businessesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&access_token=${token}`
    );
    results.businesses = await businessesResponse.json();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        hasPermissions: !!(results.permissions?.data && results.permissions.data.length > 0),
        grantedPermissions: results.permissions?.data?.filter((p: any) => p.status === 'granted').map((p: any) => p.permission) || [],
        declinedPermissions: results.permissions?.data?.filter((p: any) => p.status === 'declined').map((p: any) => p.permission) || [],
        pageCount: results.pages?.data?.length || 0,
        pagesWithIG: results.pages?.data?.filter((p: any) => p.instagram_business_account).length || 0,
        directIGCount: results.instagramAccounts?.data?.length || 0,
        businessCount: results.businesses?.data?.length || 0,
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

  } catch (error) {
    console.error('[Debug Token] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to debug token',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
