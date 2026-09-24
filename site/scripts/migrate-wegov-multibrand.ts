/**
 * Multi-brand migration (Phase 2 + 3) — LOCAL dry run.
 *
 * Seeds the `sarapis` + `wegovnyc` Site docs, migrates WeGov's Strapi content
 * (articles → Posts, events → Events, global → the wegovnyc Site doc) tagged
 * sites=[wegovnyc], relabels any already-imported WeGov posts (matched by slug)
 * to sites=[wegovnyc], then backfills every remaining site-less Post/Page to
 * sites=[sarapis].
 *
 * Uses the Payload LOCAL API (getPayload) for both HTML→Lexical conversion and
 * writes, so run it with the dev server STOPPED (single pusher — avoids the
 * push race):
 *   cd site && pnpm payload run scripts/migrate-wegov-multibrand.ts
 *
 * Idempotent: articles/events upsert by slug/title; sites upsert by key; backfill
 * only touches docs whose `sites` is empty. Env knobs: WEGOV_ARTICLE_LIMIT caps
 * article count; DRY=1 logs actions without writing.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  convertHTMLToLexical,
  editorConfigFactory,
  lexicalEditor,
  HeadingFeature,
  BlockquoteFeature,
  UnorderedListFeature,
  OrderedListFeature,
  UploadFeature,
  HorizontalRuleFeature,
  EXPERIMENTAL_TableFeature,
} from '@payloadcms/richtext-lexical'
import { JSDOM } from 'jsdom'
import path from 'path'

const STRAPI = 'https://strapi.wegov.nyc'
const SKIP_SLUGS = new Set(['wegovnycs-databook-featured-in-local-news-story'])
const CAT_MAP: Record<string, string> = { Databook: 'Databook', Events: 'Events', UNNY: 'Open Government' }
const DRY = process.env.DRY === '1'
const ARTICLE_LIMIT = Number(process.env.WEGOV_ARTICLE_LIMIT || 0)

const absHero = (u: string) => (/^https?:\/\//.test(u) ? u : STRAPI + u)

function rewriteHtml(html: string, map: Map<string, string>) {
  let h = html
  for (const [orig, neu] of map) h = h.split(orig).join(neu)
  h = h.replace(/<a[^>]*href=["']\s*#?\s*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1')
  h = h.replace(/<a(?![^>]*\shref=)[^>]*>([\s\S]*?)<\/a>/gi, '$1')
  h = h.replace(/<!--[\s\S]*?-->/g, '')
  h = h.replace(/\[\/?[a-z][a-z0-9_]*(?:[^\]]*)\]/gi, '')
  return h
}
function fixUploads(node: any, urlToId: Map<string, any>): any | null {
  if (!node || typeof node !== 'object') return node
  if (node.type === 'upload') {
    const src: string | undefined = node.pending?.src || node.src
    const id = src ? urlToId.get(src) : undefined
    if (!id) return null
    return { type: 'upload', relationTo: 'media', value: id, fields: null, format: '', version: 3 }
  }
  if (Array.isArray(node.children)) node.children = node.children.map((c: any) => fixUploads(c, urlToId)).filter(Boolean)
  if (node.root) node.root = fixUploads(node.root, urlToId)
  return node
}

async function main() {
  const payload = await getPayload({ config })
  const editor = lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
      BlockquoteFeature(),
      UnorderedListFeature(),
      OrderedListFeature(),
      UploadFeature(),
      HorizontalRuleFeature(),
      EXPERIMENTAL_TableFeature(),
    ],
  })
  const editorConfig = await editorConfigFactory.fromEditor({ config: payload.config, editor })

  // ---- sites ----
  async function ensureSite(key: string, data: Record<string, any>) {
    const found = await payload.find({ collection: 'sites', where: { key: { equals: key } }, limit: 1, overrideAccess: true })
    if (found.docs[0]) {
      if (!DRY) await payload.update({ collection: 'sites', id: found.docs[0].id, data, overrideAccess: true })
      console.log(`  = site "${key}" (#${found.docs[0].id}) updated`)
      return found.docs[0].id
    }
    if (DRY) { console.log(`  + site "${key}" (dry)`); return 0 }
    const c = await payload.create({ collection: 'sites', data: { key, ...data }, overrideAccess: true })
    console.log(`  + site "${key}" (#${c.id}) created`)
    return c.id
  }

  const sarapisId = await ensureSite('sarapis', { name: 'Sarapis', domain: 'sarapis.org', siteName: 'Sarapis' })

  const gl = (await (await fetch(`${STRAPI}/api/global?populate[navbar][populate]=*&populate[footer][populate]=*&populate[defaultSeo][populate]=*`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json())?.data || {}
  const nav = (gl.navbar?.links || []).map((l: any) => ({ label: l.label, href: l.url }))
  if (gl.navbar?.button?.url) nav.push({ label: gl.navbar.button.label, href: gl.navbar.button.url })
  const footerLinks = (gl.footer?.socialLinks || []).map((l: any) => ({ label: l.label, href: l.url }))
  const wegovId = await ensureSite('wegovnyc', {
    name: 'WeGov NYC',
    domain: 'wegov.nyc',
    siteName: gl.siteName || 'WeGovNYC',
    nav,
    footer: { tagline: gl.footer?.newsletterText || '', links: footerLinks },
    defaultSeo: { title: gl.defaultSeo?.metaTitle || '', description: gl.defaultSeo?.metaDescription || '' },
  })

  // ---- media ----
  const mediaBySrc = new Map<string, { id: any; url: string } | null>()
  async function rehost(srcUrl: string, alt: string) {
    if (mediaBySrc.has(srcUrl)) return mediaBySrc.get(srcUrl)
    try {
      const res = await fetch(srcUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const mime = res.headers.get('content-type')?.split(';')[0] || 'image/png'
      const name = decodeURIComponent(path.basename(new URL(srcUrl).pathname)) || 'image.png'
      const doc = await payload.create({ collection: 'media', data: { alt: alt || name }, file: { data: buf, mimetype: mime, name, size: buf.length }, overrideAccess: true })
      const rec = { id: doc.id, url: doc.url as string }
      mediaBySrc.set(srcUrl, rec)
      return rec
    } catch (e: any) {
      console.warn(`    media fail ${srcUrl}: ${e.message}`)
      mediaBySrc.set(srcUrl, null)
      return null
    }
  }

  // ---- categories ----
  const catId = new Map<string, any>()
  async function ensureCategory(title: string) {
    if (catId.has(title)) return catId.get(title)
    const q = await payload.find({ collection: 'categories', where: { title: { equals: title } }, limit: 1, overrideAccess: true })
    let id = q.docs[0]?.id
    if (!id && !DRY) id = (await payload.create({ collection: 'categories', data: { title }, overrideAccess: true })).id
    catId.set(title, id)
    return id
  }

  // ---- articles ----
  const articles: any[] = (await (await fetch(`${STRAPI}/api/articles?pagination%5BpageSize%5D=100&populate=*`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json())?.data || []
  console.log(`\nfetched ${articles.length} WeGov articles`)
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi
  let relabeled = 0, created = 0
  for (const a of articles) {
    if (ARTICLE_LIMIT && created + relabeled >= ARTICLE_LIMIT) break
    const x = a.attributes || a
    const slug: string = x.slug
    if (SKIP_SLUGS.has(slug)) continue
    try {
      const ex = await payload.find({ collection: 'posts', where: { slug: { equals: slug } }, limit: 1, draft: true, overrideAccess: true })
      if (ex.docs[0]) {
        if (!DRY) await payload.update({ collection: 'posts', id: ex.docs[0].id, data: { sites: [wegovId] }, overrideAccess: true, context: { disableRevalidate: true } })
        console.log(`  ↻ relabel ${slug} → wegovnyc (#${ex.docs[0].id})`)
        relabeled++
        continue
      }
      // fresh import
      const html: string = x.content || ''
      const srcMap = new Map<string, string>()
      const urlToId = new Map<string, any>()
      const urls = new Set<string>()
      let m: RegExpExecArray | null
      while ((m = imgRe.exec(html))) urls.add(m[1])
      for (const u of urls) {
        const doc = await rehost(u, x.title)
        if (doc) { srcMap.set(u, doc.url); urlToId.set(doc.url, doc.id) }
      }
      const lex = convertHTMLToLexical({ editorConfig, html: rewriteHtml(html, srcMap) || '<p></p>', JSDOM })
      const content = fixUploads(lex, urlToId)
      let heroImage: any = undefined
      if (x.image?.url) { const doc = await rehost(absHero(x.image.url), x.title); if (doc) heroImage = doc.id }
      const catTitle = CAT_MAP[x.category] || 'Updates'
      const category = await ensureCategory(catTitle)
      const when = x.originalPublishDate || x.publishedAt || x.createdAt
      const body: any = {
        title: x.title, slug, _status: 'published', sites: [wegovId],
        publishedAt: when ? new Date(when).toISOString() : undefined,
        content, categories: category ? [category] : [],
        ...(heroImage ? { heroImage, meta: { image: heroImage, ...(x.description ? { description: x.description } : {}) } } : x.description ? { meta: { description: x.description } } : {}),
      }
      if (!DRY) { const p = await payload.create({ collection: 'posts', data: body, overrideAccess: true, context: { disableRevalidate: true } }); console.log(`  ✓ create ${slug} → #${p.id} [${catTitle}]`) }
      else console.log(`  ✓ create ${slug} (dry)`)
      created++
    } catch (e: any) {
      console.warn(`  ✗ ${slug}: ${e.message}`)
    }
  }

  // ---- events ----
  const events: any[] = (await (await fetch(`${STRAPI}/api/events?pagination%5BpageSize%5D=100&populate=*`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json())?.data || []
  console.log(`\nfetched ${events.length} WeGov events`)
  let evUp = 0
  for (const e of events) {
    const x = e.attributes || e
    try {
      const data: any = {
        title: x.title, description: x.description || undefined, category: x.category || undefined,
        startDate: x.startDate || undefined, endDate: x.endDate || undefined, dateLabel: x.dateLabel || undefined,
        location: x.location || undefined, link: x.link || undefined, published: true, sites: [wegovId],
      }
      const ex = await payload.find({ collection: 'events', where: { title: { equals: x.title } }, limit: 1, overrideAccess: true })
      if (!DRY) {
        if (ex.docs[0]) await payload.update({ collection: 'events', id: ex.docs[0].id, data, overrideAccess: true })
        else await payload.create({ collection: 'events', data, overrideAccess: true })
      }
      console.log(`  ${ex.docs[0] ? '↻' : '✓'} event: ${x.title}`)
      evUp++
    } catch (e2: any) {
      console.warn(`  ✗ event ${x.title}: ${e2.message}`)
    }
  }

  // ---- backfill remaining site-less Posts/Pages → sarapis ----
  let backfilled = 0
  for (const coll of ['posts', 'pages'] as const) {
    const all = await payload.find({ collection: coll, limit: 1000, depth: 0, draft: true, overrideAccess: true })
    for (const d of all.docs as any[]) {
      const cur: any[] = Array.isArray(d.sites) ? d.sites : d.sites ? [d.sites] : []
      if (cur.length === 0) {
        if (!DRY) await payload.update({ collection: coll, id: d.id, data: { sites: [sarapisId] }, overrideAccess: true, context: { disableRevalidate: true } })
        backfilled++
      }
    }
  }

  console.log(`\n=== summary ===`)
  console.log(`sites: sarapis#${sarapisId}, wegovnyc#${wegovId}`)
  console.log(`articles: ${relabeled} relabeled → wegovnyc, ${created} created`)
  console.log(`events: ${evUp} upserted → wegovnyc`)
  console.log(`backfill: ${backfilled} site-less Posts/Pages → sarapis`)
  console.log(DRY ? '(DRY run — no writes)' : 'done')
  process.exit(0)
}

await main()
