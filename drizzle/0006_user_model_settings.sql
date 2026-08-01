CREATE TABLE `user_model_settings` (
  `user_id` text PRIMARY KEY NOT NULL,
  `base_url` text NOT NULL,
  `model` text NOT NULL,
  `encrypted_api_key` text NOT NULL,
  `updated_at` integer NOT NULL
);
