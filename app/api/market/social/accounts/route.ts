import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { database } from '@/lib/server/database';
import { listConnectedAccounts } from '@/lib/server/postforme';

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const accounts = await listConnectedAccounts(session.user.id);
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    platform?: string;
    platformAccountId?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
  } | null;

  if (!body?.platform || !body?.platformAccountId || !body?.username) {
    return NextResponse.json({ error: 'Missing required connection details' }, { status: 400 });
  }

  const db = database();
  const id = crypto.randomUUID();

  try {
    await db
      .prepare(
        `INSERT INTO seller_social_connections (id, seller_id, platform, platform_account_id, username, display_name, avatar_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(seller_id, platform, platform_account_id) DO UPDATE SET
           username = excluded.username,
           display_name = excluded.display_name,
           avatar_url = excluded.avatar_url,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        id,
        session.user.id,
        body.platform.toLowerCase(),
        body.platformAccountId,
        body.username,
        body.displayName ?? null,
        body.avatarUrl ?? null
      )
      .run();

    const accounts = await listConnectedAccounts(session.user.id);
    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect account' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get('id');

  if (!connectionId) {
    return NextResponse.json({ error: 'Missing connection ID' }, { status: 400 });
  }

  const db = database();
  try {
    await db
      .prepare(`DELETE FROM seller_social_connections WHERE id = ? AND seller_id = ?`)
      .bind(connectionId, session.user.id)
      .run();

    const accounts = await listConnectedAccounts(session.user.id);
    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete connection' },
      { status: 500 }
    );
  }
}
