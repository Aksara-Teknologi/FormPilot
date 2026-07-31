CREATE TABLE `workflow_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`site_origin` text NOT NULL,
	`prompt` text NOT NULL,
	`steps_json` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workflow_scenarios_owner_site_idx` ON `workflow_scenarios` (`owner_id`,`site_origin`);