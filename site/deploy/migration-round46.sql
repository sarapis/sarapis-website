-- round 46 — Projects: logo + screenshot uploads (logo_id, screenshot_id)
--
-- Additive only: two nullable INTEGER columns on `projects`, each a foreign key to
-- `media`, with an index apiece — the same shape as `posts.hero_image_id` in the
-- initial migration. `projects` has no drafts/versions (no `_projects_v` table), and
-- an upload on a plain collection needs nothing in `projects_rels` or
-- `payload_locked_documents_rels`.
--
-- Empty (NULL) means "no upload": the project card falls back to the logo found on the
-- project's site, then the project's initials, and the profile page's image box stays an
-- empty placeholder. So no backfill is needed.
--
-- `push` is a no-op in the production bundle, so this must be applied out-of-band to the
-- box DB. Apply it BEFORE deploying the code that reads the fields, or the home page and
-- every project page 500 with "no such column". Dry-apply to a COPY of the box DB first.

ALTER TABLE projects ADD COLUMN logo_id integer REFERENCES media(id) ON UPDATE no action ON DELETE set null;
ALTER TABLE projects ADD COLUMN screenshot_id integer REFERENCES media(id) ON UPDATE no action ON DELETE set null;
CREATE INDEX projects_logo_idx ON projects (logo_id);
CREATE INDEX projects_screenshot_idx ON projects (screenshot_id);
