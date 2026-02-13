CREATE TABLE `crypto_deposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`walletId` int NOT NULL,
	`network` enum('tron','ethereum','bsc','polygon','solana','bitcoin') NOT NULL,
	`txHash` varchar(128) NOT NULL,
	`fromAddress` varchar(128),
	`amount` decimal(18,8) NOT NULL,
	`tokenSymbol` varchar(10) NOT NULL,
	`confirmations` int NOT NULL DEFAULT 0,
	`requiredConfirmations` int NOT NULL,
	`status` enum('pending','confirming','confirmed','credited','failed') NOT NULL DEFAULT 'pending',
	`creditedAt` timestamp,
	`sweepTxHash` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crypto_deposits_id` PRIMARY KEY(`id`),
	CONSTRAINT `crypto_deposits_txHash_unique` UNIQUE(`txHash`)
);
--> statement-breakpoint
CREATE TABLE `crypto_withdrawals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`network` enum('tron','ethereum','bsc','polygon','solana','bitcoin') NOT NULL,
	`toAddress` varchar(128) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`fee` decimal(12,2) NOT NULL,
	`tokenSymbol` varchar(10) NOT NULL,
	`status` enum('pending','approved','processing','completed','rejected','failed') NOT NULL DEFAULT 'pending',
	`txHash` varchar(128),
	`reviewedBy` int,
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `crypto_withdrawals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`network` enum('tron','ethereum','bsc','polygon','solana','bitcoin') NOT NULL,
	`addressIndex` int NOT NULL,
	`depositAddress` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`)
);
