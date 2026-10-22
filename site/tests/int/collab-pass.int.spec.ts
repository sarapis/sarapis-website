import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  collabPassStartEndpoint,
  collabRedirect,
  collabSecret,
  signCollabTicket,
  COLLAB_TICKET_KIND,
  COLLAB_TICKET_TTL_S,
} from '@/endpoints/collab-pass'
import * as template from '../helpers/collabTemplateVerify.js'

// A verbatim copy of collab-template's verifier (plain JS, so its options are typed here).
type Verify = (token: string, secret: string, o: { host: string; state: string; now?: number }) => Promise<{ email: string; expires: number } | null>
const verifyTicket = template.verifyTicket as unknown as Verify
const { MAX_TTL_S } = template

// Ported from the Field Guide CMS's test-collab-pass.ts. VECTOR is also asserted by
// sarapis/collab-template worker/test/cms.test.js, which holds the verifying half: if
// either side changes the format, one of the two tests goes red.
const S = 'c'.repeat(40)
const VECTOR =
  'v1.eyJrIjoiY29sbGFiLWlkZW50aXR5IiwibSI6IlBlcnNvbkBFeGFtcGxlLm9yZyIsImgiOiJjb2xsYWIuZXhhbXBsZS5vcmciLCJzIjoic3RhdGUtMTIzIiwiZSI6MjAwMDAwMDAwMH0.8loC7HOh6eCnD_J2jBOoHsfc0pyTAvUtzQ_3qCt-pMo'

const env = { COLLAB_PASS_SECRET: S, COLLAB_PASS_HOSTS: 'collab.example.org, other.example.org' }
const ok = { host: 'collab.example.org', state: 'a'.repeat(32), email: 'person@example.org', now: 1000 }
const ticketOf = (to: string) => decodeURIComponent(to.split('ticket=')[1])

describe('collab-pass ticket', () => {
  it('mints the exact bytes of the shared vector', () => {
    expect(
      signCollabTicket({ k: COLLAB_TICKET_KIND, m: 'Person@Example.org', h: 'collab.example.org', s: 'state-123', e: 2000000000 }, S),
    ).toBe(VECTOR)
  })

  it("round-trips through collab-template's verifyTicket", async () => {
    const to = collabRedirect({ ...ok, email: 'Person@Example.org' }, env)!
    const t = ticketOf(to)
    const v = (o: object) => verifyTicket(t, S, { host: 'collab.example.org', state: ok.state, now: ok.now + 1, ...o })
    expect(await v({})).toMatchObject({ email: 'person@example.org', expires: ok.now + COLLAB_TICKET_TTL_S })
    expect(await v({ host: 'other.example.org' })).toBeNull()
    expect(await v({ state: 'b'.repeat(32) })).toBeNull()
    expect(await v({ now: ok.now + COLLAB_TICKET_TTL_S })).toBeNull()
    expect(await verifyTicket(t, 'd'.repeat(40), { host: 'collab.example.org', state: ok.state, now: ok.now + 1 })).toBeNull()
  })

  it('redirects a listed host to its callback, naming the email, host, state and two minutes', () => {
    const to = collabRedirect(ok, env)!
    expect(to.startsWith('https://collab.example.org/auth/cms/callback?ticket=v1.')).toBe(true)
    const claims = JSON.parse(Buffer.from(ticketOf(to).split('.')[1], 'base64url').toString())
    expect(claims).toEqual({ k: COLLAB_TICKET_KIND, m: 'person@example.org', h: 'collab.example.org', s: 'a'.repeat(32), e: 1000 + COLLAB_TICKET_TTL_S })
    expect(COLLAB_TICKET_TTL_S).toBeLessThanOrEqual(MAX_TTL_S)
  })

  it('mints nothing for an unlisted host, a missing list, a short secret, a bad state or no email', () => {
    expect(collabRedirect({ ...ok, host: 'evil.example' }, env)).toBeNull()
    expect(collabRedirect(ok, { COLLAB_PASS_SECRET: S })).toBeNull()
    expect(collabRedirect(ok, { ...env, COLLAB_PASS_SECRET: 'x'.repeat(31) })).toBeNull()
    expect(collabSecret({ COLLAB_PASS_SECRET: 'x'.repeat(31) })).toBe('')
    expect(collabRedirect({ ...ok, state: '' }, env)).toBeNull()
    expect(collabRedirect({ ...ok, state: 'a"><script>' + 'a'.repeat(20) }, env)).toBeNull()
    expect(collabRedirect({ ...ok, email: '' }, env)).toBeNull()
  })
})

