# Sarapis Design System — sync notes

- This package (`@sarapis/design-system`) was **extracted from** the Sarapis Payload/Next app
  in `../site` — it is the portable brand language (tokens + standalone React primitives), NOT
  the app's Next/Payload-coupled components. Source of truth for the *visual* values is
  `../site/src/app/(frontend)/globals.css`; this package re-encodes them in `src/tokens.css`.
- Build: `npm run build` (tsup) → `dist/index.es.js`, `dist/index.es.css`, `dist/index.d.ts`.
  Standalone npm package (not in the site's pnpm workspace). Converter entry: `./dist/index.es.js`.
- Playwright: chromium build **1223** is cached locally → use **playwright@1.60.0** (installed in
  `.ds-sync/`) so the render check reuses the cache (no browser download).

## Known render warns (expected — not new)
- `[FONT_REMOTE] "Fraunces", "Space Mono", "Marcellus"` — all three brand faces load via a
  single Google Fonts `@import` in `tokens.css` (Fraunces=headings, Space Mono=metadata,
  Marcellus=wordmark). Intentional; no `@font-face` ships. Not a `[FONT_MISSING]`.

## v0.2 "Tibetan" (integrated from Claude Design, handoff/2/)
- Primary is now **maroon `#782a39`** (not the old `#c93241` red); added `--sds-gold` (saffron),
  `--sds-ink`, `--sds-font-mono` (Space Mono), `--sds-font-logo` (Marcellus). styles.css has v0.2
  blocks **appended** after v0.1 (cascade-override; some duplicate selectors are intentional).
  New component `CatalogIndex`; `Card` gained optional `date`. The live site still shows the old
  red — port-back not yet done.
- **Cleanup patch (handoff/3) applied:** de-duped styles.css (removed the dead v0.1 blocks for
  eyebrow/tag/logo__word/header/footer*; kept the v0.2 versions + __nav/__inner layout); Header
  nav "Work ▾"→"Focus Areas ▾" + added an Activity link; Footer "Work" heading→"Focus Areas" +
  fixed the copyright divider (was invisible white border → `.sds-footer__note--divider`);
  CatalogIndex examples dropped the "Ref. SAR"/"Index of work" motif.
- **Activity dashboard (handoff/4) applied:** merged `dashboard.css` into styles.css (all-new compact
  patterns: `.sds-summary`, `.sds-feed`/`.sds-fcard`, `.sds-toolbar`/`.sds-segment`, `.sds-dlist`/`.sds-arow`,
  `.sds-log`/`.sds-lrow`, `.sds-dtable`, `.sds-badge`, `.sds-trow`/`.sds-tdot`, `.sds-prow`, `.sds-ftype`,
  `.sds-spark`). Built `src/screens/ActivityScreen.tsx` (hero → summary strip → news feed → merged
  timeline + pinned rail w/ project-filter chips → projects table), exported it, authored its preview,
  added a `cardMode:single` override. Also fixed a `[GRID_OVERFLOW]` on CatalogIndex → `cardMode:column`.
  16 components synced. Live GitHub wiring + the /activity route are SITE-side, not done.
- **⚠ Re-sync gotcha:** `resync.mjs`'s build stage did NOT rebuild `dist/` even though `buildCmd`
  is set (the bundle came out stale — missing edits). **Always run `npm run build` manually first,
  then verify `dist/index.es.js` has your change before running the driver**, or the upload ships
  the old bundle.

## Re-sync risks (what can silently go stale)
- **Token drift:** `src/tokens.css` is a hand-copy of the app's `globals.css` palette/type. If the
  app rebrands (e.g. the primary red changed from coral→orange→`#c93241` over this project),
  update `src/tokens.css` to match or the DS and the live site diverge.
- **Embedded logo mark:** `src/mark.ts` is a base64 copy of `../site/public/sarapis-mark.png`
  (the compass, cropped from the WP logo). If the mark changes, regenerate `src/mark.ts`.
- **Remote font at render time:** previews depend on Google Fonts being reachable; offline → they
  render in a serif fallback (cosmetic only).
- **Card `WithImage` preview** uses an inline SVG data-URI placeholder, not a real project image.
- Components are intentionally minimal (8 brand primitives). The app has more UI (Header nav,
  PostHero, blocks) that is deliberately NOT in the DS because it's Next/Payload-coupled.
