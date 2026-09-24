/**
 * Import sarapis.org WordPress content (pre-extracted JSON) into Payload.
 * Run: pnpm payload run scripts/import-wp.ts
 *
 * Reads ../migration/out/{pages,posts,attachments,manifest}.json
 * Idempotent-ish: deletes prior imported docs (matched by slug) before re-creating.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { JSDOM } from 'jsdom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../../migration/out')
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))

type Rec = {
  wpId: string; title: string; slug: string; parentId: string; date: string
  content: string; excerpt: string; thumbId: string; categories: string[]
}

const SITE = 'https://sarapis.org'

async function main() {
  const payload = await getPayload({ config })
  const pages: Rec[] = read('pages.json')
  const posts: Rec[] = read('posts.json')
  const attachments: Record<string, { id: string; url: string; title: string; filename: string }> =
    read('attachments.json')

  const editorConfig = await editorConfigFactory.default({ config: payload.config })

  // ---------- media ----------
  // Map original WP url (no query, size-suffix stripped) -> created media doc
  const mediaByUrl = new Map<string, any>()
  const stripSize = (u: string) => u.split('?')[0].replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '')

  async function importMedia(rawUrl: string, alt: string): Promise<any | null> {
    const key = stripSize(rawUrl)
    if (mediaByUrl.has(key)) return mediaByUrl.get(key)
    try {
      const res = await fetch(rawUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const name = path.basename(new URL(rawUrl).pathname)
      const mimetype = res.headers.get('content-type')?.split(';')[0] || 'application/octet-stream'
      const doc = await payload.create({
        collection: 'media',
        data: { alt: alt || name },
        file: { data: buf, mimetype, name, size: buf.length },
      })
      mediaByUrl.set(key, doc)
      return doc
    } catch (e: any) {
      console.warn(`  media fail ${rawUrl}: ${e.message}`)
      mediaByUrl.set(key, null)
      return null
    }
  }

  // ---------- html helpers ----------
  // Rewrite internal links and image srcs, return cleaned html.
  function rewriteHtml(html: string, mediaMap: Map<string, string>): string {
    let h = html
    // images -> new media url
    for (const [orig, neu] of mediaMap) {
      h = h.split(orig).join(neu)
    }
    // internal post/page links sarapis.org/slug/ -> relative
    h = h.replace(new RegExp(`${SITE}/`, 'g'), '/')
    // unwrap anchors with empty / "#" / missing href (Lexical link nodes require a URL)
    h = h.replace(/<a[^>]*href=["']\s*#?\s*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1')
    h = h.replace(/<a(?![^>]*\shref=)[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    // strip leftover WordPress plugin shortcodes e.g. [pt_view id="..."], [caption], [/vc_row]
    h = h.replace(/\[\/?[a-z][a-z0-9_]*(?:[^\]]*)\]/gi, '')
    return h
  }

  function toLexical(html: string) {
    return convertHTMLToLexical({ editorConfig, html: html || '<p></p>', JSDOM })
  }

  // convertHTMLToLexical turns <img> into "pending" upload nodes (no media ref).
  // Resolve them to proper { relationTo, value } upload nodes, or drop unresolved ones.
  function fixUploads(node: any, urlToId: Map<string, any>): any | null {
    if (!node || typeof node !== 'object') return node
    if (node.type === 'upload') {
      const src: string | undefined = node.pending?.src || node.src
      const id = src ? urlToId.get(src) : undefined
      if (!id) return null
      return { type: 'upload', relationTo: 'media', value: id, fields: null, format: '', version: 3 }
    }
    if (Array.isArray(node.children)) {
      node.children = node.children.map((c: any) => fixUploads(c, urlToId)).filter(Boolean)
    }
    if (node.root) node.root = fixUploads(node.root, urlToId)
    return node
  }

  // Pre-upload all referenced media per record, build src(url)->mediaId map
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi
  async function processContent(rec: Rec) {
    const map = new Map<string, string>()
    const urlToId = new Map<string, any>()
    let m: RegExpExecArray | null
    const urls = new Set<string>()
    while ((m = imgRe.exec(rec.content))) urls.add(m[1])
    for (const u of urls) {
      const doc = await importMedia(u, rec.title)
      if (doc?.url) {
        map.set(u, doc.url)
        urlToId.set(doc.url, doc.id)
      }
    }
    const lex = toLexical(rewriteHtml(rec.content, map))
    return fixUploads(lex, urlToId)
  }

  // ---------- wipe previously imported ----------
  for (const coll of ['redirects', 'posts', 'pages', 'media'] as const) {
    const existing = await payload.find({ collection: coll, limit: 1000, depth: 0 })
    for (const d of existing.docs) {
      await payload.delete({ collection: coll, id: (d as any).id, context: { disableRevalidate: true } })
    }
  }

  // ---------- categories ----------
  const catNames = [...new Set(posts.flatMap((p) => p.categories))].filter(Boolean)
  const catId = new Map<string, number | string>()
  for (const name of catNames) {
    const found = await payload.find({ collection: 'categories', where: { title: { equals: name } }, limit: 1 })
    const doc = found.docs[0] ?? (await payload.create({ collection: 'categories', data: { title: name } }))
    catId.set(name, (doc as any).id)
  }
  console.log(`categories: ${catId.size}`)

  // ---------- posts ----------
  const postIdByWp = new Map<string, any>()
  let pOk = 0
  for (const rec of posts) {
    try {
      const content = await processContent(rec)
      let heroImage: any = undefined
      if (rec.thumbId && attachments[rec.thumbId]?.url) {
        const doc = await importMedia(attachments[rec.thumbId].url, rec.title)
        if (doc) heroImage = doc.id
      }
      const doc = await payload.create({
        collection: 'posts',
        data: {
          title: rec.title,
          slug: rec.slug,
          _status: 'published',
          publishedAt: rec.date ? new Date(rec.date + 'Z').toISOString() : undefined,
          content: content as any,
          heroImage,
          ...(heroImage ? { meta: { image: heroImage } } : {}),
          categories: rec.categories.map((c) => catId.get(c)).filter(Boolean) as any,
        } as any,
        context: { disableRevalidate: true },
      })
      postIdByWp.set(rec.wpId, doc)
      pOk++
    } catch (e: any) {
      console.warn(`post fail ${rec.slug}: ${e.message}`)
    }
  }
  console.log(`posts: ${pOk}/${posts.length}`)

  // ---------- pages (parents first) ----------
  const byWp = new Map(pages.map((p) => [p.wpId, p]))
  const ordered: Rec[] = []
  const seen = new Set<string>()
  const visit = (r: Rec) => {
    if (seen.has(r.wpId)) return
    const parent = byWp.get(r.parentId)
    if (parent) visit(parent)
    seen.add(r.wpId)
    ordered.push(r)
  }
  pages.forEach(visit)

  const pageIdByWp = new Map<string, any>()
  let pgOk = 0
  for (const rec of ordered) {
    try {
      const content = await processContent(rec)
      const parentDoc = pageIdByWp.get(rec.parentId)
      const doc = await payload.create({
        collection: 'pages',
        data: {
          title: rec.title,
          slug: rec.slug,
          _status: 'published',
          publishedAt: rec.date ? new Date(rec.date + 'Z').toISOString() : undefined,
          ...(parentDoc ? { parent: parentDoc.id } : {}),
          layout: [
            {
              blockType: 'content',
              columns: [{ size: 'full', richText: content as any }],
            },
          ],
        } as any,
        context: { disableRevalidate: true },
      })
      pageIdByWp.set(rec.wpId, doc)
      pgOk++
    } catch (e: any) {
      console.warn(`page fail ${rec.slug}: ${e.message}`)
    }
  }
  console.log(`pages: ${pgOk}/${pages.length}`)

  // ---------- redirects (old WP url -> new payload path) ----------
  let rOk = 0
  const addRedirect = async (from: string, toDoc: any, kind: 'posts' | 'pages') => {
    try {
      await payload.create({
        collection: 'redirects',
        data: { from, to: { type: 'reference', reference: { relationTo: kind, value: toDoc.id } } } as any,
        context: { disableRevalidate: true },
      })
      rOk++
    } catch {}
  }
  for (const [wpId, doc] of postIdByWp) {
    const rec = posts.find((p) => p.wpId === wpId)!
    await addRedirect(`/${rec.slug}`, doc, 'posts')
  }
  console.log(`redirects: ${rOk}`)

  console.log(`\nmedia imported: ${[...mediaByUrl.values()].filter(Boolean).length}`)
  console.log('DONE')
  process.exit(0)
}

try { await main() } catch (e) { console.error(e); process.exit(1) }
