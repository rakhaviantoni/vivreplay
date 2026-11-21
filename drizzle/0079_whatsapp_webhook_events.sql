-- WhatsApp Business Webhook Events
-- Store incoming messages, status updates, and account events from WhatsApp

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'message', 'status', 'account_update'
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  message_id TEXT,
  message_type TEXT, -- 'text', 'image', 'document', 'audio', 'video'
  message_text TEXT,
  message_status TEXT, -- 'sent', 'delivered', 'read', 'failed'
  media_id TEXT,
  media_url TEXT,
  timestamp_unix TEXT,
  metadata TEXT, -- JSON for additional event data
  processed BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  status_updated_at TEXT,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhooks_phone 
  ON whatsapp_webhook_events(phone_number);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhooks_message 
  ON whatsapp_webhook_events(message_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhooks_processed 
  ON whatsapp_webhook_events(processed, created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhooks_type 
  ON whatsapp_webhook_events(event_type, created_at);
