import { NextRequest, NextResponse } from 'next/server';
import { publishOrScheduleDrop } from '@/lib/server/postforme';
import { user } from '@/lib/server/store';

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
