import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/database';

/**
 * WhatsApp Business API Webhooks Handler
 * 
 * Receives real-time updates about:
 * - 💬 Incoming messages from customers
 * - ✅ Message delivery status (sent, delivered, read)
 * - 👤 Customer profile changes
 * - 📱 Account updates
 * 
 * Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */

const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'vivreplay_whatsapp_webhook_2024';

/**
 * GET handler for webhook verification
 * WhatsApp/Facebook will call this to verify your webhook endpoint
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[WhatsApp Webhook] Verification request:', { mode, token: token?.substring(0, 10) + '...' });

  // Verify the webhook
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('[WhatsApp Webhook] ✅ Verification successful');
    // Return the challenge to complete verification
    return new NextResponse(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  console.error('[WhatsApp Webhook] ❌ Verification failed - token mismatch');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST handler for webhook events
 * WhatsApp sends updates as POST requests to this endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[WhatsApp Webhook] Received event:', JSON.stringify(body, null, 2));

    // Verify the request signature (recommended for production)
    const signature = request.headers.get('x-hub-signature-256');
    if (signature && process.env.WHATSAPP_APP_SECRET) {
      const bodyText = JSON.stringify(body);
      const isValid = await verifyWebhookSignature(
        bodyText,
        signature,
        process.env.WHATSAPP_APP_SECRET
      );
      
      if (!isValid) {
        console.error('[WhatsApp Webhook] ❌ Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    // Process each entry in the webhook payload
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        await processWhatsAppEntry(entry);
      }
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[WhatsApp Webhook] Error processing webhook:', error);
    // Still return 200 to prevent WhatsApp from retrying
    return NextResponse.json({ success: false }, { status: 200 });
  }
}

async function processWhatsAppEntry(entry: any) {
  const { id, changes } = entry;
  
  console.log(`[WhatsApp Webhook] Processing entry ${id}`);

  for (const change of changes || []) {
    const { field, value } = change;
    
    console.log(`[WhatsApp Webhook] Change detected: ${field}`);

    switch (field) {
      case 'messages':
        await handleMessageEvent(value);
        break;
      
      case 'message_status':
        await handleStatusEvent(value);
        break;
      
      case 'account_update':
        await handleAccountUpdate(value);
        break;
      
      default:
        console.log(`[WhatsApp Webhook] Unhandled field type: ${field}`);
    }
  }
}

async function handleMessageEvent(value: any) {
  const { messaging_product, metadata, contacts, messages } = value;
  
  if (!messages || messages.length === 0) return;

  for (const message of messages) {
    const { id, from, timestamp, type, text, image, document, audio, video } = message;
    
    console.log(`[WhatsApp Webhook] 💬 New message from ${from}:`, {
      id,
      type,
      timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
    });

    // Extract message content based on type
    let messageText = '';
    let mediaUrl = '';
    let mediaId = '';
    
    switch (type) {
      case 'text':
        messageText = text?.body || '';
        break;
      case 'image':
        mediaId = image?.id || '';
        mediaUrl = image?.link || '';
        messageText = image?.caption || '';
        break;
      case 'document':
        mediaId = document?.id || '';
        mediaUrl = document?.link || '';
        messageText = document?.filename || '';
        break;
      case 'audio':
        mediaId = audio?.id || '';
        break;
      case 'video':
        mediaId = video?.id || '';
        mediaUrl = video?.link || '';
        messageText = video?.caption || '';
        break;
    }

    // Store message in database
    try {
      const db = database();
      const contact = contacts?.[0];
      
      await db
        .prepare(
          `INSERT INTO whatsapp_webhook_events (
            id, event_type, phone_number, contact_name, 
            message_id, message_type, message_text, 
            media_id, media_url, timestamp_unix, 
            metadata, processed, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`
        )
        .bind(
          `msg_${id}`,
          'message',
          from,
          contact?.profile?.name || null,
          id,
          type,
          messageText || null,
          mediaId || null,
          mediaUrl || null,
          timestamp,
          JSON.stringify({ metadata, message }),
          false,
          new Date().toISOString()
        )
        .run();
      
      console.log('[WhatsApp Webhook] ✅ Message event saved to database');

      // Auto-respond logic based on message content
      await handleAutoResponse(from, messageText, type, metadata);
      
    } catch (error) {
      console.error('[WhatsApp Webhook] Failed to save message:', error);
    }
  }
}

async function handleAutoResponse(
  phoneNumber: string,
  messageText: string,
  messageType: string,
  metadata: any
) {
  // Skip auto-response for non-text messages for now
  if (messageType !== 'text' || !messageText) return;

  const lowerText = messageText.toLowerCase();

  // Check if message contains keywords that warrant auto-response
  let responseText = '';
  let shouldRespond = false;

  // Greeting messages
  if (lowerText.match(/^(hi|hello|halo|hei|hai|hey)/i)) {
    responseText = `Hi! Thanks for contacting VivrePlay 👋

I'm here to help with:
• 🃏 Card listings & prices
• 📦 Order status
• 💳 Payment info
• ❓ Questions

What can I help you with?`;
    shouldRespond = true;
  }
  // Order status inquiries
  else if (lowerText.includes('order') || lowerText.includes('pesanan') || lowerText.includes('tracking')) {
    responseText = `To check your order status:
1. Visit: vivreplay.com/account/orders
2. Or send your order number here

Need help? Let me know! 📦`;
    shouldRespond = true;
  }
  // Price inquiries
  else if (lowerText.includes('price') || lowerText.includes('harga') || lowerText.includes('berapa')) {
    responseText = `You can check card prices at:
🔍 vivreplay.com/market

Search by card name or browse by game!

Need help finding a specific card? Send me the card name.`;
    shouldRespond = true;
  }
  // Payment inquiries
  else if (lowerText.includes('payment') || lowerText.includes('bayar') || lowerText.includes('transfer')) {
    responseText = `We accept:
💳 QRIS (instant)
🏦 Bank Transfer
💰 E-wallets

All payment methods are available at checkout.

Having payment issues? Please describe the problem.`;
    shouldRespond = true;
  }

  // Send auto-response
  if (shouldRespond && responseText) {
    try {
      await sendWhatsAppMessage(
        phoneNumber,
        responseText,
        metadata.phone_number_id
      );
      console.log(`[WhatsApp Webhook] ✅ Auto-response sent to ${phoneNumber}`);
    } catch (error) {
      console.error('[WhatsApp Webhook] Failed to send auto-response:', error);
    }
  }
}

async function handleStatusEvent(value: any) {
  const { statuses } = value;
  
  if (!statuses || statuses.length === 0) return;

  for (const status of statuses) {
    const { id, status: messageStatus, timestamp, recipient_id, conversation, pricing } = status;
    
    console.log(`[WhatsApp Webhook] 📊 Status update for message ${id}:`, {
      status: messageStatus,
      recipient: recipient_id,
      timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
    });

    // Update message status in database
    try {
      const db = database();
      
      await db
        .prepare(
          `UPDATE whatsapp_webhook_events 
           SET message_status = ?, status_updated_at = ?
           WHERE message_id = ?`
        )
        .bind(
          messageStatus, // sent, delivered, read, failed
          new Date().toISOString(),
          id
        )
        .run();
      
      console.log(`[WhatsApp Webhook] ✅ Status updated: ${messageStatus}`);
    } catch (error) {
      console.error('[WhatsApp Webhook] Failed to update status:', error);
    }
  }
}

async function handleAccountUpdate(value: any) {
  console.log('[WhatsApp Webhook] 📱 Account update:', value);
  
  // Handle account-level changes
  // TODO: Update account status, phone number verification, etc.
}

async function sendWhatsAppMessage(
  phoneNumber: string,
  text: string,
  phoneNumberId: string
): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.warn('[WhatsApp] Access token not configured, skipping auto-reply');
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: text },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send WhatsApp message: ${error}`);
  }

  const result = await response.json();
  console.log('[WhatsApp] Message sent:', result);
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
    console.error('[WhatsApp Webhook] Signature verification error:', error);
    return false;
  }
}
