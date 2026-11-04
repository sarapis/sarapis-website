# `/email/` — brand marks for outgoing email

Email clients cannot render SVG and will not load a webfont, so a wordmark that
is live HTML on its own site has to become a **raster image** to survive the
trip to an inbox. These PNGs exist for that one reason. They are served from
`next.sarapis.org` because that host already serves `sarapis-mark.png`, which
the newsletter's header uses, so a mail keeps all its images on one origin.

Each file is a faithful rendering of that site's **own header lockup**, built
from that repo's source rather than redrawn — same glyphs, same colours, same
spacing.

| File | Mark | Source of truth | Type |
|---|---|---|---|
| `ospo-lockup.png` | OSPO → NYC | `sarapis/ospo-nyc` — `OspoLockup.js` + `.ospo-lockup__*` in `src/app/ospo-home.css`; arrow path verbatim | Inter 800, 22px, `-0.02em`. "OSPO" `#ffffff`, arrow + "NYC" mint `#86d4b0` |
| `unnyc-lockup.png` | UN+NYC | `sarapis/unnyc` — `UnnycNav.js` + `.unnyc-nav__logo-*` in `src/app/base.css`, resolved through the `unnyc` variant of `@wegovnyc/design-tokens` | DM Serif Display 400, 23.2px, `0.5px`. "UN" `#009EDB`, "+" `#eef3f9` @ 72%, "NYC" `#FF6600` |
| `databook-lockup.png` | DATABOOK.NYC | `sarapis/databook-private` — `.db-brand` in `app/public/css/databook-components.css` | Public Sans 700, 20px, `0.02em`, `#ff941f` |

## Rules

- **Transparent background, and that is deliberate.** Every one of these marks
  carries white or near-white glyphs, so each needs a dark ground to be legible
  — the mail supplies it as a cell background rather than baking it into the
  PNG, which keeps the corner radius in CSS and leaves the alt text readable on
  that same dark ground when images are blocked.
- **Rendered at 3×** (Chromium, `device_scale_factor=3`) for retina. Set
  `width` and `height` in the email to the 1× size in the table above, never to
  the pixel dimensions of the file.
- **If a site changes its lockup, re-render rather than editing the PNG.** The
  point of these files is that they are downstream of the real source; a
  hand-touched one quietly stops being the mark.
- Fonts are SIL Open Font License 1.1 (Inter, DM Serif Display, Public Sans).
  The first two are vendored in `sarapis/ospo-nyc` under `src/assets/fonts/`
  with their licence files; Public Sans came from `@fontsource/public-sans`.
