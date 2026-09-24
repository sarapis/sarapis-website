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
```

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
- Auto-publish only for `PUBLISH_ACTORS` logins. Commit events are aggregated per day.
  ⚠ **The gate reads only GitHub-attributed accounts** (`commit.author.login`), never the git
  `user.name` — that is free text anyone landing a commit can set. `aggregateCommitsByDay` keeps
  them apart as `logins` (gate) and `names` (display); `tests/int/github-sync-publish-gate.int.spec.ts`
  pins it.
- **Internal engineering process is kept off the public feed** at the commit-*message* level
  (`isInternalLine`), not the event level, because one day mixes real work with deploy churn.
  An event with nothing public is created *unpublished*, never dropped.
- AI summaries come from Gemini. The 2.5/3.x "flash" models are *thinking* models: keep
  `thinkingConfig.thinkingBudget: 0` or they spend the output budget reasoning and return a fragment.
- **Failures are reported, not swallowed.** `summary.errors` = data that did not sync (a failed owner,
  repo or fetch, or a spent rate limit); any entry makes the run `success: false` / HTTP 500.
  `summary.warnings` = degraded but nothing lost (Gemini skipped, retried next run; a capped commit
  window). **`GET /next/github-sync/health`** (public, counts only) is 503 when the last run had errors
  *or* no run has finished in 150 min — point an uptime monitor at it. A dead cron is silence, not a
  failing run, so the staleness half matters as much as the error half.
- **Commits are fetched in a window** (`commitWindowStart`): from 00:00 UTC of the newest recorded day,
  or the whole active window for a new repo — GitHub's `since` filters on committer date, the same date
  days are bucketed by. Repair lost history with `?since=YYYY-MM-DD` on the sync route.
- Gemini has a per-run **circuit breaker**: after one hard failure it is skipped for the rest of the
  run, and the budget counts attempts, so an outage can't turn a sync into an hours-long request.
- ⚠ `externalId` embeds `repoFullName`, so a **fork** of an already-synced repo re-ingests the
  shared history as duplicate events.
- The route has an in-process mutex (409 "Sync already running"), and a client timeout does not
  abort the server handler — for a long backfill, trigger once and poll.

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
