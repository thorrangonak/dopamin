ALTER TABLE `events_cache` ADD `scoresJson` json;--> statement-breakpoint
ALTER TABLE `events_cache` ADD `isLive` int DEFAULT 0 NOT NULL;