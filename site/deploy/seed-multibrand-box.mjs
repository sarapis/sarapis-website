/**
 * seed-multibrand-box.mjs — Phase 2+3 data seed for the BOX (Round 37).
 *
 * Pure REST (zero-dep Node 18+), run from LOCAL against the box so the box's
 * diverged data isn't clobbered and no Lexical conversion is needed (the 14 WeGov
 * articles already live on the box from the July import — we just relabel them).
 *
 *   node deploy/seed-multibrand-box.mjs            # against https://next.sarapis.org
 *   HOST=http://127.0.0.1:3000 node ...            # ON the box (after recreate)
 *   DRY=1 node ...                                 # log actions, no writes
 *
 * Creds from ~/.sarapis-kb.json ({ url, email, password }) or SARAPIS_* env.
 * Idempotent: sites upsert by key; posts relabel by slug; events upsert by title;
 * backfill only touches site-less Posts/Pages.
 *
 * Order matters: run AFTER migration-round37.sql is applied and the r37 container
 * is up. If any Strapi article slug is missing on the box (shouldn't be), re-run
 * scripts/import-wegov.ts first (it converts HTML→Lexical + creates), then this.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const STRAPI = 'https://strapi.wegov.nyc'
const DRY = process.env.DRY === '1'
const SKIP_SLUGS = new Set(['wegovnycs-databook-featured-in-local-news-story'])

function creds() {
  const envHost = process.env.HOST || process.env.SARAPIS_URL
  let j = {}
  try { j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.sarapis-kb.json'), 'utf8')) } catch {}
  return {
    base: (envHost || j.url || 'https://next.sarapis.org').replace(/\/$/, ''),
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
  console.log(`logged in to ${base} as ${email}${DRY ? ' (DRY)' : ''}`)

  // ---- sites (upsert by key) ----
  async function upsertSite(key, data) {
    const q = await fetch(`${API}/sites?where[key][equals]=${key}&limit=1`, { headers: auth })
    const found = (await q.json())?.docs?.[0]
    if (DRY) { console.log(`  site ${key}: ${found ? 'update' : 'create'} (dry)`); return found?.id ?? 0 }
    if (found) {
      await fetch(`${API}/sites/${found.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify(data) })
      console.log(`  = site ${key} #${found.id}`); return found.id
    }
    const c = await fetch(`${API}/sites`, { method: 'POST', headers: auth, body: JSON.stringify({ key, ...data }) })
    const id = (await c.json())?.doc?.id
    console.log(`  + site ${key} #${id}`); return id
  }

  const sarapisId = await upsertSite('sarapis', { name: 'Sarapis', domain: 'sarapis.org', siteName: 'Sarapis' })

  const gl = (await (await fetch(`${STRAPI}/api/global?populate[navbar][populate]=*&populate[footer][populate]=*&populate[defaultSeo][populate]=*`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json())?.data || {}
  const nav = (gl.navbar?.links || []).map((l) => ({ label: l.label, href: l.url }))
  if (gl.navbar?.button?.url) nav.push({ label: gl.navbar.button.label, href: gl.navbar.button.url })
  const wegovId = await upsertSite('wegovnyc', {
    name: 'WeGov NYC', domain: 'wegov.nyc', siteName: gl.siteName || 'WeGovNYC',
    nav, footer: { tagline: gl.footer?.newsletterText || '', links: (gl.footer?.socialLinks || []).map((l) => ({ label: l.label, href: l.url })) },
    defaultSeo: { title: gl.defaultSeo?.metaTitle || '', description: gl.defaultSeo?.metaDescription || '' },
  })

  // ---- relabel existing WeGov articles → sites=[wegovnyc] (by slug) ----
  const articles = (await (await fetch(`${STRAPI}/api/articles?pagination%5BpageSize%5D=100&populate=*`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json())?.data || []
  let relabeled = 0; const missing = []
  for (const a of articles) {
    const slug = (a.attributes || a).slug
    if (SKIP_SLUGS.has(slug)) continue
    const q = await fetch(`${API}/posts?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&draft=true`, { headers: auth })
    const post = (await q.json())?.docs?.[0]
    if (!post) { missing.push(slug); continue }
    if (!DRY) await fetch(`${API}/posts/${post.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ sites: [wegovId] }) })
    relabeled++
  }
  console.log(`  articles relabeled → wegovnyc: ${relabeled}`)
  if (missing.length) console.log(`  ⚠ ${missing.length} Strapi slugs NOT on box (run import-wegov.ts): ${missing.join(', ')}`)

  // ---- events (upsert by title) ----
  const events = (await (await fetch(`${STRAPI}/api/events?pagination%5BpageSize%5D=100&populate=*`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json())?.data || []
  let ev = 0
  for (const e of events) {
    const x = e.attributes || e
    const data = { title: x.title, description: x.description || undefined, category: x.category || undefined, startDate: x.startDate || undefined, endDate: x.endDate || undefined, dateLabel: x.dateLabel || undefined, location: x.location || undefined, link: x.link || undefined, published: true, sites: [wegovId] }
    const q = await fetch(`${API}/events?where[title][equals]=${encodeURIComponent(x.title)}&limit=1`, { headers: auth })
    const found = (await q.json())?.docs?.[0]
    if (!DRY) {
      if (found) await fetch(`${API}/events/${found.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify(data) })
      else await fetch(`${API}/events`, { method: 'POST', headers: auth, body: JSON.stringify(data) })
    }
    ev++
  }
  console.log(`  events upserted → wegovnyc: ${ev}`)

  // ---- backfill site-less Posts/Pages → sarapis ----
  let backfilled = 0
  for (const coll of ['posts', 'pages']) {
    let page = 1, pages = 1
    do {
      const r = await (await fetch(`${API}/${coll}?depth=0&limit=100&page=${page}&draft=true`, { headers: auth })).json()
      pages = r.totalPages || 1
      for (const d of r.docs || []) {
        const cur = Array.isArray(d.sites) ? d.sites : d.sites ? [d.sites] : []
        if (cur.length === 0) {
          if (!DRY) await fetch(`${API}/${coll}/${d.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ sites: [sarapisId] }) })
          backfilled++
        }
      }
      page++
    } while (page <= pages)
  }
  console.log(`  backfilled site-less Posts/Pages → sarapis: ${backfilled}`)

  console.log(`\ndone. sites: sarapis#${sarapisId}, wegovnyc#${wegovId}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
