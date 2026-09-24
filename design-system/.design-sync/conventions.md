# Sarapis Design System — conventions

Editorial, "card-catalog" brand for the nonprofit Sarapis (v0.2 "Tibetan"): warm cream
surfaces, a **Tibetan-maroon** brand color (`#782a39`) with a **saffron** accent
(`#ffbb48`), Fraunces serif headings, a sans body, and **Space Mono** for all metadata
(eyebrows, tags, datelines, call-numbers). The wordmark is set in **Marcellus**.

## Setup

No provider or context is required — every component is plain React. Do **two** things:

1. Import the stylesheet **once** at the app root: `import '@sarapis/design-system/styles.css'`.
   It defines all design tokens on `:root`, ships the component styles, and loads the
   brand fonts (Fraunces, Space Mono, Marcellus) via a remote `@import`. Without it,
   components render unstyled.
2. For dark mode, set `data-theme="dark"` on a wrapping element (e.g. `<html data-theme="dark">`).
   Tokens are redefined under `[data-theme='dark']`; light is the default.

## Styling idiom — design tokens, not utility classes

Style with the system's **CSS custom properties** (`var(--sds-*)`); there is no utility-class
framework and components do not accept utility classes. Components style themselves internally;
use the tokens for your own layout glue (spacing, surfaces, type).

| Token family | Names |
|---|---|
| Color | `--sds-background`, `--sds-foreground`, `--sds-card`, `--sds-primary` (maroon), `--sds-primary-foreground`, `--sds-muted-foreground`, `--sds-accent`, `--sds-accent-foreground`, `--sds-border`, `--sds-ring`, `--sds-gold` (saffron accent), `--sds-ink` (dark surfaces) |
| Type | `--sds-font-serif` (Fraunces — headings), `--sds-font-sans` (body), `--sds-font-mono` (Space Mono — metadata: eyebrows/tags/datelines), `--sds-font-logo` (Marcellus — wordmark) |
| Radius | `--sds-radius-md`, `--sds-radius-lg`, `--sds-radius-xl`, `--sds-radius-pill` |
| Space | `--sds-space-1`, `--sds-space-2`, `--sds-space-3`, `--sds-space-4`, `--sds-space-6`, `--sds-space-8` |

Headings use the serif; the maroon (`--sds-primary`) carries primary actions, eyebrows, tags,
and links. **Saffron** (`--sds-gold`) is accent-only — eyebrow ticks, catalog hover bars, the
header/footer keyline, the CTA button on the maroon band — never body text on cream (too low
contrast). Keep one deliberate dark moment per page (the maroon Callout); everything else stays
on warm cream.

## Where the truth lives

Read the bound stylesheet (`_ds/<folder>/styles.css` and its `tokens.css` import) for the exact
token values, and each component's `.prompt.md` / `.d.ts` for its API before composing.

## Components

**Primitives:** `Button` (primary/outline/ghost pills), `Card` (article/project card; optional
`date` mono dateline), `FocusCard` (work-area tile), `Callout` (maroon CTA band), `SectionHeading`
(serif title + optional aside), `Eyebrow` (mono kicker with an automatic saffron tick — drop any
hand-rolled tick), `Tag` (uppercase mono category label), `Logo` (compass mark + Marcellus
wordmark), `CatalogIndex` (numbered, ruled "card-catalog" list for focus areas / archives, with a
saffron hover bar).

**Chrome:** `Header` (logo + nav + Donate pill) and `Footer` (Work + Menu columns).

**Page screens (iterate on these to redesign the real site):** `HomeScreen`,
`WorkAreaScreen`, `BlogIndexScreen`, `PostScreen` — full-page compositions of the actual
Sarapis pages, built from the components above with representative real content. They are
the live site's real layouts; refine them, then the changes get ported back into the
Payload/Next app. Use the `.sds-container` / `.sds-section` / `.sds-grid-{2,3,4}` layout
classes for page scaffolding.

## Idiomatic example

```jsx
import { Eyebrow, SectionHeading, Button } from '@sarapis/design-system'

function Hero() {
  return (
    <section style={{ background: 'var(--sds-background)', padding: 'var(--sds-space-8)' }}>
      <Eyebrow>Free, libre &amp; open source · 501(c)(3) nonprofit</Eyebrow>
      <SectionHeading as="h1" title="Technology should belong to the people it serves." />
      <div style={{ display: 'flex', gap: 'var(--sds-space-3)', marginTop: 'var(--sds-space-6)' }}>
        <Button variant="primary" href="/contact">Let&rsquo;s talk</Button>
        <Button variant="outline" href="/about">Read our story</Button>
      </div>
    </section>
  )
}
```
