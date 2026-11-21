import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/database';

/**
 * Threads Webhooks Handler
 * 
 * Receives real-time updates from Threads (Meta) about:
 * - 💬 Mentions and replies
 * - ❤️ Likes and reactions
 * - 🔄 Reposts and quotes
 * - 👤 Profile updates
 * 
 * Documentation: https://developers.facebook.com/docs/threads/webhooks
 */

const WEBHOOK_VERIFY_TOKEN = process.env.THREADS_WEBHOOK_VERIFY_TOKEN || 'vivreplay_threads_webhook_2024';

/**
 * GET handler for webhook verification
 * Threads/Meta will call this to verify your webhook endpoint
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[Threads Webhook] Verification request:', { mode, token: token?.substring(0, 10) + '...' });

  // Verify the webhook
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('[Threads Webhook] ✅ Verification successful');
    // Return the challenge to complete verification
    return new NextResponse(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  console.error('[Threads Webhook] ❌ Verification failed - token mismatch');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST handler for webhook events
 * Threads sends updates as POST requests to this endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { object?: string; entry?: any[] };
    
    console.log('[Threads Webhook] Received event:', JSON.stringify(body, null, 2));

    // Verify the request signature (recommended for production)
    const signature = request.headers.get('x-hub-signature-256');
    if (signature && process.env.THREADS_APP_SECRET) {
      const bodyText = JSON.stringify(body);
      const isValid = await verifyWebhookSignature(
        bodyText,
        signature,
        process.env.THREADS_APP_SECRET
      );
      
      if (!isValid) {
        console.error('[Threads Webhook] ❌ Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    // Process each entry in the webhook payload
    if (body.object === 'threads_user' || body.object === 'page') {
      for (const entry of body.entry || []) {
        await processThreadsEntry(entry);
      }
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Threads Webhook] Error processing webhook:', error);
    // Still return 200 to prevent Threads from retrying
    return NextResponse.json({ success: false }, { status: 200 });
  }
}

async function processThreadsEntry(entry: any) {
  const { id, time, changes } = entry;
  
  console.log(`[Threads Webhook] Processing entry ${id} at ${new Date(time * 1000).toISOString()}`);

  for (const change of changes || []) {
    const { field, value } = change;
    
    console.log(`[Threads Webhook] Change detected: ${field}`, value);

    switch (field) {
      case 'mentions':
        await handleMentionEvent(value);
        break;
      
      case 'replies':
        await handleReplyEvent(value);
        break;
      
      case 'quotes':
        await handleQuoteEvent(value);
        break;
      
      case 'insights':
        await handleInsightsEvent(value);
        break;
      
      default:
        console.log(`[Threads Webhook] Unhandled field type: ${field}`);
    }
  }
}

async function handleMentionEvent(value: any) {
  const { media_id, text, from } = value;
  
  console.log(`[Threads Webhook] 📢 Mentioned in thread ${media_id}:`, {
    from: from?.username,
    text,
  });

  // Store mention in database
  try {
    const db = database();
    await db
      .prepare(
        `INSERT INTO threads_webhook_events (id, event_type, media_id, user_id, username, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(
        `mention_${media_id}_${Date.now()}`,
        'mention',
        media_id,
        from?.id || null,
        from?.username || null,
        text || null,
        new Date().toISOString()
      )
      .run();
    
    console.log('[Threads Webhook] ✅ Mention event saved to database');
  } catch (error) {
    console.error('[Threads Webhook] Failed to save mention:', error);
  }

  // TODO: Notify seller of mention
  // TODO: Track brand mentions analytics
}

async function handleReplyEvent(value: any) {
  const { media_id, text, from, parent_id } = value;
  
  console.log(`[Threads Webhook] 💬 Reply to thread ${parent_id}:`, {
    from: from?.username,
    text,
  });

  // Store reply in database
  try {
    const db = database();
    await db
      .prepare(
        `INSERT INTO threads_webhook_events (id, event_type, media_id, parent_media_id, user_id, username, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(
        `reply_${media_id}`,
        'reply',
        media_id,
        parent_id || null,
        from?.id || null,
        from?.username || null,
        text || null,
        new Date().toISOString()
      )
      .run();
    
    console.log('[Threads Webhook] ✅ Reply event saved');
  } catch (error) {
    console.error('[Threads Webhook] Failed to save reply:', error);
  }

  // TODO: Auto-reply to customer inquiries
  // TODO: Notify seller of replies
}

async function handleQuoteEvent(value: any) {
  const { media_id, text, from, quoted_media_id } = value;
  
  console.log(`[Threads Webhook] 🔄 Quote of thread ${quoted_media_id}:`, {
    from: from?.username,
    text,
  });

  // Store quote in database
  try {
    const db = database();
    await db
      .prepare(
        `INSERT INTO threads_webhook_events (id, event_type, media_id, parent_media_id, user_id, username, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(
        `quote_${media_id}`,
        'quote',
        media_id,
        quoted_media_id || null,
        from?.id || null,
        from?.username || null,
        text || null,
        new Date().toISOString()
      )
      .run();
    
    console.log('[Threads Webhook] ✅ Quote event saved');
  } catch (error) {
    console.error('[Threads Webhook] Failed to save quote:', error);
  }

  // TODO: Track quote/repost analytics
}

async function handleInsightsEvent(value: any) {
  console.log('[Threads Webhook] 📊 Thread insights:', value);
  
  // Store performance metrics
  // TODO: Track thread views, engagement, reach
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
    console.error('[Threads Webhook] Signature verification error:', error);
    return false;
  }
}
