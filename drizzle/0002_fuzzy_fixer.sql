CREATE TABLE `input_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`row_hash` text NOT NULL,
	`file_name` text NOT NULL,
	`row_number` integer NOT NULL,
	`target_origin` text NOT NULL,
	`mode` text NOT NULL,
	`completed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `input_history_owner_row_target_idx` ON `input_history` (`owner_id`,`file_name`,`row_number`,`target_origin`);--> statement-breakpoint
CREATE INDEX `input_history_owner_completed_idx` ON `input_history` (`owner_id`,`completed_at`);