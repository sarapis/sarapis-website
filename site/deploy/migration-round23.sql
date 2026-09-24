-- Round 23: contact form — new `contact-submissions` collection.
-- Apply to the box DB out-of-band BEFORE running the r23 image (push is a no-op in prod):
--   docker stop sarapis-site
--   cp /opt/sarapis/data/sarapis.db /opt/sarapis/data/sarapis.db.bak-r23-$(date +%Y%m%d-%H%M%S)
--   python3 -c "import sqlite3; sqlite3.connect('/opt/sarapis/data/sarapis.db').executescript(open('/opt/sarapis/migration-round23.sql').read())"
--   chown 1001:1001 /opt/sarapis/data/sarapis.db && rm -f /opt/sarapis/data/sarapis.db-wal /opt/sarapis/data/sarapis.db-shm
--   (then recreate the container on sarapis-site:r23)
-- Schema captured verbatim from the local dev DB after push created it (2026-07-12).

CREATE TABLE `contact_submissions` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE INDEX `contact_submissions_updated_at_idx` ON `contact_submissions` (`updated_at`);
CREATE INDEX `contact_submissions_created_at_idx` ON `contact_submissions` (`created_at`);

ALTER TABLE `payload_locked_documents_rels` ADD COLUMN `contact_submissions_id` integer;
CREATE INDEX `payload_locked_documents_rels_contact_submissions_id_idx` ON `payload_locked_documents_rels` (`contact_submissions_id`);
