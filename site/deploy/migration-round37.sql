-- migration-round37.sql — Multi-brand CMS (Phase 1 schema)
-- Adds the Sites brand registry, Events, the two campaign write-collections,
-- and the `sites` (hasMany) scoping relationship on Posts/Pages.
--
-- ADDITIVE ONLY (new tables/columns/indexes) — no drops, so no destructive-diff
-- prompt/hang. Apply out-of-band to the box DB (push is a no-op in the prod
-- bundle). CREATE ... IF NOT EXISTS makes the CREATE half re-runnable; the
-- ALTER ... ADD COLUMN statements are NOT idempotent in SQLite — apply once, or
-- use the guarded applier in DEPLOY-round37-multibrand.md (catches
-- "duplicate column name").
--
-- DDL extracted verbatim from the local dev DB after the collections were built
-- and verified, so it matches exactly what Payload expects at runtime.

-- ============================================================
-- 1. Sites (brand registry) + its array sub-tables
-- ============================================================
CREATE TABLE IF NOT EXISTS `sites` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`domain` text,
	`site_name` text,
	`logo_id` integer,
	`footer_tagline` text,
	`default_seo_title` text,
	`default_seo_description` text,
	`default_seo_image_id` integer,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`logo_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`default_seo_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX IF NOT EXISTS `sites_key_idx` ON `sites` (`key`);
CREATE INDEX IF NOT EXISTS `sites_logo_idx` ON `sites` (`logo_id`);
CREATE INDEX IF NOT EXISTS `sites_default_seo_default_seo_image_idx` ON `sites` (`default_seo_image_id`);
CREATE INDEX IF NOT EXISTS `sites_updated_at_idx` ON `sites` (`updated_at`);
CREATE INDEX IF NOT EXISTS `sites_created_at_idx` ON `sites` (`created_at`);

CREATE TABLE IF NOT EXISTS `sites_nav` (
	`_order` integer NOT NULL,
	`_parent_id` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`href` text NOT NULL,
	FOREIGN KEY (`_parent_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `sites_nav_order_idx` ON `sites_nav` (`_order`);
CREATE INDEX IF NOT EXISTS `sites_nav_parent_id_idx` ON `sites_nav` (`_parent_id`);

CREATE TABLE IF NOT EXISTS `sites_footer_links` (
	`_order` integer NOT NULL,
	`_parent_id` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`href` text NOT NULL,
	FOREIGN KEY (`_parent_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `sites_footer_links_order_idx` ON `sites_footer_links` (`_order`);
CREATE INDEX IF NOT EXISTS `sites_footer_links_parent_id_idx` ON `sites_footer_links` (`_parent_id`);

-- ============================================================
-- 2. Events (+ events_rels for the hasMany `sites`)
-- ============================================================
CREATE TABLE IF NOT EXISTS `events` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text,
	`start_date` text,
	`end_date` text,
	`date_label` text,
	`location` text,
	`link` text,
	`published` integer DEFAULT false,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE INDEX IF NOT EXISTS `events_updated_at_idx` ON `events` (`updated_at`);
CREATE INDEX IF NOT EXISTS `events_created_at_idx` ON `events` (`created_at`);

CREATE TABLE IF NOT EXISTS `events_rels` (
	`id` integer PRIMARY KEY NOT NULL,
	`order` integer,
	`parent_id` integer NOT NULL,
	`path` text NOT NULL,
	`sites_id` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sites_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `events_rels_order_idx` ON `events_rels` (`order`);
CREATE INDEX IF NOT EXISTS `events_rels_parent_idx` ON `events_rels` (`parent_id`);
CREATE INDEX IF NOT EXISTS `events_rels_path_idx` ON `events_rels` (`path`);
CREATE INDEX IF NOT EXISTS `events_rels_sites_id_idx` ON `events_rels` (`sites_id`);

-- ============================================================
-- 3. Campaign write-collections (single `site` = originating brand)
-- ============================================================
CREATE TABLE IF NOT EXISTS `campaign_signups` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`campaign` text,
	`source` text,
	`site_id` integer,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX IF NOT EXISTS `campaign_signups_site_idx` ON `campaign_signups` (`site_id`);
CREATE INDEX IF NOT EXISTS `campaign_signups_updated_at_idx` ON `campaign_signups` (`updated_at`);
CREATE INDEX IF NOT EXISTS `campaign_signups_created_at_idx` ON `campaign_signups` (`created_at`);

CREATE TABLE IF NOT EXISTS `campaign_endorsements` (
	`id` integer PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'individual',
	`name` text NOT NULL,
	`email` text NOT NULL,
	`title` text,
	`organization` text,
	`website` text,
	`contact_name` text,
	`campaign` text,
	`source` text,
	`wants_updates` integer DEFAULT false,
	`site_id` integer,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX IF NOT EXISTS `campaign_endorsements_site_idx` ON `campaign_endorsements` (`site_id`);
CREATE INDEX IF NOT EXISTS `campaign_endorsements_updated_at_idx` ON `campaign_endorsements` (`updated_at`);
CREATE INDEX IF NOT EXISTS `campaign_endorsements_created_at_idx` ON `campaign_endorsements` (`created_at`);

-- ============================================================
-- 4. `sites` (hasMany) on Posts + Pages — stored in the *_rels join tables
--    (main + versioned). ADD COLUMN is not idempotent — apply once.
-- ============================================================
ALTER TABLE `posts_rels` ADD COLUMN `sites_id` integer;
CREATE INDEX IF NOT EXISTS `posts_rels_sites_id_idx` ON `posts_rels` (`sites_id`);

ALTER TABLE `_posts_v_rels` ADD COLUMN `sites_id` integer;
CREATE INDEX IF NOT EXISTS `_posts_v_rels_sites_id_idx` ON `_posts_v_rels` (`sites_id`);

ALTER TABLE `pages_rels` ADD COLUMN `sites_id` integer;
CREATE INDEX IF NOT EXISTS `pages_rels_sites_id_idx` ON `pages_rels` (`sites_id`);

ALTER TABLE `_pages_v_rels` ADD COLUMN `sites_id` integer;
CREATE INDEX IF NOT EXISTS `_pages_v_rels_sites_id_idx` ON `_pages_v_rels` (`sites_id`);

-- ============================================================
-- 5. payload_locked_documents_rels — admin lock needs a rel column per new
--    collection (else /admin edits of these collections error). ADD once.
-- ============================================================
ALTER TABLE `payload_locked_documents_rels` ADD COLUMN `sites_id` integer;
CREATE INDEX IF NOT EXISTS `payload_locked_documents_rels_sites_id_idx` ON `payload_locked_documents_rels` (`sites_id`);

ALTER TABLE `payload_locked_documents_rels` ADD COLUMN `events_id` integer;
CREATE INDEX IF NOT EXISTS `payload_locked_documents_rels_events_id_idx` ON `payload_locked_documents_rels` (`events_id`);

ALTER TABLE `payload_locked_documents_rels` ADD COLUMN `campaign_signups_id` integer;
CREATE INDEX IF NOT EXISTS `payload_locked_documents_rels_campaign_signups_id_idx` ON `payload_locked_documents_rels` (`campaign_signups_id`);

ALTER TABLE `payload_locked_documents_rels` ADD COLUMN `campaign_endorsements_id` integer;
CREATE INDEX IF NOT EXISTS `payload_locked_documents_rels_campaign_endorsements_id_idx` ON `payload_locked_documents_rels` (`campaign_endorsements_id`);
