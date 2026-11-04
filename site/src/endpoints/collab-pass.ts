/**
 * "Sign in with the CMS" for collaboration sites built from sarapis/collab-template
 * (first: comms-strat.sarapis.org).
 *
 *   GET <this CMS>/api/collab-pass/start?host=comms-strat.sarapis.org&state=<random>
 *
 * The collab site cannot read this CMS's login cookie (another domain), so this endpoint,
 * which can, mints a TWO-MINUTE ticket naming the signed-in user's EMAIL and redirects to
 *   https://<host>/auth/cms/callback?ticket=…
 * The collab site verifies it (collab-template worker/src/cms.js, v1.2.0+). Ported from the
 * Field Guide CMS (Civic-Tech-Field-Guide/ctfg-website payload/src/collab-pass.ts), which does
 * the same for ctfg-collab.sarapis.org; the two must stay byte-compatible.
 *
 * ⚠ IT ASSERTS AN EMAIL, NOTHING ELSE, and only for users with `collabPass` (403 otherwise). The
 * collab site's own roster decides whether that email may do anything there. This CMS does not
 * verify emails, and any signed-in user can create a user with any email, so without the pass
 * any editor could sign in to a collab site as anyone on its roster. Only a maintainer can set
 * the pass, and changing the email clears it (collections/Users; tests/int/users-collab-pass).
 *
 * ⚠ ONLY TO LISTED HOSTS. A ticket carries an email, so minting one for any `host` asked would
 * hand every signed-in user's address to whoever links them here. COLLAB_PASS_HOSTS
 * (comma-separated) is the list; a host not on it is a 400.
 *
 * ⚠ FAILS CLOSED: no COLLAB_PASS_SECRET (or one under 32 chars) = 503. The collab Worker holds
 * the same value as CMS_PASS_SECRET. Both are read from the container env (/opt/sarapis/.env).
 *
 * Format: `v1.<base64url(JSON claims)>.<base64url(HMAC-SHA256(secret, "v1.<body>"))>`,
 * claims { k: 'collab-identity', m: email, h: host, s: state, e: expiry (unix s) }.
 * tests/int/collab-pass.int.spec.ts asserts the exact bytes of a vector collab-template's
 * worker/test/cms.test.js also asserts, and round-trips a ticket through its verifier.
 */
import { createHmac } from 'node:crypto'
import type { Endpoint, PayloadRequest } from 'payload'

export const COLLAB_TICKET_KIND = 'collab-identity'
export const COLLAB_TICKET_TTL_S = 120

type Env = Record<string, string | undefined>

export function collabSecret(env: Env = process.env): string {
  const s = String(env.COLLAB_PASS_SECRET || '').trim()
  return s.length >= 32 ? s : ''
}

export function collabHosts(env: Env = process.env): string[] {
  return String(env.COLLAB_PASS_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

export function signCollabTicket(claims: Record<string, unknown>, secret: string): string {
  if (!secret) throw new Error('collab-pass: no secret')
  const body = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  const mac = createHmac('sha256', secret).update(`v1.${body}`).digest().toString('base64url')
  return `v1.${body}.${mac}`
}

/** The redirect back, or null when this request must not get a ticket. */
export function collabRedirect(
  input: { host: unknown; state: unknown; email: unknown; now?: number },
  env: Env = process.env,
): string | null {
  const secret = collabSecret(env)
  const host = String(input.host ?? '').trim().toLowerCase()
  const state = String(input.state ?? '')
  const email = String(input.email ?? '').trim()
  if (!secret || !collabHosts(env).includes(host)) return null
  if (!/^[A-Za-z0-9-]{16,128}$/.test(state) || !/^[^@\s]+@[^@\s]+$/.test(email)) return null
  const now = input.now ?? Math.floor(Date.now() / 1000)
  const ticket = signCollabTicket(
    { k: COLLAB_TICKET_KIND, m: email, h: host, s: state, e: now + COLLAB_TICKET_TTL_S },
    secret,
  )
  return `https://${host}/auth/cms/callback?ticket=${encodeURIComponent(ticket)}`
}

const page = (status: number, title: string, body: string) =>
  new Response(
    `<!doctype html><meta charset=utf-8><meta name=robots content="noindex"><title>${title}</title>` +
      `<body style="font:16px/1.5 system-ui,sans-serif;max-width:38rem;margin:15vh auto;padding:0 1rem">` +
      `<h1 style="font-size:1.4rem">${title}</h1><p>${body}</p></body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )

export const collabPassStartEndpoint: Endpoint = {
  path: '/collab-pass/start',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    if (!collabSecret()) {
      req.payload.logger.error('collab-pass: COLLAB_PASS_SECRET is not set (or under 32 chars)')
      return page(503, 'Not available', 'Signing in to other sites with this CMS is not configured.')
    }
    const url = new URL(req.url || '', 'http://local')
    const host = String(url.searchParams.get('host') || '').trim().toLowerCase()
    const state = String(url.searchParams.get('state') || '')
    if (!collabHosts().includes(host)) {
      return page(400, 'Unknown site', 'This CMS does not sign people in to that site.')
    }

    if (!req.user) {
      const self = `/api/collab-pass/start?host=${encodeURIComponent(host)}&state=${encodeURIComponent(state)}`
      const admin = req.payload.config.routes?.admin || '/admin'
      return new Response(null, {
        status: 302,
        headers: { Location: `${admin}/login?redirect=${encodeURIComponent(self)}`, 'Cache-Control': 'no-store' },
      })
    }
    const { email, collabPass } = req.user as { email?: string; collabPass?: boolean | null }
    if (collabPass !== true) {
      return page(403, 'Not allowed', 'Your account here is not set up to sign in to other sites. Ask a Sarapis maintainer.')
    }
    const to = collabRedirect({ host, state, email })
    if (!to) {
      return page(400, 'Could not sign you in', 'The request was not complete. Start again from the site you were signing in to.')
    }
    req.payload.logger.info(`collab-pass: ticket issued for ${host}`)
    return new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } })
  },
}
