-- Sarapis round-17 schema delta (handoff 7) — apply to the box runtime DB out-of-band.
-- `push:true` does NOT run in the prod standalone bundle, so new collections/globals
-- need their schema applied by hand (see migration memory, round 14). Idempotent-guarded.
-- Back up first:  cp sarapis.db sarapis.db.bak-r17
BEGIN;

-- 1) Projects: 4 new columns (region / role / lineage / site).
ALTER TABLE projects ADD COLUMN region text;
ALTER TABLE projects ADD COLUMN role text;
ALTER TABLE projects ADD COLUMN lineage text;
ALTER TABLE projects ADD COLUMN site text;

-- 2) Homepage global tables + indexes (create in FK order: parent 'homepage' first).
CREATE TABLE `homepage` (
	`id` integer PRIMARY KEY NOT NULL,
	`hero_eyebrow` text DEFAULT 'Free, libre & open source',
	`hero_title` text DEFAULT 'Technology should belong to the people it serves.' NOT NULL,
	`hero_lead` text DEFAULT 'For over a decade, Sarapis has built open solutions with — not for — nonprofits and the public sector.',
	`hero_primary_cta_label` text DEFAULT 'Let’s talk',
	`hero_primary_cta_href` text DEFAULT '#contact',
	`hero_secondary_cta_label` text DEFAULT 'Read our story',
	`hero_secondary_cta_href` text DEFAULT '#about',
	`about_lede` text DEFAULT 'We help nonprofits and government agencies leverage open source software and open data to work transparently and democratically.',
	`updated_at` text,
	`created_at` text
);
CREATE TABLE `homepage_services` (
	`_order` integer NOT NULL,
	`_parent_id` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`number` text,
	`title` text NOT NULL,
	`blurb` text,
	`href` text DEFAULT '#contact',
	FOREIGN KEY (`_parent_id`) REFERENCES `homepage`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `homepage_case_studies` (
	`_order` integer NOT NULL,
	`_parent_id` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`type` text,
	`source` text,
	`title` text NOT NULL,
	`href` text DEFAULT '#',
	FOREIGN KEY (`_parent_id`) REFERENCES `homepage`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `homepage_about_paragraphs` (
	`_order` integer NOT NULL,
	`_parent_id` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`_parent_id`) REFERENCES `homepage`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `homepage_about_facts` (
	`_order` integer NOT NULL,
	`_parent_id` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`_parent_id`) REFERENCES `homepage`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `homepage_services_order_idx` ON `homepage_services` (`_order`);
CREATE INDEX `homepage_services_parent_id_idx` ON `homepage_services` (`_parent_id`);
CREATE INDEX `homepage_case_studies_order_idx` ON `homepage_case_studies` (`_order`);
CREATE INDEX `homepage_case_studies_parent_id_idx` ON `homepage_case_studies` (`_parent_id`);
CREATE INDEX `homepage_about_paragraphs_order_idx` ON `homepage_about_paragraphs` (`_order`);
CREATE INDEX `homepage_about_paragraphs_parent_id_idx` ON `homepage_about_paragraphs` (`_parent_id`);
CREATE INDEX `homepage_about_facts_order_idx` ON `homepage_about_facts` (`_order`);
CREATE INDEX `homepage_about_facts_parent_id_idx` ON `homepage_about_facts` (`_parent_id`);

COMMIT;
