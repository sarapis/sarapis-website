-- migration-round38.sql — NewsItems collection (multi-brand)
--
-- Adds the `news-items` collection so the "in the news" cards on brand
-- front-ends (wegov.nyc/unnyc) are CMS-managed instead of hardcoded in the
-- front-end repo. Same brand-scoping pattern as Events: hasMany `sites` stored
-- in news_items_rels.
--
-- ADDITIVE ONLY — no drops, so no destructive-diff prompt/hang. Apply
-- out-of-band to the box DB (push is a no-op in the prod bundle).
-- CREATE ... IF NOT EXISTS makes the CREATE half re-runnable; the single
-- ALTER ... ADD COLUMN is NOT idempotent in SQLite — the guarded applier in the
-- runbook catches "duplicate column name".
--
-- DDL extracted verbatim from the local dev DB after the collection was built
-- and verified, so it matches what Payload expects at runtime.

CREATE TABLE IF NOT EXISTS `news_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`source` text,
	`excerpt` text,
	`link` text,
	`date_label` text,
	`sort_date` text,
	`published` integer DEFAULT false,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE INDEX IF NOT EXISTS `news_items_updated_at_idx` ON `news_items` (`updated_at`);
CREATE INDEX IF NOT EXISTS `news_items_created_at_idx` ON `news_items` (`created_at`);

CREATE TABLE IF NOT EXISTS `news_items_rels` (
	`id` integer PRIMARY KEY NOT NULL,
	`order` integer,
	`parent_id` integer NOT NULL,
	`path` text NOT NULL,
	`sites_id` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `news_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sites_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `news_items_rels_order_idx` ON `news_items_rels` (`order`);
CREATE INDEX IF NOT EXISTS `news_items_rels_parent_idx` ON `news_items_rels` (`parent_id`);
CREATE INDEX IF NOT EXISTS `news_items_rels_path_idx` ON `news_items_rels` (`path`);
CREATE INDEX IF NOT EXISTS `news_items_rels_sites_id_idx` ON `news_items_rels` (`sites_id`);

-- Admin lock needs a rel column per collection (else /admin edits of news-items
-- error). ADD once — guarded applier skips it if already present.
ALTER TABLE `payload_locked_documents_rels` ADD COLUMN `news_items_id` integer;
CREATE INDEX IF NOT EXISTS `payload_locked_documents_rels_news_items_id_idx` ON `payload_locked_documents_rels` (`news_items_id`);
