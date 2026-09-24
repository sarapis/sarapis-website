# Sarapis website

The website for [**Sarapis Foundation**](https://sarapis.org), a New York nonprofit building
free, libre and open-source software for nonprofits and the public sector. It replaces a
WordPress site with **Payload CMS + Next.js**, and doubles as a multi-brand CMS that serves
content to other Sarapis projects' websites.

We build in the open, and that includes our own website.

## What's here

- **`site/`** — the website and CMS: Payload 3 + Next 16 on SQLite. See [`site/DEPLOY.md`](site/DEPLOY.md)
  for self-hosting with Docker.
- **`design-system/`** — `@sarapis/design-system`, a standalone React component library used for
  design iteration. The site re-implements its styles rather than importing it at runtime.
- **`migration/`** — the one-off WordPress export parser used for the original import.
- **`tools/sarapis-kb/`** — a small CLI for adding Knowledge Items over the REST API.

## Features

- A single-page home with a region-tabbed **Active Projects** section, plus **`/projects`** and
  per-project profiles.
- A **live activity feed**: an hourly GitHub sync pulls commits, pull requests and releases, keeps
  internal engineering process off the public feed, and writes a short plain-language summary of
  each change with Gemini. Every summary is editable in the CMS.
- **`/posts`** — one feed of blog posts, knowledge items and published activity, filterable by
  type and tag.
- **`/services`**, **`/about`**, a contact form, an email signup, and **`/donate`** (Stripe
  embedded checkout).
- **Multi-brand content**: one entry can publish to several brand websites through a `sites` field.

## Run it locally

```bash
cd site
pnpm install
cp .env.example .env          # set PAYLOAD_SECRET and friends
PORT=3009 pnpm exec next dev -p 3009     # http://localhost:3009, admin at /admin
```

Create an admin user:

```bash
ADMIN_EMAIL=you@example.org ADMIN_PASSWORD='choose-one' pnpm payload run scripts/create-admin.ts
```

Tests and typecheck:

```bash
pnpm exec vitest run
pnpm exec tsc --noEmit
```

The database (`site/sarapis.db`) and uploaded media are gitignored.

## Contributing

Issues and pull requests are welcome. [`CLAUDE.md`](CLAUDE.md) documents the architecture, the
access model and the gotchas that have bitten this project — worth a read before changing a
collection, whether or not you use an AI assistant.

To report a security issue, please use GitHub's **Report a vulnerability** button on the
repository's Security tab rather than opening a public issue.

## License

[MIT](LICENSE) © Sarapis Foundation. Portions of `site/` are derived from the
[Payload Website Template](https://github.com/payloadcms/payload/tree/main/templates/website),
© Payload CMS, Inc., also MIT — see [`site/NOTICE`](site/NOTICE).
