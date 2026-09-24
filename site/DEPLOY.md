# Deploying the Sarapis site (self-host, Docker + SQLite)

This deploys the Payload/Next site as a single container behind your host's nginx, with the
SQLite database and uploaded media on persistent Docker volumes. The image has been built and
run-tested locally: home, blog, posts, `/admin`, and media all serve correctly on Alpine
(sharp + libsql native deps verified).

## What ships
- **App**: `Dockerfile` → Next.js standalone server (`sarapis-site:latest`), listening on `127.0.0.1:3000`.
- **DB**: SQLite file on volume `sarapis_data` (`/app/data/sarapis.db`). Seeded from this repo's `sarapis.db` (all migrated content).
- **Media**: 415 files / ~74 MB on volume `sarapis_media` (`/app/media`). Seeded from `public/media/`.
- **Schema**: the app runs with `push: true`, so it reconciles the schema to the DB on boot — no separate migration step.
- **Old WordPress URLs**: post permalinks (`/slug` → `/posts/slug`) are already handled by in-app redirects.

## Prerequisites
- A server you control with **Docker + Docker Compose v2** and a public IP.
- DNS control for **sarapis.org**.
- Ability to copy files to the server (scp/rsync).

---

## 1. Get the code + data onto the server
From your machine, in `Sarapis/site`:
```bash
SERVER=user@your-server          # set this
# App code (excludes node_modules/.next via .dockerignore at build time anyway):
rsync -az --exclude node_modules --exclude .next ./ "$SERVER:/opt/sarapis-site/"
# The seed data the image does NOT bake in:
scp sarapis.db "$SERVER:/opt/sarapis-site/sarapis.db"
rsync -az public/media/ "$SERVER:/opt/sarapis-site/public/media/"
```

## 2. Configure secrets (on the server)
```bash
cd /opt/sarapis-site
cp .env.production.example .env.production
# Generate three secrets and paste them in:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # x3
nano .env.production   # set PAYLOAD_SECRET, PREVIEW_SECRET, CRON_SECRET; confirm NEXT_PUBLIC_SERVER_URL=https://sarapis.org
```
> Keep `PAYLOAD_SECRET` stable forever — changing it logs out all admin sessions.

## 3. Build the image
```bash
docker compose -f docker-compose.prod.yml build
```

## 4. Create the container + volumes, then seed them
```bash
# Creates the container and its named volumes WITHOUT starting the app:
docker compose -f docker-compose.prod.yml create

# Copy the seed data into the (stopped) container's volume mounts:
CID=$(docker compose -f docker-compose.prod.yml ps -aq site)
docker cp ./sarapis.db "$CID:/app/data/sarapis.db"
docker cp ./public/media/. "$CID:/app/media/"
```

## 5. Start
```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f site   # watch for "Ready"
curl -I http://127.0.0.1:3000/                            # expect 200
```

## 6. nginx + TLS
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/sarapis.org
sudo ln -s /etc/nginx/sites-available/sarapis.org /etc/nginx/sites-enabled/
# Obtain certs (certbot rewrites the :80 block and adds the cert paths):
sudo certbot --nginx -d sarapis.org -d www.sarapis.org
sudo nginx -t && sudo systemctl reload nginx
```
Confirm BOTH ports respond: `curl -I http://sarapis.org` (301→https) and `curl -I https://sarapis.org` (200).

## 7. Verify before cutover
Point your laptop at the new server with a hosts-file override (no DNS change yet):
```
<server-ip>  sarapis.org
```
Then load the site + `/admin`, click through the blog and a few pages, and confirm media + the dark-red brand render. Remove the hosts entry when done.

## 8. DNS cutover
1. **Lower the TTL** on sarapis.org's A/AAAA records to 300s at least a day ahead.
2. Point the **A** record (and AAAA if used) at the new server's IP. Add `www` → same (the nginx config redirects www→apex).
3. Watch propagation (`dig sarapis.org`), then verify `https://sarapis.org` serves the new site.
4. Keep the old WordPress host running until you're satisfied — DNS rollback is just repointing the A record.

