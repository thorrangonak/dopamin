CREATE TABLE `balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `balances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bet_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`betId` int NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`sportKey` varchar(128) NOT NULL,
	`homeTeam` varchar(256) NOT NULL,
	`awayTeam` varchar(256) NOT NULL,
	`commenceTime` timestamp NOT NULL,
	`marketKey` varchar(64) NOT NULL,
	`outcomeName` varchar(256) NOT NULL,
	`outcomePrice` decimal(10,4) NOT NULL,
	`point` decimal(8,2),
	`status` enum('pending','won','lost','refunded') NOT NULL DEFAULT 'pending',
	`homeScore` int,
	`awayScore` int,
	`settledAt` timestamp,
	CONSTRAINT `bet_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('single','combo') NOT NULL,
	`stake` decimal(12,2) NOT NULL,
	`totalOdds` decimal(10,4) NOT NULL,
	`potentialWin` decimal(12,2) NOT NULL,
	`status` enum('pending','won','lost','partial','refunded') NOT NULL DEFAULT 'pending',
	`settledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`sportKey` varchar(128) NOT NULL,
	`homeTeam` varchar(256) NOT NULL,
	`awayTeam` varchar(256) NOT NULL,
	`commenceTime` timestamp NOT NULL,
	`completed` int NOT NULL DEFAULT 0,
	`homeScore` int,
	`awayScore` int,
	`oddsJson` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_cache_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `sports_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sportKey` varchar(128) NOT NULL,
	`groupName` varchar(128) NOT NULL,
	`title` varchar(256) NOT NULL,
	`description` text,
	`active` int NOT NULL DEFAULT 1,
	`hasOutrights` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sports_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `sports_cache_sportKey_unique` UNIQUE(`sportKey`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdraw','bet_place','bet_win','bet_refund') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
