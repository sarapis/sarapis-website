-- Round 26: Tags collection (+ Posts.tags relationship) and table-editor support.
-- Only the Tags collection is a schema change (the table feature stores nodes in
-- existing richText columns; no DDL). Apply to the box DB out-of-band BEFORE the
-- r26 image (push is a no-op in prod):
--   docker stop sarapis-site && cp DB DB.bak-r26-… && python3 executescript(this) && chown 1001:1001 …
-- Schema captured verbatim from the local dev DB after push created it (2026-07-13).

CREATE TABLE `tags` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE UNIQUE INDEX `tags_slug_idx` ON `tags` (`slug`);
CREATE INDEX `tags_updated_at_idx` ON `tags` (`updated_at`);
CREATE INDEX `tags_created_at_idx` ON `tags` (`created_at`);

-- Posts.tags (hasMany) — stored in the posts rels join tables + the locked-docs rel.
ALTER TABLE `posts_rels` ADD COLUMN `tags_id` integer;
CREATE INDEX `posts_rels_tags_id_idx` ON `posts_rels` (`tags_id`);

ALTER TABLE `_posts_v_rels` ADD COLUMN `tags_id` integer;
CREATE INDEX `_posts_v_rels_tags_id_idx` ON `_posts_v_rels` (`tags_id`);

ALTER TABLE `payload_locked_documents_rels` ADD COLUMN `tags_id` integer;
CREATE INDEX `payload_locked_documents_rels_tags_id_idx` ON `payload_locked_documents_rels` (`tags_id`);
