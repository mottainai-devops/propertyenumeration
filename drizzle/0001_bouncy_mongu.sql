CREATE TABLE `buildings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buildingId` varchar(255) NOT NULL,
	`businessName` text,
	`custPhone` varchar(50),
	`customerEmail` varchar(255),
	`address` text,
	`zone` varchar(100),
	`socioEconomicGroups` varchar(100),
	`geometry` text NOT NULL,
	`centerLat` varchar(50) NOT NULL,
	`centerLon` varchar(50) NOT NULL,
	`customerLabels` text,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `buildings_id` PRIMARY KEY(`id`),
	CONSTRAINT `buildings_buildingId_unique` UNIQUE(`buildingId`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(100),
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operational_lots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`lotCode` varchar(100) NOT NULL,
	`lotName` varchar(255) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_lots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pickups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` varchar(255) NOT NULL,
	`supervisorId` varchar(255),
	`customerType` varchar(50),
	`binType` varchar(50),
	`wheelieBinType` varchar(50),
	`binQuantity` int,
	`buildingId` varchar(255),
	`pickUpDate` varchar(50),
	`firstPhoto` text,
	`secondPhoto` text,
	`incidentReport` text,
	`userId` int,
	`latitude` varchar(50),
	`longitude` varchar(50),
	`synced` int NOT NULL DEFAULT 0,
	`companyId` int,
	`companyName` varchar(255),
	`lotCode` varchar(100),
	`lotName` varchar(255),
	`socioClass` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pickups_id` PRIMARY KEY(`id`),
	CONSTRAINT `pickups_formId_unique` UNIQUE(`formId`)
);
--> statement-breakpoint
CREATE TABLE `validation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pickupId` int NOT NULL,
	`validatedBy` int NOT NULL,
	`status` enum('approved','rejected') NOT NULL,
	`comments` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `validation_logs_id` PRIMARY KEY(`id`)
);
