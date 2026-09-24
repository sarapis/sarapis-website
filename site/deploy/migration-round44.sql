-- round 44 — Projects: Project leader + Sarapis role
--
-- Additive only: two nullable TEXT columns on `projects`.
-- `projects` has NO drafts/versions (no `_projects_v` table), and both fields
-- are plain text rather than relationships, so there is nothing to do in
-- `projects_rels` / `payload_locked_documents_rels` either.
--
-- Column names follow the drizzle camelCase -> snake_case convention already
-- visible on this table (focusArea -> focus_area, driveFolderId ->
-- drive_folder_id).
--
-- `push` is a no-op in the production bundle, so this must be applied
-- out-of-band to the box DB. Dry-apply to a COPY of the box DB first.

ALTER TABLE projects ADD COLUMN project_leader text;
ALTER TABLE projects ADD COLUMN sarapis_role text;
