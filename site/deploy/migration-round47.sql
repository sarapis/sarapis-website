-- round 47 — Homepage board: portrait upload (homepage_board.portrait_id)
--
-- Additive only: one nullable INTEGER column on `homepage_board` (the board-of-directors
-- array on the `homepage` global), a foreign key to `media`, plus an index — the same shape
-- as `posts.hero_image_id`. The board is an array inside a global, so nothing is needed in
-- `*_rels` or `payload_locked_documents_rels`.
--
-- NULL means "no upload": the About page falls back to the photo shipped in
-- `site/public/board/`, then to an empty card. So no backfill is needed.
--
-- `push` is a no-op in the production bundle, so this must be applied out-of-band to the box
-- DB. Apply it BEFORE deploying the code that reads the field, or /about (and anything else
-- that reads the homepage global, including the home page) 500s with "no such column".
-- Dry-apply to a COPY of the box DB first.

ALTER TABLE homepage_board ADD COLUMN portrait_id integer REFERENCES media(id) ON UPDATE no action ON DELETE set null;
CREATE INDEX homepage_board_portrait_idx ON homepage_board (portrait_id);
