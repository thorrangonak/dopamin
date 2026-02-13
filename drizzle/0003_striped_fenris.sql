CREATE TABLE `casino_games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gameType` varchar(64) NOT NULL,
	`stake` decimal(12,2) NOT NULL,
	`multiplier` decimal(10,4) NOT NULL,
	`payout` decimal(12,2) NOT NULL DEFAULT '0.00',
	`result` enum('win','loss') NOT NULL,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casino_games_id` PRIMARY KEY(`id`)
);
