CREATE TABLE IF NOT EXISTS quest_claims (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  quest_key TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, quest_key)
);

CREATE INDEX IF NOT EXISTS idx_quest_claims_owner ON quest_claims(owner_id);
