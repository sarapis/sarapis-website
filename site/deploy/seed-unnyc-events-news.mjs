/**
 * seed-unnyc-events-news.mjs — move wegov.nyc/unnyc's events + news into the CMS.
 *
 * The /unnyc page fetched `/events` and `/news-items`; the front-end client
 * didn't serve them, so it fell back to the hardcoded arrays in
 * `frontend/src/data/unnyc.js`. Those arrays are what visitors see today, so
 * they are the SOURCE OF TRUTH here: this upserts all of them into Payload
 * (brand `wegovnyc`) so wiring the client changes nothing visually — the content
 * just becomes editable in the admin.
 *
 * ⚠ Payload's `events` already held 4 items migrated from Strapi — a SUBSET of
 * the 9 static ones. Seeding only the missing ones (matched by title) would
 * otherwise have dropped the page from 9 events to 4.
 *
 *   node deploy/seed-unnyc-events-news.mjs [--dry]
 *   UNNYC_DATA=/path/to/unnyc.js   # defaults to the WeGovMarketing checkout
 *
 * Idempotent: upsert by title within the brand. Creds from ~/.sarapis-kb.json
 * or SARAPIS_* env.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const DRY = process.argv.includes('--dry')
const SITE_KEY = process.env.SITE_KEY || 'wegovnyc'
const DATA = process.env.UNNYC_DATA
  || '/Users/devin/Antigravity/WeGovMarketing/frontend/src/data/unnyc.js'

function creds() {
  let j = {}
  try { j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.sarapis-kb.json'), 'utf8')) } catch {}
  return {
    base: (process.env.HOST || process.env.SARAPIS_URL || j.url || 'https://next.sarapis.org').replace(/\/$/, ''),
    email: process.env.SARAPIS_EMAIL || j.email,
    password: process.env.SARAPIS_PASSWORD || j.password,
  }
}

/** Load the two exported arrays out of the front-end's static data module. */
async function loadStatic() {
  const src = fs.readFileSync(DATA, 'utf8')
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))
  return { events: mod.events || [], news: mod.news || [] }
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

  const siteRes = await fetch(`${API}/sites?where[key][equals]=${SITE_KEY}&limit=1&depth=0`, { headers: auth })
  const siteId = (await siteRes.json())?.docs?.[0]?.id
  if (!siteId) throw new Error(`site "${SITE_KEY}" not found`)
  console.log(`  brand ${SITE_KEY} = #${siteId}`)

  const { events, news } = await loadStatic()
  console.log(`  static source: ${events.length} events, ${news.length} news items`)

  async function upsert(collection, title, data) {
    const q = await fetch(
      `${API}/${collection}?where[title][equals]=${encodeURIComponent(title)}&limit=1&depth=0`,
      { headers: auth },
    )
    const found = (await q.json())?.docs?.[0]
    if (DRY) { console.log(`   ${found ? '=' : '+'} ${collection}: ${title} (dry)`); return }
    if (found) {
      // Preserve any brands already set; just ensure this one is included.
      const cur = (Array.isArray(found.sites) ? found.sites : found.sites ? [found.sites] : [])
        .map((s) => (typeof s === 'object' ? s.id : s))
      const sites = cur.includes(siteId) ? cur : [...cur, siteId]
      const r = await fetch(`${API}/${collection}/${found.id}`, {
        method: 'PATCH', headers: auth, body: JSON.stringify({ ...data, sites }),
      })
      console.log(`   ${r.ok ? '=' : '✗'} ${collection} #${found.id}: ${title}`)
    } else {
      const r = await fetch(`${API}/${collection}`, {
        method: 'POST', headers: auth, body: JSON.stringify({ ...data, sites: [siteId] }),
      })
      const j = await r.json()
      console.log(`   ${r.ok ? '+' : '✗'} ${collection} #${j?.doc?.id ?? '?'}: ${title}${r.ok ? '' : ' ' + JSON.stringify(j).slice(0, 160)}`)
    }
  }

  console.log('\nevents:')
  for (const e of events) {
    await upsert('events', e.title, {
      title: e.title,
      category: e.category ?? undefined,
      dateLabel: e.date ?? undefined,          // static `date` is the display label
      startDate: e.start ? new Date(e.start).toISOString() : undefined,
      endDate: e.end ? new Date(e.end).toISOString() : undefined,
      location: e.location ?? undefined,
      description: e.description ?? undefined,
      link: e.link ?? undefined,
      published: true,
    })
  }

  console.log('\nnews items:')
  for (const n of news) {
    await upsert('news-items', n.title, {
      title: n.title,
      source: n.source ?? undefined,
      excerpt: n.excerpt ?? undefined,
      dateLabel: n.date ?? undefined,
      sortDate: n.sortDate ? new Date(n.sortDate).toISOString() : undefined,
      link: n.link ?? undefined,
      published: true,
    })
  }

  // Report final counts as the front-end will see them.
  for (const coll of ['events', 'news-items']) {
    const r = await fetch(`${API}/${coll}?where[sites.key][equals]=${SITE_KEY}&limit=0`, { headers: auth })
    console.log(`\n${coll} for ${SITE_KEY}: ${(await r.json())?.totalDocs}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
