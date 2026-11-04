-- round 46 — Users: collabPass gates "Sign in with the CMS"
--
-- Additive only: one integer (boolean) column on `users`, default false. `users` has no
-- drafts/versions and the field is not a relationship, so there is nothing to do in
-- `users_rels` / `payload_locked_documents_rels`.
--
-- /api/collab-pass/start now answers 403 for any user without the pass, so after this
-- ships NOBODY can sign in to comms-strat with the CMS until a maintainer grants it. The
-- field cannot be set from /admin or REST (any editor could otherwise grant it to an
-- account they created with someone else's email); grant it here, per person, after
-- checking the address really is theirs.
--
-- `push` is a no-op in the production bundle, so this must be applied out-of-band to the
-- box DB. Apply it BEFORE deploying the code that reads the field, or every users query
-- (including login) 500s with "no such column". Dry-apply to a COPY of the box DB first.

ALTER TABLE users ADD COLUMN collab_pass integer DEFAULT false;

-- Grant (repeat per person):
-- UPDATE users SET collab_pass = 1 WHERE email = 'person@sarapis.org';
