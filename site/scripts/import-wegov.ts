/**
 * Import wegov.nyc blog articles (Strapi source) into the Sarapis Posts collection
 * ON THE BOX (next.sarapis.org) via REST — converts HTML→Lexical locally using the
 * same feature set as the Posts content editor, rehosts every image to Sarapis media.
 *
 * Run: pnpm payload run scripts/import-wegov.ts
 * Box admin creds are read from ~/.sarapis-kb.json ({ url, email, password }).
 *
 * Idempotent: skips any article whose slug already exists as a post on the box.
 * Decisions (2026-07-13): publish live · create Databook/Events categories
 * (UNNY→Open Government) · skip the near-duplicate · include the UN guide.
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
import fs from 'fs'
import os from 'os'
import path from 'path'

const STRAPI = 'https://strapi.wegov.nyc'
const SKIP_SLUGS = new Set(['wegovnycs-databook-featured-in-local-news-story']) // near-dup of an existing Sarapis post
// WeGov category → Sarapis category title
const CAT_MAP: Record<string, string> = { Databook: 'Databook', Events: 'Events', UNNY: 'Open Government' }

function creds() {
  const p = path.join(os.homedir(), '.sarapis-kb.json')
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  return { base: (j.url || 'https://next.sarapis.org').replace(/\/$/, ''), email: j.email, password: j.password }
}

async function main() {
  const payload = await getPayload({ config })
  const { base, email, password } = creds()
  const API = `${base}/api`

  // Editor config that matches the box Posts content field (so nodes are editable in admin).
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

  // ---- box auth ----
  const login = await fetch(`${API}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const loginJson = await login.json()
  if (!login.ok || !loginJson.token) throw new Error(`login failed: ${login.status}`)
  const token = loginJson.token
  const auth = { Authorization: `JWT ${token}` }
  console.log(`logged in to ${base} as ${email}`)

  // ---- ensure categories ----
  const catId = new Map<string, any>()
  async function ensureCategory(title: string) {
    if (catId.has(title)) return catId.get(title)
    const q = await fetch(`${API}/categories?where[title][equals]=${encodeURIComponent(title)}&limit=1`, { headers: auth })
    const found = (await q.json())?.docs?.[0]
    let id = found?.id
    if (!id) {
      const c = await fetch(`${API}/categories`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
      id = (await c.json())?.doc?.id
      console.log(`  created category "${title}" (#${id})`)
    }
    catId.set(title, id)
    return id
  }

  // ---- media rehost (source url -> { id, url }) ----
  const mediaBySrc = new Map<string, { id: any; url: string } | null>()
  async function rehost(srcUrl: string, alt: string) {
    if (mediaBySrc.has(srcUrl)) return mediaBySrc.get(srcUrl)
    try {
      const res = await fetch(srcUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const mime = res.headers.get('content-type')?.split(';')[0] || 'image/png'
      const name = decodeURIComponent(path.basename(new URL(srcUrl).pathname)) || 'image.png'
      const form = new FormData()
      form.append('file', new Blob([buf], { type: mime }), name)
      form.append('_payload', JSON.stringify({ alt: alt || name }))
      const up = await fetch(`${API}/media`, { method: 'POST', headers: auth, body: form })
      const doc = (await up.json())?.doc
      if (!up.ok || !doc?.id) throw new Error(`media POST ${up.status}`)
      const rec = { id: doc.id, url: doc.url as string }
      mediaBySrc.set(srcUrl, rec)
      return rec
    } catch (e: any) {
      console.warn(`    media fail ${srcUrl}: ${e.message}`)
      mediaBySrc.set(srcUrl, null)
      return null
    }
  }

  // ---- html helpers ----
  const absHero = (u: string) => (/^https?:\/\//.test(u) ? u : STRAPI + u)
  function rewriteHtml(html: string, map: Map<string, string>) {
    let h = html
    for (const [orig, neu] of map) h = h.split(orig).join(neu)
    // unwrap empty / hash anchors (Lexical link nodes require a URL)
    h = h.replace(/<a[^>]*href=["']\s*#?\s*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1')
    h = h.replace(/<a(?![^>]*\shref=)[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    // strip WP block comments + leftover shortcodes
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

  // ---- fetch source ----
  const artRes = await fetch(`${STRAPI}/api/articles?pagination%5BpageSize%5D=100&populate=*`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const articles: any[] = (await artRes.json())?.data || []
  console.log(`fetched ${articles.length} articles from Strapi`)

  // existing box post slugs (incl. drafts)
  const existRes = await fetch(`${API}/posts?depth=0&limit=500&draft=true`, { headers: auth })
  const existingSlugs = new Set(((await existRes.json())?.docs || []).map((p: any) => p.slug))

  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi
  let ok = 0
  const skipped: string[] = []
  const tableWarn: string[] = []
  // Test knobs: WEGOV_LIMIT caps # imported; WEGOV_DRAFT=1 imports as draft; WEGOV_ONLY=slug picks one.
  const LIMIT = Number(process.env.WEGOV_LIMIT || 0)
  const DRAFT = process.env.WEGOV_DRAFT === '1'
  const ONLY = process.env.WEGOV_ONLY || ''

  for (const a of articles) {
    if (LIMIT && ok >= LIMIT) break
    const x = a.attributes || a
    const slug: string = x.slug
    if (ONLY && slug !== ONLY) continue
    if (SKIP_SLUGS.has(slug)) { skipped.push(`${slug} (duplicate)`); continue }
    if (existingSlugs.has(slug)) { skipped.push(`${slug} (already on box)`); continue }

    try {
      const html: string = x.content || ''
      if (/<table[\s>]/i.test(html)) tableWarn.push(slug)

      // rehost inline body images
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

      // hero image
      let heroImage: any = undefined
      if (x.image?.url) {
        const doc = await rehost(absHero(x.image.url), x.title)
        if (doc) heroImage = doc.id
      }

      const catTitle = CAT_MAP[x.category] || 'Updates'
      const category = await ensureCategory(catTitle)
      const when = x.originalPublishDate || x.publishedAt || x.createdAt

      const body: any = {
        title: x.title,
        slug,
        _status: DRAFT ? 'draft' : 'published',
        publishedAt: when ? new Date(when).toISOString() : undefined,
        content,
        categories: category ? [category] : [],
        ...(heroImage ? { heroImage, meta: { image: heroImage, ...(x.description ? { description: x.description } : {}) } } : x.description ? { meta: { description: x.description } } : {}),
      }
      const post = await fetch(`${API}/posts`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const pj = await post.json()
      if (!post.ok || !pj?.doc?.id) throw new Error(`post POST ${post.status}: ${JSON.stringify(pj).slice(0, 200)}`)
      console.log(`  ✓ ${slug} → #${pj.doc.id} [${catTitle}]${heroImage ? ' +hero' : ''}${urls.size ? ` +${urls.size}img` : ''}`)
      ok++
    } catch (e: any) {
      console.warn(`  ✗ ${slug}: ${e.message}`)
    }
  }

  console.log(`\nimported ${ok} posts. skipped ${skipped.length}: ${skipped.join(', ')}`)
  if (tableWarn.length) console.log(`⚠ contained tables (flattened — review in /admin): ${tableWarn.join(', ')}`)
  process.exit(0)
}

await main()
