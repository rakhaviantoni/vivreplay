-- Instagram Webhook Events
-- Store incoming webhook events from Instagram for processing and analytics

CREATE TABLE IF NOT EXISTS instagram_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'comment', 'mention', 'story_insight', 'live_comment'
  media_id TEXT,
  comment_id TEXT,
  user_id TEXT,
  username TEXT,
  text TEXT,
  metadata TEXT, -- JSON for additional event data
  processed BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_instagram_webhooks_media 
  ON instagram_webhook_events(media_id);

CREATE INDEX IF NOT EXISTS idx_instagram_webhooks_type 
  ON instagram_webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_instagram_webhooks_processed 
  ON instagram_webhook_events(processed, created_at);
