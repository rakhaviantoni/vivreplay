import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/database';

/**
 * Instagram Webhooks Handler
 * 
 * This endpoint receives real-time updates from Instagram about:
 * - Comments on posts
 * - Mentions in stories/posts
 * - Post insights
 * - Live video updates
 * 
 * Documentation: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */

const WEBHOOK_VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'vivreplay_instagram_webhook_2024';

/**
 * GET handler for webhook verification
 * Facebook/Instagram will call this to verify your webhook endpoint
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[Instagram Webhook] Verification request:', { mode, token: token?.substring(0, 10) + '...' });

  // Verify the webhook
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('[Instagram Webhook] ✅ Verification successful');
    // Return the challenge to complete verification
    return new NextResponse(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  console.error('[Instagram Webhook] ❌ Verification failed - token mismatch');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST handler for webhook events
 * Instagram sends updates as POST requests to this endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { object?: string; entry?: any[] };
    
    console.log('[Instagram Webhook] Received event:', JSON.stringify(body, null, 2));

    // Verify the request signature (recommended for production)
    const signature = request.headers.get('x-hub-signature-256');
    if (signature && process.env.INSTAGRAM_APP_SECRET) {
      const isValid = await verifyWebhookSignature(
        await request.text(),
        signature,
        process.env.INSTAGRAM_APP_SECRET
      );
      
      if (!isValid) {
        console.error('[Instagram Webhook] ❌ Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    // Process each entry in the webhook payload
    if (body.object === 'instagram') {
      for (const entry of body.entry || []) {
        await processInstagramEntry(entry);
      }
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Instagram Webhook] Error processing webhook:', error);
    // Still return 200 to prevent Instagram from retrying
    return NextResponse.json({ success: false }, { status: 200 });
  }
}

async function processInstagramEntry(entry: any) {
  const { id, time, changes } = entry;
  
  console.log(`[Instagram Webhook] Processing entry ${id} at ${new Date(time * 1000).toISOString()}`);

  for (const change of changes || []) {
    const { field, value } = change;
    
    console.log(`[Instagram Webhook] Change detected: ${field}`, value);

    switch (field) {
      case 'comments':
        await handleCommentEvent(value);
        break;
      
      case 'mentions':
        await handleMentionEvent(value);
        break;
      
      case 'story_insights':
        await handleStoryInsights(value);
        break;
      
      case 'live_comments':
        await handleLiveComments(value);
        break;
      
      default:
        console.log(`[Instagram Webhook] Unhandled field type: ${field}`);
    }
  }
}

async function handleCommentEvent(value: any) {
  const { media_id, comment_id, text, from } = value;
  
  console.log(`[Instagram Webhook] 💬 New comment on media ${media_id}:`, {
    comment_id,
    from: from?.username,
    text,
  });

  // Store comment in database for later processing
  try {
    const db = database();
    await db
      .prepare(
        `INSERT INTO instagram_webhook_events (id, event_type, media_id, comment_id, user_id, username, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(
        `comment_${comment_id}`,
        'comment',
        media_id,
        comment_id,
        from?.id || null,
        from?.username || null,
        text || null,
        new Date().toISOString()
      )
      .run();
    
    console.log('[Instagram Webhook] ✅ Comment event saved to database');
  } catch (error) {
    console.error('[Instagram Webhook] Failed to save comment:', error);
    // Table might not exist yet - that's okay
  }

  // TODO: Implement auto-reply logic
  // TODO: Implement notification to seller
  // TODO: Implement sentiment analysis
}

async function handleMentionEvent(value: any) {
  const { media_id, comment_id } = value;
  
  console.log(`[Instagram Webhook] 📢 Mentioned in media ${media_id}`, {
    comment_id,
  });

  // Store mention for seller notification
  try {
    const db = database();
    await db
      .prepare(
        `INSERT INTO instagram_webhook_events (id, event_type, media_id, comment_id, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(
        `mention_${media_id}_${comment_id}`,
        'mention',
        media_id,
        comment_id || null,
        new Date().toISOString()
      )
      .run();
    
    console.log('[Instagram Webhook] ✅ Mention event saved');
  } catch (error) {
    console.error('[Instagram Webhook] Failed to save mention:', error);
  }

  // TODO: Notify seller of mention
  // TODO: Track brand mentions
}

async function handleStoryInsights(value: any) {
  console.log('[Instagram Webhook] 📊 Story insights:', value);
  
  // Store story performance metrics
  // TODO: Track story views, reach, engagement
}

async function handleLiveComments(value: any) {
  console.log('[Instagram Webhook] 🔴 Live comment:', value);
  
  // Handle live video comments
  // TODO: Real-time comment moderation
}

async function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  // Verify the signature is valid
  // Format: sha256=<hash>
  const [algorithm, hash] = signature.split('=');
  
  if (algorithm !== 'sha256') {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const expectedHash = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return hash === expectedHash;
  } catch (error) {
    console.error('[Instagram Webhook] Signature verification error:', error);
    return false;
  }
}
