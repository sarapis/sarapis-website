import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, afterAll, afterEach, expect, vi } from 'vitest'
import { endorsementEmail } from '@/hooks/notifyNewEndorsement'

/**
 * notifyNewEndorsement: one email per NEW endorsement, through Resend's API,
 * only when configured, and never on an update (approving an entry must not
 * email again). fetch is stubbed; nothing leaves the machine.
 */
let payload: Payload
const created: (string | number)[] = []
const ENV = ['RESEND_API_KEY', 'ENDORSEMENT_NOTIFY_FROM', 'ENDORSEMENT_NOTIFY_TO'] as const

describe('new-endorsement email', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const k of ENV) delete process.env[k]
  })

  afterAll(async () => {
    for (const id of created) {
      await payload.delete({ collection: 'campaign-endorsements', id, overrideAccess: true })
    }
  })

  // Only Resend calls count: Payload itself pings its telemetry with fetch.
  const resendCalls = (m: ReturnType<typeof vi.fn>) =>
    m.mock.calls.filter((c) => String((c as unknown[])[0]) === 'https://api.resend.com/emails')
  const stubFetch = () => {
    const fetchMock = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }
  const configure = () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.ENDORSEMENT_NOTIFY_FROM = 'CMS <cms@example.invalid>'
    process.env.ENDORSEMENT_NOTIFY_TO = 'a@example.invalid, b@example.invalid'
  }

  it('sends one email on create, to every recipient, and none on update', async () => {
    configure()
    const fetchMock = stubFetch()
    const doc = await payload.create({
      collection: 'campaign-endorsements',
      data: { name: 'Notify Org', email: 'org@example.invalid', kind: 'organization', campaign: 'nyc-ospo', logoUrl: 'https://example.invalid/l.svg' },
      overrideAccess: false,
    })
    created.push(doc.id)
    expect(resendCalls(fetchMock)).toHaveLength(1)
    const [url, init] = resendCalls(fetchMock)[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test')
    const body = JSON.parse(String(init.body))
    expect(body.to).toEqual(['a@example.invalid', 'b@example.invalid'])
    expect(body.subject).toBe('New endorsement: Notify Org (organization)')
    // Private fields reach the email even though the anonymous request
    // can't read them back.
    expect(body.text).toContain('Email: org@example.invalid')
    expect(body.text).toContain('Logo link: https://example.invalid/l.svg')
    expect(body.text).toContain(`/admin/collections/campaign-endorsements/${doc.id}`)

    await payload.update({ collection: 'campaign-endorsements', id: doc.id, data: { published: true }, overrideAccess: true })
    expect(resendCalls(fetchMock)).toHaveLength(1)
  })

  it('sends nothing when not configured, and the entry is still saved', async () => {
    const fetchMock = stubFetch()
    const doc = await payload.create({
      collection: 'campaign-endorsements',
      data: { name: 'Quiet Person', email: 'quiet@example.invalid', kind: 'individual' },
      overrideAccess: false,
    })
    created.push(doc.id)
    expect(resendCalls(fetchMock)).toHaveLength(0)
  })

  it('a failed send does not fail the submission', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    const doc = await payload.create({
      collection: 'campaign-endorsements',
      data: { name: 'Still Saved', email: 'saved@example.invalid', kind: 'individual' },
      overrideAccess: false,
    })
    created.push(doc.id)
    expect(doc.id).toBeTruthy()
  })

  it("an individual's email lists their title and affiliation, and the display answer", () => {
    const { subject, text } = endorsementEmail({
      id: 7,
      kind: 'individual',
      name: 'Pat Doe',
      title: 'Engineer',
      organization: 'Example Lab',
      email: 'pat@example.invalid',
      displayPublicly: false,
      quote: 'Yes to an OSPO.',
      campaign: 'nyc-ospo',
    })
    expect(subject).toBe('New endorsement: Pat Doe')
    expect(text).toContain('Title: Engineer')
    expect(text).toContain('Affiliation: Example Lab')
    expect(text).toContain('Show publicly: no')
    expect(text).toContain('Message of support: Yes to an OSPO.')
    expect(text).not.toContain('Logo link')
  })
})
