import { NextRequest, NextResponse } from 'next/server';
import {
  getUserSocialTesterRequest,
  upsertUserSocialTesterRequest,
} from '@/lib/server/postforme';
import { user } from '@/lib/server/store';

export async function GET() {
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const request = await getUserSocialTesterRequest(profile.id);
    return NextResponse.json({ request });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    instagramHandle?: string | null;
    facebookProfile?: string | null;
    threadsHandle?: string | null;
    platforms?: string[];
    notes?: string | null;
  } | null;

  const platforms = Array.isArray(body?.platforms)
    ? body.platforms.filter((p): p is string => typeof p === 'string' && ['instagram', 'facebook', 'threads'].includes(p.toLowerCase()))
    : [];

  const ig = body?.instagramHandle?.trim() || '';
  const fb = body?.facebookProfile?.trim() || '';
  const th = body?.threadsHandle?.trim() || '';

  if (platforms.length === 0) {
    return NextResponse.json(
      { error: 'Please select at least one social platform you want to test.' },
      { status: 400 }
    );
  }

  if (!ig && !fb && !th) {
    return NextResponse.json(
      { error: 'Please provide your Instagram handle, Facebook/Meta profile, or Threads handle.' },
      { status: 400 }
    );
  }

  try {
    const saved = await upsertUserSocialTesterRequest(profile.id, profile.username, {
      instagramHandle: ig || null,
      facebookProfile: fb || null,
      threadsHandle: th || null,
      platforms,
      notes: body?.notes ?? null,
    });
    const { notifyAdminsPush } = await import('@/lib/server/admin-push');
    await notifyAdminsPush({
      title: 'Social Tester Request',
      body: `@${profile.username ?? profile.display_name ?? 'seller'} requested ${platforms.join(', ')} access`,
      url: '/admin?section=marketplace',
      tag: 'admin-social-tester',
    });
    return NextResponse.json({ request: saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to submit request' },
      { status: 500 }
    );
  }
}
