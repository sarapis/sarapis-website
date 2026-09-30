import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { isPrivateAddress, safeFetch, guardedLookup } from '@/app/(frontend)/siteAssets'
import { siteKey } from '@/app/(frontend)/rd'

/**
 * The logo/wordmark routes fetch pages that third-party project sites choose (their HTML
 * names the logo URL, and they can redirect), so safeFetch is the boundary that keeps
 * those routes from being steered at the host's own network.
 */
describe('isPrivateAddress', () => {
  const blocked = [
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1',
    '0.0.0.0', '192.0.0.8', '192.0.2.1', '224.0.0.1', '198.18.0.1', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1',
    '::ffff:7f00:1', '::ffff:a9fe:a9fe', '64:ff9b::10.0.0.1', '[::1]', 'not-an-ip',
  ]
  const allowed = ['8.8.8.8', '192.0.77.2', /* WordPress' i0.wp.com CDN */ '172.15.0.1', '172.32.0.1', '100.63.0.1', '192.169.0.1', '2606:4700::1111', '::ffff:8.8.8.8']
  it.each(blocked)('blocks %s', (ip) => expect(isPrivateAddress(ip)).toBe(true))
  it.each(allowed)('allows %s', (ip) => expect(isPrivateAddress(ip)).toBe(false))
})

describe('safeFetch', () => {
  let server: http.Server
  let port: number
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/hop') return void res.writeHead(302, { location: `http://internal.test:${port}/secret` }).end()
      if (req.url === '/loop') return void res.writeHead(302, { location: '/loop' }).end()
      if (req.url === '/big') return void res.end('x'.repeat(5000))
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok')
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    port = (server.address() as AddressInfo).port
  })
  afterAll(() => new Promise<void>((r) => server.close(() => r())))

  // Stands in for DNS: "public.test" is treated as a public host that happens to point at
  // the test server; everything else goes through the real guard.
  const lookup = ((host: string, opts: any, cb: any) =>
    host === 'public.test'
      ? opts?.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4)
      : cb(Object.assign(new Error(`blocked address for ${host}`), { code: 'EBLOCKED' }))) as any
  const opts = () => ({ lookup, ports: [port] })

  it('fetches an allowed host', async () => {
    const res = await safeFetch(`http://public.test:${port}/`, opts())
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
    expect(res.url).toBe(`http://public.test:${port}/`)
  })
  it('re-checks every redirect hop, so a public page cannot bounce the fetch inward', async () => {
    await expect(safeFetch(`http://public.test:${port}/hop`, opts())).rejects.toThrow(/blocked/)
  })
  it('refuses a private IP literal without looking it up', async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/`, { ports: [port] })).rejects.toThrow(/blocked address/)
    await expect(safeFetch('http://[::1]/')).rejects.toThrow(/blocked address/)
  })
  it('refuses a hostname that resolves to a private address (real DNS)', async () => {
    await expect(safeFetch(`http://localhost:${port}/`, { ports: [port] })).rejects.toThrow(/blocked address/)
  })
  it('refuses non-web ports and protocols', async () => {
    await expect(safeFetch(`http://public.test:${port}/`, { lookup })).rejects.toThrow(/blocked port/)
    await expect(safeFetch('file:///etc/passwd')).rejects.toThrow(/blocked protocol/)
  })
  it('stops redirect loops and oversized bodies', async () => {
    await expect(safeFetch(`http://public.test:${port}/loop`, opts())).rejects.toThrow(/too many redirects/)
    await expect(safeFetch(`http://public.test:${port}/big`, { ...opts(), maxBytes: 1000 })).rejects.toThrow(/too large/)
  })
  it('guardedLookup blocks at connect time', async () => {
    await expect(new Promise((res, rej) => (guardedLookup as any)('localhost', {}, (e: any, a: any) => (e ? rej(e) : res(a))))).rejects.toThrow(/blocked/)
  })
})

describe('siteKey', () => {
  it('drops scheme, www. and trailing slash, keeps the path', () => {
    expect(siteKey('https://www.WeGov.nyc/')).toBe('wegov.nyc')
    expect(siteKey('wegov.nyc')).toBe('wegov.nyc')
    expect(siteKey('http://example.org/project/x/')).toBe('example.org/project/x')
  })
})
