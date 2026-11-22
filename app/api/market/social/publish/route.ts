import { NextRequest, NextResponse } from 'next/server';
import {
  deleteOrUnlinkSocialPublishLog,
  fetchAndVerifySocialPublishLogs,
  publishOrScheduleDrop,
} from '@/lib/server/postforme';
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

  try {
    const logs = await fetchAndVerifySocialPublishLogs(profile.id, listingId);
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ logs: [] });
  }
}

export async function DELETE(request: NextRequest) {
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logId = request.nextUrl.searchParams.get('logId');
  if (!logId) {
    return NextResponse.json({ error: 'Missing logId' }, { status: 400 });
  }

  try {
    const result = await deleteOrUnlinkSocialPublishLog(profile.id, logId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Delete failed' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
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
    listingId?: string;
    accountIds?: string[];
    text?: string;
    mediaUrls?: string[];
    scheduledAt?: string | null;
    includeSoldPrice?: boolean;
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
      includeSoldPrice: Boolean(body.includeSoldPrice),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publish failed' },
      { status: 500 }
    );
  }
}
