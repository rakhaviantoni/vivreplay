-- Threads Webhook Events
-- Store incoming webhook events from Threads for processing and analytics

CREATE TABLE IF NOT EXISTS threads_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'mention', 'reply', 'quote', 'insight'
  media_id TEXT,
  parent_media_id TEXT, -- For replies and quotes
  user_id TEXT,
  username TEXT,
  text TEXT,
  metadata TEXT, -- JSON for additional event data
  processed BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_threads_webhooks_media 
  ON threads_webhook_events(media_id);

CREATE INDEX IF NOT EXISTS idx_threads_webhooks_type 
  ON threads_webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_threads_webhooks_processed 
  ON threads_webhook_events(processed, created_at);
