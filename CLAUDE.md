# Sarapis website — agent context

The website for **Sarapis Foundation**, a nonprofit building free, libre and open-source
software for nonprofits and the public sector. Built on **Payload CMS 3 + Next.js 16**
with SQLite, and a standalone design system.

> Operational detail — hosts, deploy targets, credentials, incident history — is NOT in
> this repo. Maintainers keep it in a gitignored `CLAUDE.local.md` beside this file, which
> Claude Code loads automatically after this one.

| Dir | What it is |
|---|---|
| `site/` | The app: Payload 3 + Next 16, **SQLite** (`sarapis.db`), media on disk. |
| `design-system/` | `@sarapis/design-system`, a standalone React library synced to Claude Design. NOT imported by `site/` at runtime — the site re-implements its `sds-*` CSS in `home.css`. |
| `migration/` | One-off WordPress (WXR) extraction used for the original import. |
| `tools/sarapis-kb/` | Standalone CLI for adding Knowledge Items over the REST API. |

## Run it

```bash
cd site && pnpm install
cp .env.example .env            # fill in PAYLOAD_SECRET etc.
PORT=3009 pnpm exec next dev -p 3009
pnpm exec vitest run            # int tests (run serially — see vitest.config.mts)
pnpm exec tsc --noEmit
pnpm lint                       # 0 errors expected; warnings are tolerated
pnpm test:e2e                   # Playwright; starts `pnpm dev` on :3000
```

CI (`.github/workflows/ci.yml`) runs tsc, lint, the int tests and the backup tests on every PR and push
to `main`, against a fresh empty SQLite file, so a new int test must create its own fixtures.

Create a local admin: `ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm payload run scripts/create-admin.ts`
(it **resets** the password of an existing user, so both values are required).

## One CMS, several brands

This Payload instance is the content source for more than one website. `Sites` is the brand
registry (one doc per brand: `key`, `domain`, `nav`, `footer`, `defaultSeo`). Posts, Pages,
Events and NewsItems carry a `sites` (hasMany) field, so one entry can publish to several
brands; front-ends query `?where[sites.key][equals]=<brand>`. `site` (singular, via
`siteField({ hasMany: false })`) is used by submission collections, since a submission comes
*from* one brand. Scoping is optional (null = the Sarapis default) and enforced by the query
filter, not an FK.

## Access model — read this before touching a collection

- **Curation gate:** Activity/content collections use `publishedOnly` (anonymous reads see
  only `published: true`); Posts/Pages use drafts + `authenticatedOrPublished`.
- **Anonymous-create collections** (`campaign-*`, `contact-submissions`, `email-signups`)
  take public POSTs from brand front-ends. Each has a honeypot in `beforeValidate`
  (`website`, or `fax` where `website` is a real field).
- **Field-level access** (`src/access/authenticatedField.ts`) withholds private fields on a
  publicly readable collection. It is a plain boolean `FieldAccess`, distinct from the
  collection-level `authenticated` `Access` helper.
- ⚠ **An anonymous-create collection needs field-level `create` access on every field that
  is a gate.** `campaign-endorsements.published` had none, so one POST with
  `"published": true` approved itself onto the public wall. `tests/int/campaign-endorsements.int.spec.ts`
  now pins this; add the same test for any new public-create collection.
- **Per-entry public display** (`src/access/publicUnlessHidden.ts`): `campaign-endorsements` asks each signer
  `displayPublicly`. An explicit `false` withholds name, title, organization, website, quote and logo from
  anonymous reads while the entry still counts; NULL (older entries) stays visible. It is a field rule that reads
  the document, and answers false when there is none, so anonymous `where` filters on those fields are refused
  (otherwise `?where[name][equals]=` would find a hidden signer). Pinned in `campaign-endorsements.int.spec.ts`.
- **New-endorsement email** (`src/hooks/notifyNewEndorsement.ts`): an `afterChange` hook on
  `campaign-endorsements` emails `ENDORSEMENT_NOTIFY_TO` through Resend's HTTP API (no email adapter is
  configured; it uses fetch) on create only, never on approval. Off unless `RESEND_API_KEY`,
  `ENDORSEMENT_NOTIFY_FROM` and `ENDORSEMENT_NOTIFY_TO` are all set. Its `doc` has already lost the
  private fields to read access, so it reads them from the submitted `data`. A send failure is logged,
  never thrown. Pinned in `tests/int/endorsement-notify.int.spec.ts`. Resend calls go through
  `src/lib/resend.ts`.
