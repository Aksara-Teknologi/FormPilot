CREATE TABLE `knowledge_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`site_origin` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `knowledge_packs_owner_site_idx` ON `knowledge_packs` (`owner_id`,`site_origin`);--> statement-breakpoint
CREATE TABLE `knowledge_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`pack_id` text NOT NULL,
	`match_text` text NOT NULL,
	`behavior` text NOT NULL,
	`answer_value` text,
	`priority` integer DEFAULT 100 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pack_id`) REFERENCES `knowledge_packs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_rules_pack_priority_idx` ON `knowledge_rules` (`pack_id`,`priority`);