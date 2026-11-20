import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchSocialAuthUrl, type SupportedPlatform } from '@/lib/server/postforme';

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    platform?: SupportedPlatform;
    redirectUrl?: string;
  } | null;

  if (!body?.platform) {
    return NextResponse.json({ error: 'Missing platform parameter' }, { status: 400 });
  }

  try {
    const { url } = await fetchSocialAuthUrl({
      platform: body.platform,
      redirectUrl: body.redirectUrl,
    });

    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not generate auth URL' },
      { status: 500 }
    );
  }
}
