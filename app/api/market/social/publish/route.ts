import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/database';
import { publishOrScheduleDrop } from '@/lib/server/postforme';
import { user } from '@/lib/server/store';

export async function GET(request: NextRequest) {
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const listingId = request.nextUrl.searchParams.get('listingId');
  if (!listingId) {
    return NextResponse.json({ logs: [] });
  }

  const db = database();
  try {
    const rows = await db
      .prepare(
        `SELECT id, platform, status, post_id AS postId, scheduled_at AS scheduledAt, published_at AS publishedAt
         FROM social_publish_logs
         WHERE seller_id = ? AND listing_id = ? AND status IN ('PUBLISHED', 'SCHEDULED')
         ORDER BY created_at DESC`
      )
      .bind(profile.id, listingId)
      .all<{
        id: string;
        platform: string;
        status: string;
        postId: string | null;
        scheduledAt: string | null;
        publishedAt: string | null;
      }>();

    return NextResponse.json({ logs: rows.results ?? [] });
  } catch {
    return NextResponse.json({ logs: [] });
  }
}

export async function POST(request: NextRequest) {
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    listingId?: string;
    accountIds?: string[];
    text?: string;
    mediaUrls?: string[];
    scheduledAt?: string | null;
  } | null;

  if (!body?.text?.trim()) {
    return NextResponse.json({ error: 'Caption text is required' }, { status: 400 });
  }

  try {
    const result = await publishOrScheduleDrop({
      sellerId: profile.id,
      listingId: body.listingId,
      accountIds: body.accountIds ?? [],
      text: body.text.trim(),
      mediaUrls: body.mediaUrls ?? [],
      scheduledAt: body.scheduledAt,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publish failed' },
      { status: 500 }
    );
  }
}
