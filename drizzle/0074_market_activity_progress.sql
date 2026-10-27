CREATE TABLE market_activity_events (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX market_activity_event_once
  ON market_activity_events(profile_id, action, reference_id);
CREATE INDEX market_activity_profile_created
  ON market_activity_events(profile_id, created_at);
