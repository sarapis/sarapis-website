import { createHash } from 'node:crypto'
import { allowedSites, isPrivateHost, safeFetch, tagAttr } from '../../siteAssets'

/**
 * GET /next/logo?u=<host/path of a project's site> — the project site's own logo, for the
 * project cards and tiles. Looks in the site's page for its header logo (WordPress'
 * `custom-logo`, or an image inside a home/brand link), then falls back to its icons
 * (apple-touch-icon, the largest <link rel=icon>, /favicon.ico). The chosen image is
 * fetched server-side and served with a long cache — so visitors' browsers never
 * contact the project sites or a third party, and a site with no logo is a clean 404
 * the card falls back from (to the monogram). Redirects are followed (a project
 * page can live on another domain), and icons are read from the page it lands on.
 *
 * Only sites that appear as a published project's `site` are served, so this is not
 * an open proxy.
 */

const OK_TTL = 24 * 3600 * 1000
const MISS_TTL = 3600 * 1000
const MAX_BYTES = 1_000_000
/** Prefer a logo image at least this wide (from srcset) — big enough for a card, small enough to be light. */
const WANT_WIDTH = 600
/**
 * SHA-256 of icons that are a hosting platform's placeholder, not the project's logo
 * (a site that never set its own favicon serves it). Treated as "no icon" so the card
 * shows the monogram. Add to this list when another default turns up.
 */
const PLACEHOLDER_ICONS = new Set([
  '2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932', // Vercel's default favicon (black triangle)
])
type Entry = { at: number; hit: boolean; body?: ArrayBuffer; type?: string }
const cache = new Map<string, Entry>()

/** The URL to use for an <img>: the smallest srcset candidate that is WANT_WIDTH wide, else the widest, else src. */
function imgUrl(tag: string): string | undefined {
  const src = tagAttr(tag, 'src')
  const srcset = tagAttr(tag, 'srcset')
  if (srcset) {
    const opts = srcset
      .split(',')
      .map((p) => p.trim().split(/\s+/))
      .map(([url, w]) => ({ url, w: Number((w || '').replace('w', '')) || 0 }))
      .filter((o) => o.url)
    const big = opts.filter((o) => o.w >= WANT_WIDTH).sort((a, b) => a.w - b.w)[0]
    const widest = [...opts].sort((a, b) => b.w - a.w)[0]
    if (big || widest) return (big || widest).url.replace(/&amp;/g, '&')
  }
  return src?.replace(/&amp;/g, '&')
}

/** The site's own header logo, if its markup declares one. Deliberately strict: partner/sponsor logos also have "logo" in their names. */
function logoCandidates(html: string, base: string): string[] {
  const tags: string[] = []
  // 1. an <img> whose class marks it as the site logo (WordPress: custom-logo)
  for (const img of html.match(/<img\b[^>]*>/gi) || []) {
    if (/(^|[\s_-])(custom-logo|site-logo|navbar-logo|header-logo|brand-logo)([\s_-]|$)/i.test(tagAttr(img, 'class') ?? '')) tags.push(img)
  }
  // 2. the first <img> inside a link that points home or is styled as the brand
  for (const m of html.matchAll(/<a\b([^>]*)>\s*(?:<(?!img)[^>]*>\s*){0,2}(<img\b[^>]*>)/gi)) {
    const a = m[1]
    if (/\brel\s*=\s*["']?home/i.test(a) || /\bclass\s*=\s*["'][^"']*(logo|brand)/i.test(a)) tags.push(m[2])
  }
  const urls: string[] = []
  for (const t of tags) {
    const u = imgUrl(t)
    if (!u) continue
    try {
      urls.push(new URL(u, base).toString())
    } catch {
      /* ignore bad url */
    }
  }
  return [...new Set(urls)]
}

