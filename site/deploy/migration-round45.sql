-- round 45 — Projects: "Children are called" (child_label)
--
-- Additive only: one nullable TEXT column on `projects`. It holds a select value
-- ('subprojects' | 'features' | 'integrations') that names what a parent
-- project's children are on the site (home cards, profile heading). NULL means
-- "subprojects", which is also the field's default, so existing rows need no backfill.
-- `projects` has no drafts/versions and the field is not a relationship, so there is
-- nothing to do in `projects_rels` / `payload_locked_documents_rels`.
--
-- `push` is a no-op in the production bundle, so this must be applied out-of-band
-- to the box DB. Apply it BEFORE deploying the code that reads the field, or the
-- home page and project profiles 500 with "no such column". Dry-apply to a COPY of
-- the box DB first.

ALTER TABLE projects ADD COLUMN child_label text;

-- Databook's children are features of it rather than separate projects. Set the
-- rest (or this) in /admin instead if you prefer:
-- UPDATE projects SET child_label = 'features' WHERE name = 'Databook';
