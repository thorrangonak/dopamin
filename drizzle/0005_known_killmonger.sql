CREATE TABLE `banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`imageUrl` text NOT NULL,
	`ctaLink` varchar(512) NOT NULL DEFAULT '/',
	`section` enum('sports','casino','both') NOT NULL DEFAULT 'both',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banners_id` PRIMARY KEY(`id`)
);
