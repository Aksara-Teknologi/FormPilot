DROP INDEX `input_history_owner_file_row_target_idx`;--> statement-breakpoint
ALTER TABLE `input_history` ADD `sheet_name` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `input_history_owner_file_sheet_row_target_idx` ON `input_history` (`owner_id`,`file_name`,`sheet_name`,`row_number`,`target_origin`);