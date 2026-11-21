import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { user } from '@/lib/server/store';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const profile = await user().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bucket = env.CARD_IMAGES;
  if (!bucket) {
    return NextResponse.json({ error: 'Media storage is unavailable' }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
  }

  const contentType = ALLOWED_TYPES.has(file.type) ? file.type : 'image/png';
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be between 1B and 8MB' }, { status: 400 });
  }

  const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png';
  const key = `social-drops/${profile.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();

  await bucket.put(key, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=2592000',
    },
  });

  const origin = process.env.VIVREPLAY_PUBLIC_URL || request.nextUrl.origin || 'https://vivreplay.com';
  return NextResponse.json({
    url: `${origin}/api/market/social/media?key=${encodeURIComponent(key)}`,
    key,
  });
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') || '';
  if (!key.startsWith('social-drops/') || key.includes('..')) {
    return NextResponse.json({ error: 'Invalid media key' }, { status: 400 });
  }

  const bucket = env.CARD_IMAGES;
  if (!bucket) {
    return NextResponse.json({ error: 'Media storage unavailable' }, { status: 503 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
  headers.set('Cache-Control', 'public, max-age=2592000, immutable');
  return new NextResponse(object.body, { status: 200, headers });
}
