import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/database';
import { processDueAdminSocialPosts } from '@/lib/server/admin-social';

export async function POST(request: NextRequest) {
  const secret = process.env.PRO_MEMBERSHIP_CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const summary = await processDueAdminSocialPosts(database());
  return NextResponse.json({ ok: true, ...summary });
}
