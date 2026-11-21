import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/database';
import { user } from '@/lib/server/store';
import { DEFAULT_CAPTION_TEMPLATES, type SavedCaptionTemplate } from '@/lib/social-captions';

export async function GET() {
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = database();
  try {
    const rows = await db
      .prepare(
        `SELECT id, name, body, is_default AS isDefault
         FROM seller_caption_templates
         WHERE seller_id = ?
         ORDER BY is_default DESC, created_at DESC`
      )
      .bind(profile.id)
      .all<SavedCaptionTemplate>();

    return NextResponse.json({
      templates: rows.results,
      defaults: DEFAULT_CAPTION_TEMPLATES,
    });
  } catch {
    // If table doesn't exist yet, return defaults
    return NextResponse.json({
      templates: [],
      defaults: DEFAULT_CAPTION_TEMPLATES,
    });
  }
}

export async function POST(request: NextRequest) {
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    body?: string;
    isDefault?: boolean;
  } | null;

  if (!body?.name?.trim() || !body?.body?.trim()) {
    return NextResponse.json({ error: 'Name and body are required' }, { status: 400 });
  }

  const db = database();
  const id = crypto.randomUUID();

  try {
    if (body.isDefault) {
      await db
        .prepare(`UPDATE seller_caption_templates SET is_default = 0 WHERE seller_id = ?`)
        .bind(profile.id)
        .run();
    }

    await db
      .prepare(
        `INSERT INTO seller_caption_templates (id, seller_id, name, body, is_default)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, profile.id, body.name.trim(), body.body.trim(), body.isDefault ? 1 : 0)
      .run();

    const rows = await db
      .prepare(
        `SELECT id, name, body, is_default AS isDefault
         FROM seller_caption_templates
         WHERE seller_id = ?
         ORDER BY is_default DESC, created_at DESC`
      )
      .bind(profile.id)
      .all<SavedCaptionTemplate>();

    return NextResponse.json({ success: true, templates: rows.results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save template' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get('id');

  if (!templateId) {
    return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
  }

  const db = database();
  try {
    await db
      .prepare(`DELETE FROM seller_caption_templates WHERE id = ? AND seller_id = ?`)
      .bind(templateId, profile.id)
      .run();

    const rows = await db
      .prepare(
        `SELECT id, name, body, is_default AS isDefault
         FROM seller_caption_templates
         WHERE seller_id = ?
         ORDER BY is_default DESC, created_at DESC`
      )
      .bind(profile.id)
      .all<SavedCaptionTemplate>();

    return NextResponse.json({ success: true, templates: rows.results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not delete template' },
      { status: 500 }
    );
  }
}
