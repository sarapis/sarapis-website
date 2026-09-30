/** Small pure helpers shared by the redesigned (rd-*) home and project views. */

export const mediaUrl = (m: any): string | null => (m && typeof m === 'object' ? m.url || null : null)

export const siteHref = (site: string) => (/^https?:\/\//.test(site) ? site : `https://${site}`)
export const siteLabel = (site: string) => site.replace(/^https?:\/\//, '').replace(/\/$/, '')

/** Two-letter monogram: initials of the first two words, else the first two capitals, else the first two letters. */
export function monogram(name: string): string {
  const words = String(name || '').split(/[\s\-_/]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  const w = words[0] || '?'
  const caps = w.match(/[A-Z]/g)
  if (caps && caps.length >= 2) return caps.slice(0, 2).join('')
  return w.slice(0, 2).toUpperCase()
}

/** Stable 0..n-1 hash of a string, used to vary placeholder artwork per item. */
export function hashOf(s: string, n: number): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % n
}

export function ago(d?: string | Date | null, now = Date.now()): string {
  if (!d) return ''
  const s = Math.max(0, (now - new Date(d).getTime()) / 1000)
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`
  if (s < 86400) {
    const h = Math.round(s / 3600)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  const days = Math.round(s / 86400)
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  if (days < 700) return `${Math.round(days / 30)} months ago`
  return `${Math.round(days / 365)} years ago`
}

export const fmtDay = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
export const fmtFull = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
export const fmtMonthYear = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase() : ''

/** Activity dot colour by event kind: code = maroon, release = saffron, repo = green. */
export const EVENT_COLOR: Record<string, string> = {
  commit: 'var(--sds-primary)',
  pr: 'var(--sds-primary)',
  release: 'var(--sds-gold)',
  repo: '#3d7a5a',
}

export const repoShort = (full?: string | null) => (full ? full.split('/').pop() || full : '')
export const repoOrg = (full?: string | null) => (full ? full.split('/')[0] : '')

/** ISO timestamp `days` ago (kept out of components: react-hooks/purity flags Date.now in render). */
export const daysAgoISO = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

/** What a parent project calls its children (the "Children are called" field). Null/unknown → subprojects. */
export const CHILD_LABELS = {
  subprojects: { title: 'Subprojects', one: 'subproject', many: 'subprojects' },
  features: { title: 'Features', one: 'feature', many: 'features' },
  integrations: { title: 'Integrations', one: 'integration', many: 'integrations' },
} as const
export const childLabel = (p: any) => CHILD_LABELS[p?.childLabel as keyof typeof CHILD_LABELS] ?? CHILD_LABELS.subprojects

/**
 * How a site's header title looks on its own site, for the wordmark shown on a project
 * card while the site has no logo file. Keyed by siteKey(); anything not listed gets
 * the plain dark-on-white wordmark. Delete an entry once that project has a real logo.
 */
export type WordmarkStyle = { background: string; color?: string; gradient?: string; fontFamily: string; fontWeight: number; letterSpacing?: string; size: number }
export const WORDMARK_STYLES: Record<string, WordmarkStyle> = {
  // databook.nyc header: bold orange sans on navy
  'databook.nyc': { background: '#1d2e50', color: '#f59630', fontFamily: 'var(--sds-font-sans)', fontWeight: 800, letterSpacing: '.01em', size: 1 },
  // wegov.nyc header: DM Serif Display, blue-to-gold gradient text on navy
  'wegov.nyc': { background: '#1d2e50', gradient: 'linear-gradient(135deg, #7bb4e8, #d4a843)', fontFamily: 'var(--font-dm-serif), Georgia, serif', fontWeight: 400, letterSpacing: '-.5px', size: 1.25 },
}

/** Normalised "host/path" of a project's `site` (no scheme, no `www.`, no trailing slash) — the key the wordmark route takes. */
export function siteKey(site?: string | null): string | null {
  if (!site) return null
  try {
    const u = new URL(/^https?:\/\//.test(site) ? site : `https://${site}`)
    // `www.` is dropped so www.example.org and example.org share one key
    return (u.hostname.replace(/^www\./i, '') + u.pathname).toLowerCase().replace(/\/+$/, '')
  } catch {
    return null
  }
}