/** Candidate icon URLs from a page's HTML, best first. */
function iconCandidates(html: string, base: string): string[] {
  const found: { url: string; score: number }[] = []
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = (tagAttr(tag, 'rel') ?? '').toLowerCase()
    const href = tagAttr(tag, 'href')
    if (!href || !/(^|\s)(apple-touch-icon(-precomposed)?|icon|shortcut)(\s|$)/.test(rel)) continue
    const sizes = (tagAttr(tag, 'sizes') ?? '').match(/(\d+)x\d+/)
    const px = sizes ? Number(sizes[1]) : 0
    let score = px
    if (rel.includes('apple-touch-icon')) score += 1000
    else if (/\.svg(\?|$)/i.test(href)) score += 500
    try {
      found.push({ url: new URL(href, base).toString(), score })
    } catch {
      /* ignore bad href */
    }
  }
  found.sort((a, b) => b.score - a.score)
  const urls = found.map((f) => f.url)
  urls.push(new URL('/favicon.ico', base).toString())
  return [...new Set(urls)]
}

/**
 * A favicon SVG usually declares a tiny size (width="32"), but it is vector art. Give its
 * root element a large declared size (keeping the viewBox proportions) so the card treats
 * it as the sharp, scalable logo it is instead of a 32px raster.
 */
function scaleSvg(body: ArrayBuffer): ArrayBuffer {
  const text = new TextDecoder().decode(body)
  const root = text.match(/<svg\b[^>]*>/i)?.[0]
  const vb = root && tagAttr(root, 'viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (!root || !vb || vb.length !== 4 || !(vb[2] > 0) || !(vb[3] > 0)) return body
  const w = 512
  const h = Math.round((512 * vb[3]) / vb[2])
  const stripped = root.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  const scaled = stripped.replace(/^<svg\b/i, `<svg width="${w}" height="${h}"`)
  return new TextEncoder().encode(text.replace(root, scaled)).buffer as ArrayBuffer
}

async function findLogo(key: string): Promise<Entry> {
  const base = `https://${key}`
  let candidates = [new URL('/favicon.ico', base).toString()]
  try {
    const res = await safeFetch(base)
    if (res.ok && (res.headers.get('content-type') || '').includes('html')) {
      const html = (await res.text()).slice(0, 300_000)
      const at = res.url || base
      candidates = [...new Set([...logoCandidates(html, at), ...iconCandidates(html, at)])]
    }
  } catch {
    /* fall through to /favicon.ico */
  }
  for (const url of candidates.slice(0, 6)) {
    try {
      const u = new URL(url)
      if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) continue
      const r = await safeFetch(url, { timeoutMs: 6000, maxBytes: MAX_BYTES })
      const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      if (!r.ok || !/^image\/(png|jpeg|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon|avif)$/.test(type)) continue
      const body = await r.arrayBuffer()
      if (PLACEHOLDER_ICONS.has(createHash('sha256').update(Buffer.from(body)).digest('hex'))) continue
      if (body.byteLength > 0 && body.byteLength <= MAX_BYTES) {
        return { at: Date.now(), hit: true, body: type === 'image/svg+xml' ? scaleSvg(body) : body, type }
      }
    } catch {
      /* try the next candidate */
    }
  }
  return { at: Date.now(), hit: false }
}

export async function GET(req: Request) {
  const key = (new URL(req.url).searchParams.get('u') || '').toLowerCase().trim().replace(/\/+$/, '')
  if (!key || isPrivateHost(key.split('/')[0])) return new Response(null, { status: 404 })

  const hit = cache.get(key)
  let entry = hit && Date.now() - hit.at < (hit.hit ? OK_TTL : MISS_TTL) ? hit : undefined

  if (!entry) {
    if (!(await allowedSites()).keys.has(key)) return new Response(null, { status: 404 })
    entry = await findLogo(key)
    cache.set(key, entry)
  }

  if (!entry.hit || !entry.body) {
    return new Response(null, { status: 404, headers: { 'cache-control': 'public, max-age=3600' } })
  }
  return new Response(entry.body, {
    headers: {
      'content-type': entry.type!,
      'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
      'x-content-type-options': 'nosniff',
    },
  })
}
