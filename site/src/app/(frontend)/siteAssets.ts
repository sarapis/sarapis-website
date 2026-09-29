import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { siteKey } from './rd'

/**
 * Shared plumbing for the routes that fetch a project site's own assets
 * (/next/logo, /next/wordmark): a hardened server-side fetch, and the allowlist
 * of sites they may fetch — exactly the published projects' `site` values — so
 * they are never an open proxy.
 */

export const hostOfSite = (site: string): string | null => {
  try {
    return new URL(/^https?:\/\//.test(site) ? site : `https://${site}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

export const isPrivateHost = (h: string) =>
  h === 'localhost' || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/.test(h) || !h.includes('.')

export const fetchWithTimeout = (url: string, ms = 4000) =>
  fetch(url, { signal: AbortSignal.timeout(ms), redirect: 'follow', headers: { 'user-agent': 'SarapisIconFetcher/1.0 (+https://sarapis.org)' } })

/** Value of an HTML tag attribute (double-, single- or un-quoted), or undefined. */
export function tagAttr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(String.raw`\b${name}\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`, 'i'))
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined
}

/** Hosts, and normalised host/path keys, of the published projects' sites — the only ones the asset routes may fetch. */
export async function allowedSites(): Promise<{ hosts: Set<string>; keys: Set<string> }> {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({ collection: 'projects', where: { published: { equals: true } }, limit: 500, depth: 0, pagination: false })
  const hosts = new Set<string>()
  const keys = new Set<string>()
  for (const p of res.docs as any[]) {
    if (!p.site) continue
    const h = hostOfSite(p.site)
    const k = siteKey(p.site)
    if (h) hosts.add(h)
    if (k) keys.add(k)
  }
  return { hosts, keys }
}

