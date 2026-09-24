-- Sarapis round-19 schema delta (Services page) — apply to the box runtime DB
-- out-of-band (push:true doesn't run in the prod bundle). Additive, idempotent-safe.
-- Back up first: cp data/sarapis.db data/sarapis.db.bak-r19
BEGIN;
ALTER TABLE homepage_services ADD COLUMN slug text;
ALTER TABLE homepage_services ADD COLUMN description text;
ALTER TABLE homepage_case_studies ADD COLUMN service text;
COMMIT;
