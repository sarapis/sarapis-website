-- migration-round42.sql — CampaignEndorsements: public wall + org endorsement fields
--
-- WHY
-- The endorser wall on unnyc.wegov.nyc/campaign/sign is public and fetches this
-- collection anonymously, but collection read was `authenticated`. Every
-- anonymous read 403'd, the front-end caught the error and fell back to [], so
-- the wall silently rendered empty and had never shown a single signature.
-- Read is now `publishedOnly`, gated on a new `published` checkbox — the review
-- step the front-end docs always claimed existed but that was never implemented
-- (this collection has no drafts/versions, so there was nothing to "publish").
--
-- Also lands the two fields formal ORGANIZATION endorsements need, now that
-- unnyc's endorse form posts here instead of to a Google Sheet via an Apps
-- Script webhook. `activity` is the org's description of relevant work;
-- `activity_consent` is their per-submission permission to publish it. Both are
-- withheld from anonymous reads by field-level access (as are email,
-- contact_name, source, wants_updates) — field access cannot be conditional on
-- another field's value, so a human decides what to surface.
--
-- ⚠ EXISTING ROWS DEFAULT TO published = false, so any signatures already in the
-- table stay off the wall until someone ticks them in the admin. That is the
-- intended gate, not a regression — the wall could not display them before
-- either — but it does mean a moderator pass is needed for anything already
-- collected.
--
-- ADDITIVE ONLY — no drops, so no destructive-diff prompt/hang. Apply
-- out-of-band to the box DB (push is a no-op in the prod bundle).
-- ALTER ... ADD COLUMN is NOT idempotent in SQLite — the guarded applier in the
-- runbook catches "duplicate column name".

-- ============================================================
-- 1. Review gate for the public wall
-- ============================================================
ALTER TABLE `campaign_endorsements` ADD COLUMN `published` integer DEFAULT false;

-- ============================================================
-- 2. Formal organization endorsement fields
-- ============================================================
ALTER TABLE `campaign_endorsements` ADD COLUMN `activity` text;
ALTER TABLE `campaign_endorsements` ADD COLUMN `activity_consent` integer DEFAULT false;

-- Public reads filter on `published`; index it so the wall's query stays cheap
-- as the table grows.
CREATE INDEX IF NOT EXISTS `campaign_endorsements_published_idx` ON `campaign_endorsements` (`published`);