## 8b. Search visibility at launch — DO NOT SKIP

`next.sarapis.org` is deliberately **de-indexed** (2026-09-08, at Devin's request while the site was
pre-launch): its nginx vhost sets `X-Robots-Tag: noindex, noarchive` at server level, with
`/api/media/file/` overridden to `all` so wegov.nyc's and databook.nyc's hot-linked hero images stay in
Google Images. Full context in the workspace `CLAUDE.md` → "Search-engine visibility".

**The launch risk is shipping that header onto the real site and going live invisible.** `deploy/nginx.conf`
is clean, so the danger is only in copying the staging vhost or hand-editing. Check it explicitly:

```bash
# On the new sarapis.org vhost — MUST print nothing:
curl -sI https://sarapis.org/ | grep -i x-robots-tag
grep -n X-Robots-Tag /etc/nginx/sites-available/sarapis.org   # expect: no match
```

Also confirm the app is generating prod-hostname crawl files, not staging ones — these are **build
artifacts** from `NEXT_PUBLIC_SERVER_URL`, so they are only correct if the image was built with
`--build-arg NEXT_PUBLIC_SERVER_URL=https://sarapis.org`:

```bash
curl -s https://sarapis.org/robots.txt        # Host: + Sitemap: must say sarapis.org, NOT next.sarapis.org
curl -s https://sarapis.org/sitemap.xml       # <loc> entries must be sarapis.org
```

**Keep `next.sarapis.org` noindexed after launch.** Once both hosts serve identical content they compete as
duplicates, and the staging hostname must not outrank or cannibalise the real one. Two acceptable choices —
leave its `noindex` in place (simplest), or point the whole vhost at a `301 https://sarapis.org$request_uri`.
Do **not** simply remove the noindex and leave it serving.

**Google Search Console:**
- Any *temporary removal* placed on `https://next.sarapis.org/` is scoped to that hostname and lasts ~6
  months. It does **not** touch `sarapis.org`, so it never suppresses the launch — nothing to undo.
- After cutover, add/verify the `sarapis.org` property and submit `https://sarapis.org/sitemap.xml`.
- Existing `next.sarapis.org` results disappear as Google re-crawls and sees the noindex; that is the
  permanent mechanism, the removal request is just the fast hide.

## 9. After launch
- **Admin password:** the shipped `sarapis.db` seeds a throwaway dev login; on any deployment rotate it immediately (Log in → Users → strong password) and store it in a secrets manager — never in this repo.
- **Deploying**: `deploy/deploy-site`, installed as `/opt/sarapis/bin/deploy-site`, accepts exactly three words.
  - `status` shows what's running and whether it answers.
  - `deploy-latest` recreates the container on the highest-numbered `sarapis-site:rNN` image loaded on the host.
  - `rollback` recreates it on the next-lower image.

  Ship and `docker load` the new image first. Each deploy takes a consistent database snapshot, keeping the last
  5, then waits for the site to answer before reporting success. It never rolls back on its own: a failed health
  check exits 1 and names the command to run.

  No tag is accepted from the caller, and that is deliberate. A fixed vocabulary lets the script be the **forced
  command** of a restricted SSH key, whose `authorized_keys` line is:
  ```
  restrict,command="/opt/sarapis/bin/deploy-site" ssh-ed25519 AAAA… deploy-key
  ```
  That key can run those three words and nothing else: no shell, no forwarding, no arguments. So an automated
  deployer can hold it without holding root.
