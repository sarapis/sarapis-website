-- Round 24: /about board + /donate (Stripe embedded checkout).
-- Only schema change: `board` array on the homepage GLOBAL → homepage_board table
-- (globals don't touch payload_locked_documents_rels — same as round 17's homepage tables).
-- Apply to the box DB out-of-band BEFORE running the r24 image (push is a no-op in prod):
--   docker stop sarapis-site && cp DB DB.bak-r24-… && python3 executescript(this) && chown 1001:1001 …
-- Then seed the board content: python3 deploy/seed-homepage.py https://next.sarapis.org <admin> <pw>
-- Schema captured verbatim from the local dev DB after push created it (2026-07-12).

CREATE TABLE `homepage_board` (
	`_order` integer NOT NULL,
	`_parent_id` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`bio` text,
	`link` text,
	FOREIGN KEY (`_parent_id`) REFERENCES `homepage`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `homepage_board_order_idx` ON `homepage_board` (`_order`);
CREATE INDEX `homepage_board_parent_id_idx` ON `homepage_board` (`_parent_id`);
