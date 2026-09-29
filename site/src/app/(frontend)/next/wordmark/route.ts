import { allowedSites, fetchWithTimeout, isPrivateHost } from '../../siteAssets'

/**
 * GET /next/wordmark?u=<host/path of a project's site> — the text of the site's
 * header title (its brand link: "WeGovNYC", "DATABOOK.NYC", "UN+NYC"), as JSON
 * `{ text }`. The project cards show it in place of a logo image for sites that
 * have no logo file yet. Read from the page's own markup, cached, and served only
 * for sites that are a published project's `site`.
 */

const OK_TTL = 24 * 3600 * 1000
const MISS_TTL = 3600 * 1000
type Entry = { at: number; text: string | null }
const cache = new Map<string, Entry>()

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&plus;': '+' }
const decode = (s: string) =>
  s
    .replace(/&(amp|lt|gt|quot|nbsp|plus|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))

/** Text of the first link in the page whose class marks it as the brand/logo and that holds text, not an image. */
function brandText(html: string): string | null {
  const head = html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '')
  for (const m of head.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (!/\bclass\s*=\s*["'][^"']*(logo|brand)/i.test(m[1])) continue
    if (/<img\b|<svg\b/i.test(m[2])) continue
    // join the pieces of a split wordmark (<span>UN</span><span>+</span><span>NYC</span>) with no spaces
    const text = decode(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    if (text.length >= 2 && text.length <= 30) return text
  }
  return null
}

async function findText(key: string): Promise<Entry> {
  try {
    const res = await fetchWithTimeout(`https://${key}`)
    if (res.ok && (res.headers.get('content-type') || '').includes('html')) {
      return { at: Date.now(), text: brandText((await res.text()).slice(0, 300_000)) }
    }
  } catch {
    /* unreachable site */
  }
  return { at: Date.now(), text: null }
}

export async function GET(req: Request) {
  const key = (new URL(req.url).searchParams.get('u') || '').toLowerCase().trim().replace(/\/+$/, '')
  if (!key || isPrivateHost(key.split('/')[0])) return Response.json({ text: null }, { status: 404 })

  const hit = cache.get(key)
  let entry = hit && Date.now() - hit.at < (hit.text ? OK_TTL : MISS_TTL) ? hit : undefined
  if (!entry) {
    if (!(await allowedSites()).keys.has(key)) return Response.json({ text: null }, { status: 404 })
    entry = await findText(key)
    cache.set(key, entry)
  }
  return Response.json({ text: entry.text }, { headers: { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' } })
}
