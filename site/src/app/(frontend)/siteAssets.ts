import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import zlib from 'node:zlib'
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

/** Cheap string pre-filter for obviously internal hosts. NOT the security boundary: see safeFetch. */
export const isPrivateHost = (h: string) =>
  h === 'localhost' || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/.test(h) || !h.includes('.')

/**
 * True for an IP a server-side fetch must never reach: unspecified, loopback, private,
 * CGNAT, link-local, benchmark, multicast/reserved, IPv6 ULA and link-local, and the
 * IPv4-mapped / NAT64 forms of those. Anything that is not an IP counts as blocked.
 */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, '').toLowerCase()
  if (net.isIPv4(addr)) {
    const [a, b, c] = addr.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF + documentation; the rest of 192.0/16 is public (e.g. WordPress' CDN)
      (a === 198 && (b === 18 || b === 19))
    )
  }
  if (net.isIPv6(addr)) {
    const dotted = addr.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/)
    if (dotted) return isPrivateAddress(dotted[1])
    const hex = addr.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    if (hex) {
      const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16)
      return isPrivateAddress([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'))
    }
    return addr === '::' || addr === '::1' || /^f[cd]/.test(addr) || /^fe[89ab]/.test(addr) || /^ff/.test(addr) || addr.startsWith('2001:db8')
  }
  return true
}

type LookupFn = NonNullable<http.RequestOptions['lookup']>

/**
 * A DNS lookup that refuses to hand back a blocked address. Because it runs at CONNECT
 * time, the address checked is the address connected to, so DNS rebinding can't slip
 * a private IP in between a check and the request.
 */
export const guardedLookup: LookupFn = ((hostname: string, options: any, cb: any) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addrs: LookupAddress[]) => {
    if (err) return cb(err)
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) {
      return cb(Object.assign(new Error(`blocked address for ${hostname}`), { code: 'EBLOCKED' }))
    }
    if (options?.all) return cb(null, addrs)
    cb(null, addrs[0].address, addrs[0].family)
  })
}) as LookupFn

export type SafeFetchOptions = {
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  /** Test hooks: replace the DNS lookup, or widen the allowed ports. */
  lookup?: LookupFn
  ports?: number[]
}

/**
 * GET a public URL from the server, safely: http(s) only, ports 80/443 only, every hop's
 * address checked by guardedLookup (IP literals checked directly), redirects followed by
 * hand (max 3) so each one is re-checked, a hard timeout, and a body cap. Returns a
 * standard Response whose `url` is the final URL, or throws.
 *
 * The routes it serves fetch pages chosen by third-party project sites, so this is the
 * boundary that keeps them from being steered at the host's own network.
 */
export async function safeFetch(input: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 4000, maxBytes = 1_500_000, maxRedirects = 3, lookup = guardedLookup, ports = [80, 443] } = opts
  const deadline = Date.now() + timeoutMs
  let url = new URL(input)
  for (let hop = 0; ; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`blocked protocol ${url.protocol}`)
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
    if (!ports.includes(port)) throw new Error(`blocked port ${port}`)
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (net.isIP(host) && isPrivateAddress(host)) throw new Error(`blocked address ${host}`)

    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = (url.protocol === 'https:' ? https : http).request(
        url,
        {
          method: 'GET',
          lookup,
          headers: { 'user-agent': 'SarapisIconFetcher/1.0 (+https://sarapis.org)', accept: '*/*', 'accept-encoding': 'gzip, deflate, br' },
          timeout: Math.max(1, deadline - Date.now()),
        },
        resolve,
      )
      req.on('timeout', () => req.destroy(new Error('timeout')))
      req.on('error', reject)
      req.end()
    })

    const status = res.statusCode || 0
    const location = res.headers.location
    if (status >= 300 && status < 400 && location) {
      res.resume()
      if (hop >= maxRedirects) throw new Error('too many redirects')
      url = new URL(location, url)
      continue
    }

    const chunks: Buffer[] = []
    let size = 0
    const remaining = Math.max(1, deadline - Date.now())
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => res.destroy(new Error('timeout')), remaining)
      res.on('data', (c: Buffer) => {
        size += c.length
        if (size > maxBytes) res.destroy(new Error('response too large'))
        else chunks.push(c)
      })
      res.on('end', () => (clearTimeout(timer), resolve()))
      res.on('error', (e) => (clearTimeout(timer), reject(e)))
      res.on('close', () => (clearTimeout(timer), res.complete ? resolve() : reject(new Error('connection closed'))))
    })
    let body: Buffer = Buffer.concat(chunks)
    const enc = String(res.headers['content-encoding'] || '').toLowerCase()
    const cap = { maxOutputLength: maxBytes }
    if (enc === 'gzip' || enc === 'x-gzip') body = zlib.gunzipSync(body, cap)
    else if (enc === 'deflate') body = zlib.inflateSync(body, cap)
    else if (enc === 'br') body = zlib.brotliDecompressSync(body, cap)

    const headers = new Headers()
    for (const [k, v] of Object.entries(res.headers)) {
      if (v == null || k === 'content-encoding' || k === 'content-length') continue
      for (const one of Array.isArray(v) ? v : [v]) headers.append(k, one)
    }
    const out = new Response(status === 204 || status === 304 ? null : new Uint8Array(body), { status: status || 502, headers })
    Object.defineProperty(out, 'url', { value: url.toString() })
    return out
  }
}

/** Value of an HTML tag attribute (double-, single- or un-quoted), or undefined. */
export function tagAttr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(String.raw`\b${name}\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`, 'i'))
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined
}

const ALLOWED_TTL_MS = 60_000
let allowedCache: { at: number; value: Promise<{ hosts: Set<string>; keys: Set<string> }> } | null = null

/**
 * Hosts, and normalised host/path keys, of the published projects' sites — the only ones
 * the asset routes may fetch. Memoised for a minute, so a stream of requests for unlisted
 * sites costs one query a minute rather than one each.
 */
export function allowedSites(): Promise<{ hosts: Set<string>; keys: Set<string> }> {
  if (allowedCache && Date.now() - allowedCache.at < ALLOWED_TTL_MS) return allowedCache.value
  const value = loadAllowedSites()
  allowedCache = { at: Date.now(), value }
  value.catch(() => (allowedCache = null)) // don't cache a failed query
  return value
}

async function loadAllowedSites(): Promise<{ hosts: Set<string>; keys: Set<string> }> {
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
