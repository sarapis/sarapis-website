import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, afterAll, afterEach, expect, vi } from 'vitest'

/**
 * sendCampaignConfirmation: the email a visitor gets after a campaign form.
 * Every case runs as an anonymous create, exactly what the public forms send,
 * with fetch stubbed so nothing leaves the machine. Pins who gets an email,
 * that none of the visitor's own words are in it, and when none is sent.
 */
let payload: Payload
const created: { collection: 'campaign-endorsements' | 'campaign-signups'; id: string | number }[] = []
const ENV = ['RESEND_API_KEY', 'CAMPAIGN_EMAIL_FROM', 'CAMPAIGN_EMAIL_REPLY_TO', 'ENDORSEMENT_NOTIFY_FROM', 'ENDORSEMENT_NOTIFY_TO'] as const
let n = 0
const addr = () => `visitor${Date.now()}-${n++}@example.invalid`

// Only confirmation sends count: Payload pings its telemetry with fetch, and
// the approver's notification (if configured) also goes to Resend.
const confirmations = (m: ReturnType<typeof vi.fn>) =>
  m.mock.calls
    .filter((c) => String((c as unknown[])[0]) === 'https://api.resend.com/emails')
    .map((c) => JSON.parse(String(((c as unknown[])[1] as RequestInit).body)))
    .filter((b) => b.from === 'OSPO <ospo@example.invalid>')

describe('campaign confirmation emails', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const k of ENV) delete process.env[k]
  })

  afterAll(async () => {
    for (const { collection, id } of created) await payload.delete({ collection, id, overrideAccess: true })
  })

  const stubFetch = () => {
    const m = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }))
    vi.stubGlobal('fetch', m)
    return m
  }
  const configure = () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.CAMPAIGN_EMAIL_FROM = 'OSPO <ospo@example.invalid>'
    process.env.CAMPAIGN_EMAIL_REPLY_TO = 'hello@example.invalid'
  }
  const endorse = async (data: Record<string, unknown>) => {
    const doc = await payload.create({ collection: 'campaign-endorsements', data: data as any, overrideAccess: false })
    created.push({ collection: 'campaign-endorsements', id: doc.id })
    return doc
  }
  const signUp = async (data: Record<string, unknown>) => {
    const doc = await payload.create({ collection: 'campaign-signups', data: data as any, overrideAccess: false })
    created.push({ collection: 'campaign-signups', id: doc.id })
    return doc
  }

  it('confirms a new endorsement to the signer, with none of their own words in it', async () => {
    configure()
    const m = stubFetch()
    const email = addr()
    await endorse({
      kind: 'individual',
      name: 'Click https://spam.example now',
      email,
      organization: 'Spam Inc',
      quote: 'Visit https://spam.example',
      wantsUpdates: true,
      campaign: 'nyc-ospo',
      source: '/endorse',
    })
    const sent = confirmations(m)
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe(email)
    expect(sent[0].reply_to).toBe('hello@example.invalid')
    expect(sent[0].subject).toContain('endorsing')
    expect(sent[0].text).toContain('You also asked for updates')
    expect(sent[0].text).toContain('your name will show')
    for (const s of ['spam.example', 'Spam Inc', 'Click']) expect(sent[0].text + sent[0].subject).not.toContain(s)
  })

  it("says 'your organization' to an organization, and leaves out updates when not asked", async () => {
    configure()
    const m = stubFetch()
    await endorse({ kind: 'organization', name: 'Some Org', email: addr(), contactName: 'Pat', campaign: 'nyc-ospo', wantsUpdates: false })
    const [sent] = confirmations(m)
    expect(sent.text).toContain('your organization will show')
    expect(sent.text).not.toContain('asked for updates')
  })

  it('confirms a homepage sign-up, but not one from the endorse form (that visitor gets the endorsement email)', async () => {
    configure()
    const m = stubFetch()
    const email = addr()
    await signUp({ email, campaign: 'nyc-ospo', source: '/' })
    await signUp({ email: addr(), campaign: 'nyc-ospo', source: '/endorse' })
    const sent = confirmations(m)
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe(email)
    expect(sent[0].subject).toContain('signed up for updates')
  })

  it('sends one email per address and campaign, however often it is submitted', async () => {
    configure()
    const m = stubFetch()
    const email = addr()
    await signUp({ email, campaign: 'nyc-ospo', source: '/' })
    await signUp({ email, campaign: 'nyc-ospo', source: '/' })
    await endorse({ kind: 'individual', name: 'Twice', email, campaign: 'nyc-ospo' })
    await endorse({ kind: 'individual', name: 'Twice', email, campaign: 'nyc-ospo' })
    const sent = confirmations(m)
    expect(sent.filter((s) => s.subject.includes('signed up'))).toHaveLength(1)
    expect(sent.filter((s) => s.subject.includes('endorsing'))).toHaveLength(1)
  })

  it('sends nothing for a campaign without confirmations, or when not configured', async () => {
    configure()
    const m = stubFetch()
    await signUp({ email: addr(), campaign: 'un-open-source', source: '/unnyc' })
    await endorse({ kind: 'individual', name: 'UN', email: addr(), campaign: 'un-open-source' })
    expect(confirmations(m)).toHaveLength(0)

    for (const k of ENV) delete process.env[k]
    const doc = await signUp({ email: addr(), campaign: 'nyc-ospo', source: '/' })
    expect(doc.id).toBeTruthy()
    expect(confirmations(m)).toHaveLength(0)
  })

  it('a failed send does not fail the submission', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    const doc = await endorse({ kind: 'individual', name: 'Still Saved', email: addr(), campaign: 'nyc-ospo' })
    expect(doc.id).toBeTruthy()
  })

  it('still sends the approver their notification alongside the confirmation', async () => {
    configure()
    process.env.ENDORSEMENT_NOTIFY_FROM = 'CMS <cms@example.invalid>'
    process.env.ENDORSEMENT_NOTIFY_TO = 'approver@example.invalid'
    const m = stubFetch()
    await endorse({ kind: 'individual', name: 'Both', email: addr(), campaign: 'nyc-ospo' })
    const bodies = m.mock.calls
      .filter((c) => String((c as unknown[])[0]) === 'https://api.resend.com/emails')
      .map((c) => JSON.parse(String(((c as unknown[])[1] as RequestInit).body)))
    expect(bodies.map((b) => b.from).sort()).toEqual(['CMS <cms@example.invalid>', 'OSPO <ospo@example.invalid>'])
  })
})