describe('GET /api/collab-pass/start', () => {
  const saved = { secret: process.env.COLLAB_PASS_SECRET, hosts: process.env.COLLAB_PASS_HOSTS }
  const restore = (k: string, v: string | undefined) => (v === undefined ? delete process.env[k] : (process.env[k] = v))
  beforeEach(() => {
    process.env.COLLAB_PASS_SECRET = S
    process.env.COLLAB_PASS_HOSTS = 'comms-strat.sarapis.org'
  })
  afterEach(() => {
    restore('COLLAB_PASS_SECRET', saved.secret)
    restore('COLLAB_PASS_HOSTS', saved.hosts)
  })

  const state = 'x'.repeat(24)
  const call = (host: string, user?: { email: string; collabPass?: boolean }) =>
    collabPassStartEndpoint.handler({
      url: `https://next.sarapis.org/api/collab-pass/start?host=${host}&state=${state}`,
      user,
      payload: { logger: { info: () => {}, error: () => {} }, config: { routes: { admin: '/admin' } } },
    } as never) as Promise<Response>

  it('sends a signed-in user back to the collab site with a ticket its verifier accepts', async () => {
    const res = await call('comms-strat.sarapis.org', { email: 'someone@sarapis.org', collabPass: true })
    expect(res.status).toBe(302)
    const to = res.headers.get('Location')!
    expect(to.startsWith('https://comms-strat.sarapis.org/auth/cms/callback?ticket=v1.')).toBe(true)
    expect(await verifyTicket(ticketOf(to), S, { host: 'comms-strat.sarapis.org', state })).toMatchObject({ email: 'someone@sarapis.org' })
  })

  // Any CMS user can create an account with any email, so a ticket for a user without
  // the maintainer-set pass would let them sign in to a collab site as someone else.
  it('refuses a signed-in user without collabPass with 403, and no ticket', async () => {
    for (const user of [{ email: 'someone@sarapis.org' }, { email: 'someone@sarapis.org', collabPass: false }]) {
      const res = await call('comms-strat.sarapis.org', user)
      expect(res.status).toBe(403)
      expect(res.headers.get('Location')).toBeNull()
    }
  })

  it('sends a signed-out user to the admin login, then back here', async () => {
    const res = await call('comms-strat.sarapis.org')
    expect(res.status).toBe(302)
    const to = res.headers.get('Location')!
    expect(to.startsWith('/admin/login?redirect=')).toBe(true)
    expect(decodeURIComponent(to.split('redirect=')[1])).toBe(`/api/collab-pass/start?host=comms-strat.sarapis.org&state=${state}`)
  })

  it('refuses an unlisted host with 400, even for a signed-in user', async () => {
    const res = await call('evil.example', { email: 'someone@sarapis.org' })
    expect(res.status).toBe(400)
    expect(res.headers.get('Location')).toBeNull()
  })

  it('fails closed with 503 when the secret is missing or short', async () => {
    delete process.env.COLLAB_PASS_SECRET
    expect((await call('comms-strat.sarapis.org', { email: 'someone@sarapis.org' })).status).toBe(503)
    process.env.COLLAB_PASS_SECRET = 'x'.repeat(31)
    expect((await call('comms-strat.sarapis.org', { email: 'someone@sarapis.org' })).status).toBe(503)
  })
})