- **Backups**: `deploy/backup/sarapis-backup.py` (Python 3 standard library only), run nightly by
  `deploy/backup/sarapis-backup.cron`. The site's state is the SQLite database plus the media directory,
  and the script backs up both:
  - **Consistent database snapshot** via SQLite's online-backup API. Never `cp` a live database: it can
    capture a half-written transaction.
  - **Integrity check** on the snapshot, which must also contain at least one user.
  - **A restore test on the compressed artifact itself**: it's decompressed, integrity-checked, and its
    row counts must match the snapshot.
  - **A media archive**, whose file count is checked.
  - **Retention** of the newest 14 of each.
  - **An optional off-box copy** with `rclone` (`RCLONE_REMOTE`).

  It writes `backup-status.json` beside the database, and the site serves it at **`/next/backup/health`**:
  503 unless a backup succeeded in the last 26 h **and** reached an off-box copy. Point an uptime monitor
  at it.
  ```bash
  install -d /opt/sarapis/bin /opt/sarapis/backups
  install -m 755 deploy/backup/sarapis-backup.py /opt/sarapis/bin/
  install -m 644 deploy/backup/sarapis-backup.cron /etc/cron.d/sarapis-backup
  /usr/bin/python3 /opt/sarapis/bin/sarapis-backup.py      # run once now; exit 0 = backed up + restore-tested
  ```
  Tests: `python3 -m unittest discover -s deploy/backup`.
  **Restore:** stop the container, then `gunzip -c sarapis-db-<stamp>.db.gz > /opt/sarapis/data/sarapis.db`,
  `chown 1001:1001` it, and, as root, `tar -xzf media-<stamp>.tar.gz -C /opt/sarapis`. It unpacks as `media/`,
  and root's tar restores the recorded owner, uid 1001 — the container's user. Start the container again.
- **Cert renewal**: certbot installs a renew timer automatically; confirm with `systemctl list-timers | grep certbot`.

## Redeploying after code changes
```bash
cd /opt/sarapis-site
git pull            # or rsync the updated code
docker compose -f docker-compose.prod.yml up -d --build   # volumes (db + media) persist across rebuilds
```
The DB and media are on volumes, so rebuilds never touch your content.

## Schema changes (migrations)
Prod runs with `push:false` (dev-only), so **schema changes do NOT auto-apply on the box** — and the slim Next-standalone runtime image has no Payload CLI, so `payload migrate` can't run inside the container. Apply migrations from a full-deps checkout, against a copy of the box DB, per the "Local → apply → copy back" rule:

1. **Author the change** in `site/src/collections/*`; `pnpm dev` auto-syncs your local DB (push).
2. **Create the migration** (committed): `pnpm exec payload migrate:create <name>` → new file in `site/src/migrations/`.
3. **Apply to the box DB** (from `site/`, full deps):
   ```bash
   scp "$SERVER":/opt/sarapis/data/sarapis.db ./boxcopy.db
   NODE_ENV=production DATABASE_URI="file:./boxcopy.db" pnpm exec payload migrate   # runs only unapplied migrations
   ssh "$SERVER" 'docker stop sarapis-site && cp /opt/sarapis/data/sarapis.db /opt/sarapis/data/sarapis.db.bak-$(date +%s)'
   scp ./boxcopy.db "$SERVER":/opt/sarapis/data/sarapis.db
   ssh "$SERVER" 'chown 1001:1001 /opt/sarapis/data/sarapis.db && docker start sarapis-site'
   ```
4. **Rebuild + redeploy the image** so the baked `sarapis.db` (used for SSG) and the new migration files ship too.

> The box's migration history is baselined at `20260702_024828_initial` (the full schema as of the security-review deploy). `payload migrate` therefore only runs migrations created *after* it. For a one-off column add, the direct `ALTER TABLE` (python3 sqlite3) still works — but prefer a committed migration so the schema stays versioned. Never edit the DB inside the container.

## Rollback
- App issue: `docker compose -f docker-compose.prod.yml down` and the old WordPress site is still live until DNS is moved.
- After DNS cutover: repoint the A record back to the WordPress host (TTL is low from step 8).

---

## Release: round 17 — handoff 7 (single-page home + Project pages)

**What changed since the last deploy:** `/` is now the single-page site (region-tab / lineage
Projects centerpiece), the `/activity` page is retired (→ `/#projects`), a new
`/projects/[id]` route, the "Activities" nav item is gone, and per-project activity is wired
to real data. **Schema additions:** 4 new `projects` columns (`region`, `role`, `lineage`,
`site`) + a new **`homepage`** global (5 tables). Because the standalone prod bundle does NOT
run `push:true`, the box's runtime DB needs these applied out-of-band (see round-14 lesson).

