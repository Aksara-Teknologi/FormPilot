CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`submit_policy` text DEFAULT 'always_ask' NOT NULL,
	`updated_at` integer NOT NULL
);