- **Campaign confirmation emails** (`src/hooks/sendCampaignConfirmation.ts`, words in
  `src/email/campaignConfirmations.ts`, one entry per campaign key): on create in `campaign-endorsements`
  and `campaign-signups`, the visitor gets a confirmation. ⚠ The words are FIXED TEXT: never put a
  submitted value (name, message) in them, or the public form becomes a way to send anyone's text in our
  name. One email per address and campaign per collection (it counts earlier entries); sign-ups from a
  `signupSkipSources` source (the endorse form's "send me updates") get none, as that visitor already gets
  the endorsement email. Off unless `RESEND_API_KEY` and `CAMPAIGN_EMAIL_FROM` are set
  (`CAMPAIGN_EMAIL_REPLY_TO` optional). Pinned in `tests/int/campaign-confirmation.int.spec.ts`.
- ⚠ `required` + `admin.readOnly` on the same field makes a collection **impossible to create
  from the admin UI**. For "settable on create, frozen after", use
  `access: { update: () => false }` (see `Repos.fullName`).
- **CORS** is an allowlist in `payload.config.ts` (+ `CORS_ORIGINS`). A missing brand origin
  fails invisibly — the browser blocks the request and the front-end sees a generic network
  error. If a brand form "does nothing", check the console for CORS first.

## GitHub activity sync (`src/endpoints/github-sync.ts`)

`GET/POST /next/github-sync` with `Authorization: Bearer $CRON_SECRET`, run hourly. Upserts
`repos` (by `fullName`) and `activity-events` (by `externalId`). Only SOURCE fields are written
on update; editorial fields (`published`, `pinned`, `project`, `summary`, …) are preserved, and
`published` is only ever set at create time — so manual curation always sticks.

- Owners come from `SYNC_OWNERS`, which **replaces** the defaults rather than extending them.
  Per-owner fine-grained tokens: `GITHUB_TOKEN_<OWNER uppercased>`, falling back to `GITHUB_TOKEN`.
- Auto-publish only for `PUBLISH_ACTORS` logins. The gate reads GitHub-attributed accounts only, never the
  free-text git `user.name`; this is pinned by `tests/int/github-sync-publish-gate.int.spec.ts`.
- **Internal engineering process is kept off the public feed** at the commit-*message* level
  (`isInternalLine`), not the event level, because one day mixes real work with deploy churn.
  An event with nothing public is created *unpublished*, never dropped.
- AI summaries come from Gemini. The 2.5/3.x "flash" models are *thinking* models: keep
  `thinkingConfig.thinkingBudget: 0` or they spend the output budget reasoning and return a fragment.
- **Failures are reported, never swallowed.** `summary.errors` means data didn't sync, and fails the run with a
  500. `summary.warnings` means degraded but nothing lost. **`GET /next/github-sync/health`** (public) returns 503
  on errors *or* when no run has finished in 150 min, and an uptime monitor watches it. Commits are fetched from
  the newest recorded day; GitHub's `since` filters on committer date, the same date days are bucketed by.
  Repair lost history with `?since=YYYY-MM-DD`. All of this, plus the Gemini circuit breaker, is pinned by
  `tests/int/github-sync-failures.int.spec.ts` and `github-sync-health.int.spec.ts`.
- ⚠ `externalId` embeds `repoFullName`, so a **fork** of an already-synced repo re-ingests the
  shared history as duplicate events.
- The route has an in-process mutex (409 "Sync already running"), and a client timeout does not
  abort the server handler — for a long backfill, trigger once and poll.

## "Sign in with the CMS" (`src/endpoints/collab-pass.ts`)

`GET /api/collab-pass/start?host=<collab site>&state=<random>` lets a sarapis/collab-template site
(comms-strat.sarapis.org first) sign people in with their login here: it redirects a signed-in user to
`https://<host>/auth/cms/callback?ticket=…`, a two-minute HMAC ticket naming their **email and nothing
else** (the collab site's roster authorizes). Signed out → the admin login, then back. Only users with
`collabPass` get a ticket (else 403): this CMS doesn't verify emails, so the pass can't be set from /admin
or REST (a maintainer grants it in SQL, see `deploy/migration-round46.sql`) and changing the email clears it. Mints only for hosts
in `COLLAB_PASS_HOSTS` (else 400); 503 until `COLLAB_PASS_SECRET` (≥ 32 chars, the collab Worker's
`CMS_PASS_SECRET`) is set. The format is byte-compatible with the Field Guide CMS's copy and the template's
verifier; `tests/int/collab-pass.int.spec.ts` pins both.

## Backups

`site/deploy/backup/sarapis-backup.py`, nightly via `sarapis-backup.cron`. It takes a consistent
SQLite snapshot (never `cp` a live DB), restore-tests the compressed artifact, archives the media,
and optionally copies both off-box with rclone. Its outcome is served at **`/next/backup/health`**,
which is 503 unless a backup succeeded in the last 26 h *and* left the machine. Install, restore and
test steps are in `site/DEPLOY.md`. Tests: `python3 -m unittest discover -s site/deploy/backup`.

## Gotchas (all have bitten this project)

- **Schema `push` is off in production** (`NODE_ENV=production`, and the standalone bundle has no
  drizzle-kit). New collections/columns ship as SQL in `site/deploy/migration-round*.sql`,
  applied to the production DB out of band. Locally, push sometimes skips an additive column →
  500 `no such column`; add it with `ALTER TABLE … ADD COLUMN`. A benign "index already exists"
  push race → `rm -rf .next` and restart.
- **A new collection needs its `payload_locked_documents_rels` column**, or `/admin` edits error.
- **hasOne → hasMany moves the column** off the base table into `*_rels.<field>_id`. Drop the old
  column's indexes before the column — SQLite refuses otherwise.
- `.dockerignore` must exclude `deploy/*.tar.gz`, or each image contains the previous one.
- Reserve slugs matching real routes (`home`, `services`, `about`, `donate`) in `[slug]/page.tsx`.
- CSS math needs spaces: `clamp(a, b+c, d)` is silently dropped.
- Seed through REST, not `payload run`, while the dev server is up (push race).
- `[slug]` and list pages are SSG'd, so out-of-band DB edits need a rebuild; `/admin` edits
  revalidate via hooks. Home and the inner `sds` pages are `force-dynamic`.
- Payload draft edits live in autosave *versions*: read the latest with `?draft=true`.

## Editorial integrity

**Never write a guessed URL or fact into a published field — leave it empty and ask.** Early
seeding here once put placeholder domains nobody owned onto live project pages. Ground project
and post copy in a source.

## Design system

`design-system/` syncs to a Claude Design project. `site/src/app/home.css` is **generated** from
its bundle (`:root` tokens re-scoped to `.sds-single, .sds-project`) — regenerate it after any
design-system style change, then rebuild the site. Before a "pending" re-sync, compare the local
and remote bundle hashes; it is often already in sync.

The glass-card redesign (compass background, hover-reveal cards, scroll-driven motion, floating
"Let's talk") lives in `site/src/app/(frontend)/redesign.css` — hand-written, `rd-` prefixed, layered
on top of the generated `home.css`, so it does **not** need regenerating. `RdShell.tsx` is the shared
page chrome (home passes `home`); `RdCards.tsx` holds the hover-reveal card. Projects have two optional uploads — `logo` (card + the small tile on the project page; empty = the logo found on the
project's site via `/next/logo`, else initials) and `screenshot` (the image box on the project page; never on the card).
Board members have an optional `portrait` upload (falls back to the photo in `public/board/`, see `BOARD_PHOTOS` in `rd.ts`); case studies have no image field. These columns ship as Payload migrations in `site/src/migrations/` (`20261021_*`).

⚠ **`payload migrate:create` is unsafe here until the snapshot is refreshed.** `src/migrations/*.json` (the schema snapshot it diffs
against) predates the hand-applied `deploy/migration-round*.sql` changes, so a generated migration would try to re-add columns the box
already has (`projects.region`, `homepage_board`, …) and fail. Hand-write new migrations (see the `20261021_*` ones: they check
`PRAGMA table_info` before `ALTER TABLE ADD`, so they are safe to re-run), and test with `NODE_ENV=production DATABASE_URI=file:<copy>.db
pnpm exec payload migrate` against a copy of the box DB.
