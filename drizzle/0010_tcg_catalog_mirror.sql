-- Read-optimized mirror of Supabase's public TCG catalog.
-- Supabase remains the source of truth and fallback; files stay in Supabase Storage.
CREATE TABLE IF NOT EXISTS `tcg_games` (
  `id` TEXT PRIMARY KEY NOT NULL, `slug` TEXT NOT NULL UNIQUE, `name` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_import_runs` (
  `id` TEXT PRIMARY KEY NOT NULL, `source` TEXT NOT NULL, `status` TEXT NOT NULL,
  `summary` TEXT NOT NULL DEFAULT '{}', `started_at` TEXT NOT NULL, `completed_at` TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_card_identities` (
  `id` TEXT PRIMARY KEY NOT NULL, `game_id` TEXT NOT NULL, `code` TEXT NOT NULL,
  `name` TEXT NOT NULL, `color` TEXT NOT NULL, `card_type` TEXT NOT NULL,
  `cost` INTEGER NOT NULL, `power` INTEGER NOT NULL, `effect_text` TEXT NOT NULL DEFAULT '',
  `created_at` TEXT NOT NULL, `updated_at` TEXT NOT NULL, UNIQUE (`game_id`, `code`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_sets` (
  `id` TEXT PRIMARY KEY NOT NULL, `game_id` TEXT NOT NULL, `external_set_id` TEXT NOT NULL,
  `name` TEXT NOT NULL, `set_kind` TEXT NOT NULL DEFAULT 'booster', `created_at` TEXT NOT NULL,
  `release_date` TEXT, `description` TEXT, `official_url` TEXT, `product_image_url` TEXT,
  UNIQUE (`game_id`, `external_set_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_card_asset_sources` (
  `id` TEXT PRIMARY KEY NOT NULL, `printing_id` TEXT, `source_type` TEXT NOT NULL,
  `source_url` TEXT NOT NULL, `rights_status` TEXT NOT NULL, `observed_at` TEXT,
  `storage_path` TEXT, `approved_for_display` INTEGER NOT NULL DEFAULT 0,
  `approved_for_storage` INTEGER NOT NULL DEFAULT 0, `created_at` TEXT NOT NULL,
  `storage_variants` TEXT NOT NULL DEFAULT '{}', `stored_format` TEXT, UNIQUE (`source_url`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_card_printings` (
  `id` TEXT PRIMARY KEY NOT NULL, `identity_id` TEXT NOT NULL, `language` TEXT NOT NULL DEFAULT 'EN',
  `set_code` TEXT NOT NULL, `set_name` TEXT NOT NULL, `rarity` TEXT NOT NULL,
  `variant` TEXT NOT NULL DEFAULT 'Standard', `source_kind` TEXT NOT NULL, `asset_source_id` TEXT,
  `created_at` TEXT NOT NULL, `set_id` TEXT, `life` INTEGER, `sub_types` TEXT,
  `counter_amount` INTEGER NOT NULL DEFAULT 0, `attribute` TEXT, `card_image_id` TEXT,
  `card_image_url` TEXT, `source_inventory_price` REAL, `source_market_price` REAL,
  `source_observed_at` TEXT, `source_payload` TEXT NOT NULL DEFAULT '{}',
  `printing_code` TEXT, `release_date` TEXT, `is_reprint` INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tcg_card_printings_code_lang_set` ON `tcg_card_printings` (`printing_code`, `language`, `set_code`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_card_rules` (
  `identity_id` TEXT PRIMARY KEY NOT NULL, `colors` TEXT NOT NULL DEFAULT '[]',
  `card_type` TEXT NOT NULL, `cost` INTEGER NOT NULL DEFAULT 0, `power` INTEGER NOT NULL DEFAULT 0,
  `life` INTEGER, `counter_amount` INTEGER NOT NULL DEFAULT 0, `attributes` TEXT NOT NULL DEFAULT '[]',
  `traits` TEXT NOT NULL DEFAULT '[]', `rules_revision` TEXT, `updated_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_card_localizations` (
  `identity_id` TEXT NOT NULL, `language` TEXT NOT NULL, `name` TEXT NOT NULL,
  `effect_text` TEXT NOT NULL DEFAULT '', `traits_text` TEXT, `source_record_id` TEXT,
  `updated_at` TEXT NOT NULL, PRIMARY KEY (`identity_id`, `language`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_source_records` (
  `id` TEXT PRIMARY KEY NOT NULL, `import_run_id` TEXT, `source` TEXT NOT NULL,
  `source_key` TEXT NOT NULL, `payload` TEXT NOT NULL, `observed_at` TEXT, `created_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_card_assets` (
  `id` TEXT PRIMARY KEY NOT NULL, `printing_id` TEXT NOT NULL, `source_id` TEXT,
  `kind` TEXT NOT NULL, `object_key` TEXT NOT NULL, `mime_type` TEXT NOT NULL DEFAULT 'image/webp',
  `width` INTEGER NOT NULL, `height` INTEGER, `byte_size` INTEGER, `checksum` TEXT,
  `created_at` TEXT NOT NULL, UNIQUE (`printing_id`, `kind`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_price_observations` (
  `id` TEXT PRIMARY KEY NOT NULL, `printing_id` TEXT NOT NULL, `source` TEXT NOT NULL,
  `source_kind` TEXT NOT NULL, `amount` REAL NOT NULL, `currency` TEXT NOT NULL DEFAULT 'USD',
  `observed_at` TEXT NOT NULL, `source_record_id` TEXT,
  UNIQUE (`printing_id`, `source`, `source_kind`, `observed_at`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_card_rulings` (
  `id` TEXT PRIMARY KEY NOT NULL, `identity_id` TEXT NOT NULL, `printing_id` TEXT,
  `language` TEXT NOT NULL DEFAULT 'EN', `question` TEXT NOT NULL, `answer` TEXT NOT NULL,
  `source_url` TEXT NOT NULL, `source_reference` TEXT, `published_at` TEXT, `created_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_rulesets` (
  `id` TEXT PRIMARY KEY NOT NULL, `code` TEXT NOT NULL UNIQUE, `title` TEXT NOT NULL,
  `rules_revision` TEXT NOT NULL, `effective_from` TEXT NOT NULL, `effective_to` TEXT,
  `source_url` TEXT NOT NULL, `status` TEXT NOT NULL DEFAULT 'published',
  `rules` TEXT NOT NULL DEFAULT '{}', `created_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_card_rule_revisions` (
  `ruleset_id` TEXT NOT NULL, `identity_id` TEXT NOT NULL, `effect_text` TEXT NOT NULL DEFAULT '',
  `effect_schema` TEXT NOT NULL DEFAULT '[]', `errata_reference` TEXT, `source_url` TEXT NOT NULL,
  PRIMARY KEY (`ruleset_id`, `identity_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_matches` (
  `id` TEXT PRIMARY KEY NOT NULL, `ruleset_id` TEXT NOT NULL, `player_deck` TEXT NOT NULL,
  `opponent_deck` TEXT NOT NULL, `state` TEXT NOT NULL DEFAULT '{}',
  `status` TEXT NOT NULL DEFAULT 'active', `created_at` TEXT NOT NULL, `completed_at` TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tcg_match_events` (
  `match_id` TEXT NOT NULL, `sequence` INTEGER NOT NULL, `ruleset_id` TEXT NOT NULL,
  `action` TEXT NOT NULL, `state_hash` TEXT NOT NULL, `created_at` TEXT NOT NULL,
  PRIMARY KEY (`match_id`, `sequence`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tcg_match_events_sequence` ON `tcg_match_events` (`match_id`, `sequence`);
