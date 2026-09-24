/**
 * seed-databook-brand.mjs — Phase 6a: add the `databook` brand and tag its posts.
 *
 * Creates/updates the `databook` Site doc, then tags every article that
 * databook.nyc/blog shows (Strapi category = "Databook") with the databook brand
 * IN ADDITION to whatever brands it already has — this is the multi-brand
 * `sites` (hasMany) model doing its job: one post, two blogs.
 *
 *   node deploy/seed-databook-brand.mjs           # against https://next.sarapis.org
 *   DRY=1 node deploy/seed-databook-brand.mjs     # preview
 *
 * Creds from ~/.sarapis-kb.json or SARAPIS_* env. Idempotent (upsert by key,
 * union of existing sites).
 *
 * Slug note: Strapi's `wegovnycs-databook-featured-in-local-news-story` is the
 * same article as Payload's `wegovnycs-databook-featured-in-local-news` (imported
 * from WordPress with a shorter slug). We tag the Payload doc; PayloadService
 * carries a legacy-slug alias so the old databook.nyc URL keeps resolving.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const STRAPI = 'https://strapi.wegov.nyc'
const DRY = process.env.DRY === '1'

// Strapi slug -> Payload slug, where they differ.
const SLUG_ALIASES = {
  'wegovnycs-databook-featured-in-local-news-story': 'wegovnycs-databook-featured-in-local-news',
}

function creds() {
  let j = {}
  try { j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.sarapis-kb.json'), 'utf8')) } catch {}
  return {
    base: (process.env.HOST || process.env.SARAPIS_URL || j.url || 'https://next.sarapis.org').replace(/\/$/, ''),
    email: process.env.SARAPIS_EMAIL || j.email,
    password: process.env.SARAPIS_PASSWORD || j.password,
  }
}

async function main() {
  const { base, email, password } = creds()
  const API = `${base}/api`
  const login = await fetch(`${API}/users/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const lj = await login.json()
  if (!login.ok || !lj.token) throw new Error(`login failed: ${login.status}`)
  const auth = { Authorization: `JWT ${lj.token}`, 'Content-Type': 'application/json' }
  console.log(`logged in to ${base}${DRY ? ' (DRY)' : ''}`)

  // ---- databook Site doc ----
  const data = {
    name: 'Databook', domain: 'databook.nyc', siteName: 'WeGovNYC Databook',
    defaultSeo: { description: 'News & updates from WeGovNYC Databook.' },
  }
  const q = await fetch(`${API}/sites?where[key][equals]=databook&limit=1`, { headers: auth })
  const found = (await q.json())?.docs?.[0]
  let siteId = found?.id
  if (found) {
    if (!DRY) await fetch(`${API}/sites/${found.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify(data) })
    console.log(`  = site databook #${found.id}`)
  } else if (DRY) {
    console.log('  + site databook (dry)')
  } else {
    const c = await fetch(`${API}/sites`, { method: 'POST', headers: auth, body: JSON.stringify({ key: 'databook', ...data }) })
    siteId = (await c.json())?.doc?.id
    console.log(`  + site databook #${siteId}`)
  }

  // ---- which articles does databook.nyc/blog show? (Strapi category=Databook) ----
  const url = `${STRAPI}/api/articles?filters[category][$eq]=Databook&pagination[limit]=100`
  const arts = (await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json())?.data || []
  console.log(`  databook-category articles in Strapi: ${arts.length}`)

  let tagged = 0
  const missing = []
  for (const a of arts) {
    const strapiSlug = (a.attributes || a).slug
    const slug = SLUG_ALIASES[strapiSlug] || strapiSlug
    const r = await fetch(`${API}/posts?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=0&draft=true`, { headers: auth })
    const post = (await r.json())?.docs?.[0]
    if (!post) { missing.push(strapiSlug); continue }

    const cur = (Array.isArray(post.sites) ? post.sites : post.sites ? [post.sites] : [])
      .map((s) => (typeof s === 'object' ? s.id : s))
    if (siteId && cur.includes(siteId)) { console.log(`  = #${post.id} ${slug} (already databook)`); tagged++; continue }
    const next = siteId ? [...cur, siteId] : cur
    if (!DRY) {
      const up = await fetch(`${API}/posts/${post.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ sites: next }) })
      if (!up.ok) { console.warn(`  ✗ #${post.id} ${slug}: PATCH ${up.status}`); continue }
    }
    console.log(`  + #${post.id} ${slug} → sites ${JSON.stringify(next)}`)
    tagged++
  }

  console.log(`\ntagged ${tagged}/${arts.length} for databook${DRY ? ' (dry)' : ''}`)
  if (missing.length) console.log(`⚠ not found in Payload (${missing.length}): ${missing.join(', ')}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
