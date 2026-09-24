CREATE TABLE `ai_coach_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`actor_subject` text,
	`actor_email` text,
	`ip_address` text,
	`user_agent` text,
	`locale` text DEFAULT 'EN' NOT NULL,
	`model` text NOT NULL,
	`question` text NOT NULL,
	`leader_code` text,
	`deck_size` integer DEFAULT 0 NOT NULL,
	`candidate_count` integer DEFAULT 0 NOT NULL,
	`response_text` text,
	`status` text NOT NULL,
	`error_code` text,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_coach_request_created` ON `ai_coach_requests` (`created_at`);
--> statement-breakpoint
CREATE INDEX `ai_coach_request_actor` ON `ai_coach_requests` (`actor_id`,`created_at`);
