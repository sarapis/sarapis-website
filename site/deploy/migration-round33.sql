-- Round 33: About "Support Us" email signup — new `email-signups` collection.
-- Apply to the box DB out-of-band BEFORE running the r33 image (push is a no-op in prod):
--   docker stop sarapis-site
--   cp /opt/sarapis/data/sarapis.db /opt/sarapis/data/sarapis.db.bak-r33-$(date +%Y%m%d-%H%M%S)
--   python3 -c "import sqlite3; sqlite3.connect('/opt/sarapis/data/sarapis.db').executescript(open('/opt/sarapis/migration-round33.sql').read())"
--   chown 1001:1001 /opt/sarapis/data/sarapis.db && rm -f /opt/sarapis/data/sarapis.db-wal /opt/sarapis/data/sarapis.db-shm
--   (then recreate the container on sarapis-site:r33)
-- Schema captured verbatim from the local dev DB after push created it (2026-07-22).

CREATE TABLE `email_signups` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`source` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE UNIQUE INDEX `email_signups_email_idx` ON `email_signups` (`email`);
CREATE INDEX `email_signups_updated_at_idx` ON `email_signups` (`updated_at`);
CREATE INDEX `email_signups_created_at_idx` ON `email_signups` (`created_at`);

ALTER TABLE `payload_locked_documents_rels` ADD COLUMN `email_signups_id` integer;
CREATE INDEX `payload_locked_documents_rels_email_signups_id_idx` ON `payload_locked_documents_rels` (`email_signups_id`);
