CREATE TABLE `vip_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalXp` int NOT NULL DEFAULT 0,
	`currentTier` enum('bronze','silver','gold','platinum','diamond','elite') NOT NULL DEFAULT 'bronze',
	`totalWagered` decimal(14,2) NOT NULL DEFAULT '0.00',
	`totalBets` int NOT NULL DEFAULT 0,
	`cashbackRate` decimal(5,4) NOT NULL DEFAULT '0.0050',
	`bonusMultiplier` decimal(5,2) NOT NULL DEFAULT '1.00',
	`lastTierUp` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vip_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vip_profiles_userId_unique` UNIQUE(`userId`)
);
