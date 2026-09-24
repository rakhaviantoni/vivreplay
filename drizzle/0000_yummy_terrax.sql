CREATE TABLE `card_asset_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text NOT NULL,
	`rights_status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`hash` text NOT NULL,
	`approved_for_display` integer DEFAULT 0 NOT NULL,
	`approved_for_storage` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `collectible_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`printing_id` text NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`condition` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`acquisition_amount` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`acquired_at` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`printing_id`) REFERENCES `card_printings`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "positive_quantity" CHECK("collectible_instances"."quantity">0),
	CONSTRAINT "unique_slab" CHECK("collectible_instances"."type"!='GRADED' OR "collectible_instances"."quantity"=1),
	CONSTRAINT "nonnegative_acquisition" CHECK("collectible_instances"."acquisition_amount">=0)
);
--> statement-breakpoint
CREATE INDEX `collection_owner` ON `collectible_instances` (`owner_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deck_owner` ON `decks` (`owner_id`);--> statement-breakpoint
CREATE TABLE `deck_entries` (
	`version_id` text NOT NULL,
	`card_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`version_id`, `card_id`),
	FOREIGN KEY (`version_id`) REFERENCES `deck_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `card_identities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "deck_copy_limit" CHECK("deck_entries"."quantity" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_slug_unique` ON `games` (`slug`);--> statement-breakpoint
CREATE TABLE `graded_cards` (
	`instance_id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`grade` text NOT NULL,
	`certification` text NOT NULL,
	`subgrades` text,
	`population` text,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`verification_source` text DEFAULT 'user-entered' NOT NULL,
	`verified_at` text,
	FOREIGN KEY (`instance_id`) REFERENCES `collectible_instances`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `grading_providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certification_unique` ON `graded_cards` (`provider_id`,`certification`);--> statement-breakpoint
CREATE TABLE `card_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`type` text NOT NULL,
	`cost` integer NOT NULL,
	`power` integer NOT NULL,
	`effect` text NOT NULL,
	`implementation` text DEFAULT 'DATA_ONLY' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_game_code` ON `card_identities` (`game_id`,`code`);--> statement-breakpoint
CREATE INDEX `card_filter` ON `card_identities` (`color`,`type`);--> statement-breakpoint
CREATE TABLE `import_diffs` (
	`id` text PRIMARY KEY NOT NULL,
	`import_id` text NOT NULL,
	`card_code` text NOT NULL,
	`change_type` text NOT NULL,
	`before` text,
	`after` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `raw_imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `raw_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`printing_id` text NOT NULL,
	`instance_id` text,
	`title` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`quantity` integer NOT NULL,
	`condition` text NOT NULL,
	`type` text DEFAULT 'WTS' NOT NULL,
	`city` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`printing_id`) REFERENCES `card_printings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instance_id`) REFERENCES `collectible_instances`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "price_nonnegative" CHECK("listings"."amount">=0),
	CONSTRAINT "listing_quantity" CHECK("listings"."quantity">0)
);
--> statement-breakpoint
CREATE INDEX `listing_printing_status` ON `listings` (`printing_id`,`status`);--> statement-breakpoint
CREATE TABLE `price_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`printing_id` text NOT NULL,
	`provider_id` text,
	`grade` text,
	`source` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`sale_type` text NOT NULL,
	`url` text,
	`confidence` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`printing_id`) REFERENCES `card_printings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `grading_providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `price_history` ON `price_observations` (`printing_id`,`provider_id`,`grade`,`created_at`);--> statement-breakpoint
CREATE TABLE `collectible_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`object_key` text NOT NULL,
	`role` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`instance_id`) REFERENCES `collectible_instances`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collectible_photos_object_key_unique` ON `collectible_photos` (`object_key`);--> statement-breakpoint
CREATE TABLE `card_printings` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`language` text NOT NULL,
	`set_code` text NOT NULL,
	`rarity` text NOT NULL,
	`variant` text NOT NULL,
	`asset_source_id` text,
	`image_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`identity_id`) REFERENCES `card_identities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_source_id`) REFERENCES `card_asset_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `printing_unique` ON `card_printings` (`identity_id`,`language`,`set_code`,`variant`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_subject` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`region` text DEFAULT 'ID' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`timezone` text DEFAULT 'Asia/Jakarta' NOT NULL,
	`favorite_leader` text,
	`public_collection` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_auth_subject_unique` ON `profiles` (`auth_subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_unique` ON `profiles` (`username`);--> statement-breakpoint
CREATE TABLE `grading_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`website` text,
	`lookup_template` text,
	`supports_subgrades` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grading_providers_name_unique` ON `grading_providers` (`name`);--> statement-breakpoint
CREATE TABLE `deck_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
	`number` integer NOT NULL,
	`leader_id` text NOT NULL,
	`format` text DEFAULT 'demo-data-only' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`leader_id`) REFERENCES `card_identities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deck_version_number` ON `deck_versions` (`deck_id`,`number`);--> statement-breakpoint
CREATE TABLE `wishlists` (
	`owner_id` text NOT NULL,
	`printing_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_id`, `printing_id`),
	FOREIGN KEY (`owner_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`printing_id`) REFERENCES `card_printings`(`id`) ON UPDATE no action ON DELETE no action
);
