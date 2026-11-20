CREATE TABLE IF NOT EXISTS seller_social_connections (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_account_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seller_id, platform, platform_account_id)
);

CREATE TABLE IF NOT EXISTS seller_caption_templates (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_publish_logs (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL,
  post_id TEXT,
  scheduled_at TEXT,
  published_at TEXT,
  caption TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
