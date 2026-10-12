CREATE TABLE IF NOT EXISTS `tcg_sealed_products` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `source` TEXT NOT NULL,
  `external_id` TEXT NOT NULL,
  `game_slug` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `product_kind` TEXT NOT NULL,
  `set_code` TEXT,
  `set_name` TEXT,
  `language` TEXT NOT NULL DEFAULT '',
  `release_date` TEXT,
  `source_url` TEXT,
  `updated_at` TEXT NOT NULL,
  UNIQUE (`source`, `external_id`, `language`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tcg_sealed_products_game_set_kind`
  ON `tcg_sealed_products` (`game_slug`, `set_code`, `product_kind`, `name`);