Verified locally: `pnpm build` is green (exit 0), all routes 200, feeds populate.

### Artifacts in this repo
- `deploy/migration-round17.sql` — schema delta (projects columns + homepage tables/indexes).
- `deploy/seed-round17.sql` — data seed (project taxonomy + event/repo→project links + publish).
- `deploy/seed-homepage.py` — REST seed for the Homepage global editorial content.
- `deploy/sarapis-site-r17.tar.gz` — the cross-built `linux/amd64` image (`sarapis-site:r17`).

### Steps

**1. Ship the image**
```bash
# built locally with:
#   docker buildx build --platform linux/amd64 \
#     --build-arg NEXT_PUBLIC_SERVER_URL=https://next.sarapis.org \
#     --provenance=false --sbom=false -t sarapis-site:r17 --load .
#   docker save sarapis-site:r17 | gzip > deploy/sarapis-site-r17.tar.gz
scp deploy/sarapis-site-r17.tar.gz "$SERVER":/opt/sarapis/
ssh "$SERVER" 'gunzip -c /opt/sarapis/sarapis-site-r17.tar.gz | docker load'
```

**2. Bring the box DB up to the new schema — pick ONE path:**

- **Path A (simplest — ship the local DB).** The repo's `sarapis.db` already has the new
  schema AND all handoff-7 data (homepage global, project taxonomy, 400 linked/published
  events). Overwrites box-side content edits — fine for staging; confirm first.
  ```bash
  ssh "$SERVER" 'cp /opt/sarapis/data/sarapis.db /opt/sarapis/data/sarapis.db.bak-r17 && docker stop sarapis-site'
  scp sarapis.db "$SERVER":/opt/sarapis/data/sarapis.db
  ssh "$SERVER" 'chown 1001:1001 /opt/sarapis/data/sarapis.db'
  ```

- **Path B (preserve the box DB).** Apply the schema delta + data seed to the box's existing
  DB (keeps any box-side edits). Back up first.
  ```bash
  scp deploy/migration-round17.sql deploy/seed-round17.sql "$SERVER":/opt/sarapis/
  ssh "$SERVER" '
    cd /opt/sarapis && cp data/sarapis.db data/sarapis.db.bak-r17 && docker stop sarapis-site &&
    python3 -c "import sqlite3;sqlite3.connect(\"data/sarapis.db\").executescript(open(\"migration-round17.sql\").read())" &&
    python3 -c "import sqlite3;sqlite3.connect(\"data/sarapis.db\").executescript(open(\"seed-round17.sql\").read())"'
  # then, with the container back up (step 3), seed the Homepage global editorial content:
  python3 deploy/seed-homepage.py <base-url> <admin-email> <admin-password>
  ```

**3. Recreate the container** (same config as prior deploys — capture with `docker inspect`
first; restart=unless-stopped, --memory 1g, user nextjs, `-p 127.0.0.1:3000:3000`,
`--env-file /opt/sarapis/.env`, binds `/opt/sarapis/{data,media}`):
```bash
ssh "$SERVER" 'docker rm -f sarapis-site; docker run -d --name sarapis-site \
  --restart unless-stopped --memory 1g -p 127.0.0.1:3000:3000 \
  --env-file /opt/sarapis/.env \
  -v /opt/sarapis/data:/app/data -v /opt/sarapis/media:/app/media \
  sarapis-site:r17'
```

**4. Verify on the box**
```bash
for p in / /projects/1 /activity /posts /admin; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' https://next.sarapis.org$p) $p"; done
# expect: 200 /, 200 /projects/1, 307 /activity (→ /#projects), 200 /posts, 200 /admin
```
Spot-check `https://next.sarapis.org/` (region tabs + lineage), a project profile, and that the
top nav no longer shows "Activities".

**Rollback:** previous image is still tagged locally; `docker run … sarapis-site:<previous>` and
restore `data/sarapis.db.bak-r17`.
