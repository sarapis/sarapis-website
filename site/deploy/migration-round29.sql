-- Round 29: AI summaries on activity events.
-- Adds one editable column `activity_events.summary` (plain textarea, not a
-- relationship → no rels changes). Apply to the box DB out-of-band before the
-- r29 image (push is a no-op in prod):
--   docker stop sarapis-site && cp DB DB.bak-r29-… && python3 executescript(this) && chown 1001:1001 …
-- Schema captured verbatim from the local dev DB after push created it (2026-07-13).

ALTER TABLE `activity_events` ADD COLUMN `summary` text;
