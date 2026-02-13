CREATE TABLE `casino_game_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gameType` varchar(64) NOT NULL,
	`stake` decimal(12,2) NOT NULL,
	`serverSeedId` int NOT NULL,
	`nonce` int NOT NULL,
	`gameData` json,
	`commitHash` varchar(64),
	`status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
	`result` enum('win','loss'),
	`multiplier` decimal(10,4),
	`payout` decimal(12,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `casino_game_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provably_fair_seeds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serverSeed` varchar(64) NOT NULL,
	`serverSeedHash` varchar(64) NOT NULL,
	`clientSeed` varchar(64) NOT NULL,
	`nonce` int NOT NULL DEFAULT 0,
	`status` enum('active','revealed','expired') NOT NULL DEFAULT 'active',
	`revealedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provably_fair_seeds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `responsible_gambling_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(128) NOT NULL,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `responsible_gambling_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `responsible_gambling_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`selfExclusionUntil` timestamp,
	`selfExclusionType` enum('24h','7d','30d','permanent'),
	`depositLimitDaily` decimal(12,2),
	`depositLimitWeekly` decimal(12,2),
	`depositLimitMonthly` decimal(12,2),
	`lossLimitDaily` decimal(12,2),
	`lossLimitWeekly` decimal(12,2),
	`lossLimitMonthly` decimal(12,2),
	`wagerLimitDaily` decimal(12,2),
	`wagerLimitWeekly` decimal(12,2),
	`wagerLimitMonthly` decimal(12,2),
	`sessionReminderMinutes` int,
	`realityCheckMinutes` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `responsible_gambling_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `responsible_gambling_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `rtp_tracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameType` varchar(64) NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`totalWagered` decimal(14,2) NOT NULL DEFAULT '0.00',
	`totalPaidOut` decimal(14,2) NOT NULL DEFAULT '0.00',
	`totalGames` int NOT NULL DEFAULT 0,
	`rtp` decimal(8,4) NOT NULL DEFAULT '0.0000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rtp_tracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `casino_games` ADD `serverSeedHash` varchar(64);--> statement-breakpoint
ALTER TABLE `casino_games` ADD `clientSeed_pf` varchar(64);--> statement-breakpoint
ALTER TABLE `casino_games` ADD `nonce_pf` int;--> statement-breakpoint
ALTER TABLE `casino_games` ADD `hmacResult` varchar(64);--> statement-breakpoint
ALTER TABLE `casino_games` ADD `sessionId` int;