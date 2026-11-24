import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/database';
import { isCurrentUserAdmin } from '@/lib/server/admin-auth';
import { user } from '@/lib/server/store';
import {
  deleteAdminSocialPost,
  listAdminSocialPosts,
  saveOrPublishAdminSocialPost,
} from '@/lib/server/admin-social';

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const posts = await listAdminSocialPosts(database());
  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    title?: string;
    pillar?: string;
    locale?: 'EN' | 'ID';
    platforms?: string[];
    accountIds?: string[];
    caption?: string;
    mediaUrls?: string[];
    assetConfig?: Record<string, unknown> | null;
    mode?: 'draft' | 'schedule' | 'publish';
    scheduledAt?: string | null;
  } | null;

  if (!body?.caption?.trim()) {
    return NextResponse.json({ error: 'Caption text is required.' }, { status: 400 });
  }

  try {
    const post = await saveOrPublishAdminSocialPost(database(), profile.id, {
      id: body.id,
      title: body.title ?? 'VivrePlay Post',
      pillar: body.pillar ?? 'Campaign',
      locale: body.locale === 'ID' ? 'ID' : 'EN',
      platforms: Array.isArray(body.platforms) ? body.platforms : [],
      accountIds: Array.isArray(body.accountIds) ? body.accountIds : [],
      caption: body.caption,
      mediaUrls: Array.isArray(body.mediaUrls) ? body.mediaUrls : [],
      assetConfig: body.assetConfig ?? null,
      mode: body.mode === 'publish' || body.mode === 'schedule' ? body.mode : 'draft',
      scheduledAt: body.scheduledAt ?? null,
    });
    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save social post' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing post ID' }, { status: 400 });
  }
  await deleteAdminSocialPost(database(), id);
  return NextResponse.json({ ok: true });
}
