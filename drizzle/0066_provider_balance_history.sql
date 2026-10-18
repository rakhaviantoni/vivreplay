CREATE TABLE IF NOT EXISTS `provider_balance_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`balance` integer NOT NULL,
	`currency` text NOT NULL DEFAULT 'IDR',
	`mode` text NOT NULL DEFAULT 'production',
	`recorded_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS `provider_balance_snapshots_provider_time` ON `provider_balance_snapshots` (`provider`, `recorded_at`);
