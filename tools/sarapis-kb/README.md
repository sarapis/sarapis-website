# sarapis-kb

Quick-capture **Knowledge Items** into the Sarapis site from the terminal. Talks
to the site's Payload REST API — no server component, works against the live
site directly.

## Install

Needs Node 18+ (uses global `fetch`/`FormData`). No dependencies.

```bash
# make it runnable from anywhere (optional)
ln -s "$PWD/sarapis-kb.mjs" /usr/local/bin/sarapis-kb
```

## Configure

Credentials + target URL resolve in this order: **flags → env → `~/.sarapis-kb.json`**.

```bash
cp config.example.json ~/.sarapis-kb.json
chmod 600 ~/.sarapis-kb.json      # it holds your admin password
# then edit the password
```

Or use env vars: `SARAPIS_URL`, `SARAPIS_EMAIL`, `SARAPIS_PASSWORD`.

> The current auth is your admin email/password. If you'd rather not store a
> password, we can switch to a Payload API key later (needs a small Users-schema
> change + redeploy).

## Use

```bash
# a link
sarapis-kb add https://openreferral.org/hsds --title "HSDS overview" --project "Open Referral"

# a file (uploaded to media, stored as an artifact item; type inferred from extension)
sarapis-kb add ./methodology.md --summary "Databook capital-projects methodology"

# publish immediately (default is unpublished — curate in /admin otherwise)
sarapis-kb add https://example.org/post --title "A post" --published

# see recent items
sarapis-kb list --limit 20
```

### `add` options
| flag | meaning |
|---|---|
| `--title` | item title (default: the URL, or the filename) |
| `--summary` | short description |
| `--date` | ISO date (default: now) |
| `--project` | link to a project — exact name or numeric id |
| `--file-type` | `md` \| `html` \| `doc` (artifacts; inferred from extension) |
| `--kind` | force `link` \| `artifact` (default: auto-detect from the argument) |
| `--published` | publish immediately |
| `--pinned` | pin in the Activity feed |

Items land **unpublished** by default; they appear on `/activity` only once
`published` is set (here or in `/admin → Activity`).
