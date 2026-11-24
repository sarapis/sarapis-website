import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, afterAll, afterEach, expect, vi } from 'vitest'
import { campaignConfig, envKey, firstName } from '@/lib/campaignEmail'

/**
 * Campaign list and automatic emails (src/lib/campaignEmail.ts,
 * src/hooks/campaignEmails.ts). fetch is stubbed; nothing leaves the machine.
 * The hooks work in the background, so each check waits for the calls.
 */
let payload: Payload
const created: { collection: 'campaign-signups' | 'campaign-endorsements'; id: string | number }[] = []
const ENV = [
  'RESEND_API_KEY',
  'CAMPAIGN_EMAIL_NYC_OSPO_FROM',
  'CAMPAIGN_EMAIL_NYC_OSPO_REPLY_TO',
  'CAMPAIGN_EMAIL_NYC_OSPO_SEGMENT_ID',
  'CAMPAIGN_EMAIL_NYC_OSPO_TOPIC_ID',
  'CAMPAIGN_EMAIL_NYC_OSPO_USE_TEMPLATES',
] as const

type Call = [string, RequestInit]
const resendCalls = (m: ReturnType<typeof vi.fn>) =>
  (m.mock.calls as unknown as Call[]).filter((c) => String(c[0]).startsWith('https://api.resend.com/'))
const emails = (m: ReturnType<typeof vi.fn>) =>
  resendCalls(m)
    .filter((c) => c[0] === 'https://api.resend.com/emails')
    .map((c) => JSON.parse(String(c[1].body)))

const stubFetch = (status = 200) => {
  const fetchMock = vi.fn(async () => new Response('{"id":"x"}', { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const configure = () => {
  process.env.RESEND_API_KEY = 're_test'
  process.env.CAMPAIGN_EMAIL_NYC_OSPO_FROM = 'NYC OSPO <ospo@example.invalid>'
  process.env.CAMPAIGN_EMAIL_NYC_OSPO_REPLY_TO = 'team@example.invalid'
  process.env.CAMPAIGN_EMAIL_NYC_OSPO_SEGMENT_ID = 'seg_1'
  process.env.CAMPAIGN_EMAIL_NYC_OSPO_TOPIC_ID = 'top_1'
}
const settle = () => new Promise((r) => setTimeout(r, 300))

describe('campaign emails', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const k of ENV) delete process.env[k]
  })

  afterAll(async () => {
    for (const { collection, id } of created) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => {})
    }
  })

  const signup = async (email: string, source = '/') => {
    const doc = await payload.create({
      collection: 'campaign-signups',
      data: { email, campaign: 'nyc-ospo', source },
      overrideAccess: false,
    })
    created.push({ collection: 'campaign-signups', id: doc.id })
    return doc
  }

  it('config: only a campaign with words AND a sender, and only with an API key', () => {
    expect(envKey('nyc-ospo')).toBe('NYC_OSPO')
    expect(campaignConfig('nyc-ospo')).toBeNull()
    configure()
    expect(campaignConfig('nyc-ospo')?.replyTo).toEqual(['team@example.invalid'])
    expect(campaignConfig('un-open-source')).toBeNull()
    expect(campaignConfig(undefined)).toBeNull()
    delete process.env.RESEND_API_KEY
    expect(campaignConfig('nyc-ospo')).toBeNull()
  })

  it('a homepage sign-up joins the list and gets one welcome; a repeat gets none', async () => {
    configure()
    const fetchMock = stubFetch()
    await signup('welcome@example.invalid')
    await vi.waitFor(() => expect(emails(fetchMock)).toHaveLength(1))

    const contact = resendCalls(fetchMock).find((c) => c[0] === 'https://api.resend.com/contacts')!
    expect(JSON.parse(String(contact[1].body))).toEqual({
      email: 'welcome@example.invalid',
      unsubscribed: false,
      segments: [{ id: 'seg_1' }],
      topics: [{ id: 'top_1', subscription: 'opt_in' }],
    })
    const [mail] = emails(fetchMock)
    expect(mail.to).toEqual(['welcome@example.invalid'])
    expect(mail.from).toBe('NYC OSPO <ospo@example.invalid>')
    expect(mail.reply_to).toEqual(['team@example.invalid'])
    expect(mail.subject).toBe('Thanks for following the campaign for an NYC OSPO')
    expect(mail.text).toContain('https://ospo.opensource.nyc/endorse')
    expect(mail.headers['List-Unsubscribe']).toBe('<mailto:team@example.invalid?subject=unsubscribe>')

    await signup('welcome@example.invalid')
    await settle()
    expect(emails(fetchMock)).toHaveLength(1)
  })

  it("a sign-up from the endorse form joins the list but gets no welcome", async () => {
    configure()
    const fetchMock = stubFetch()
    await signup('fromendorse@example.invalid', '/endorse')
    await vi.waitFor(() =>
      expect(resendCalls(fetchMock).some((c) => c[0] === 'https://api.resend.com/contacts')).toBe(true),
    )
    await settle()
    expect(emails(fetchMock)).toHaveLength(0)
  })

  it('an existing contact is added to the segment and topic instead', async () => {
    configure()
    const fetchMock = vi.fn(async (url: string) =>
      url === 'https://api.resend.com/contacts'
        ? new Response('{"message":"exists"}', { status: 409 })
        : new Response('{"id":"x"}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await signup('existing@example.invalid', '/endorse')
    await vi.waitFor(() =>
      expect(resendCalls(fetchMock).map((c) => c[0])).toEqual([
        'https://api.resend.com/contacts',
        'https://api.resend.com/contacts/existing%40example.invalid/segments/seg_1',
        'https://api.resend.com/contacts/existing%40example.invalid/topics',
      ]),
    )
  })

  it('an endorser gets a thank-you on create and a note once published, and only once', async () => {
    configure()
    const fetchMock = stubFetch()
    const doc = await payload.create({
      collection: 'campaign-endorsements',
      data: {
        name: 'Acme Civic',
        kind: 'organization',
        contactName: 'Sam Rivera',
        email: 'sam@example.invalid',
        campaign: 'nyc-ospo',
        wantsUpdates: true,
      },
      overrideAccess: false,
    })
    created.push({ collection: 'campaign-endorsements', id: doc.id })
    await vi.waitFor(() => expect(emails(fetchMock)).toHaveLength(1))
    const [thanks] = emails(fetchMock)
    expect(thanks.to).toEqual(['sam@example.invalid'])
    expect(thanks.text).toContain('Hi Sam,')
    expect(thanks.text).toContain('on behalf of Acme Civic')
    expect(thanks.text).toContain('You also asked for campaign updates')

    await payload.update({ collection: 'campaign-endorsements', id: doc.id, data: { quote: 'Edited.' }, overrideAccess: true })
    await settle()
    expect(emails(fetchMock)).toHaveLength(1)

    await payload.update({ collection: 'campaign-endorsements', id: doc.id, data: { published: true }, overrideAccess: true })
    await vi.waitFor(() => expect(emails(fetchMock)).toHaveLength(2))
    expect(emails(fetchMock)[1].subject).toBe('Your endorsement of an NYC OSPO is live')
    expect(emails(fetchMock)[1].text).toContain('https://ospo.opensource.nyc/endorse#endorsers')

    await payload.update({ collection: 'campaign-endorsements', id: doc.id, data: { quote: 'Again.' }, overrideAccess: true })
    await settle()
    expect(emails(fetchMock)).toHaveLength(2)
  })

  it('another campaign, or no settings, sends nothing; a Resend error never fails the form', async () => {
    let fetchMock = stubFetch()
    await signup('quiet@example.invalid')
    const other = await payload.create({
      collection: 'campaign-signups',
      data: { email: 'other@example.invalid', campaign: 'un-open-source' },
      overrideAccess: false,
    })
    created.push({ collection: 'campaign-signups', id: other.id })
    await settle()
    expect(resendCalls(fetchMock)).toHaveLength(0)

    configure()
    fetchMock = stubFetch(500)
    const doc = await signup('failing@example.invalid')
    expect(doc.id).toBeTruthy()
    await settle()
  })

  it('with templates on: sends the Resend template, escaping form input; no subject or text', async () => {
    configure()
    process.env.CAMPAIGN_EMAIL_NYC_OSPO_USE_TEMPLATES = '1'
    const fetchMock = stubFetch()
    const doc = await payload.create({
      collection: 'campaign-endorsements',
      data: {
        name: 'Acme <b>Civic</b>',
        kind: 'organization',
        contactName: 'Sam & Co',
        email: 'tpl@example.invalid',
        campaign: 'nyc-ospo',
        displayPublicly: false,
      },
      overrideAccess: false,
    })
    created.push({ collection: 'campaign-endorsements', id: doc.id })
    await vi.waitFor(() => expect(emails(fetchMock)).toHaveLength(1))
    const [mail] = emails(fetchMock)
    expect(mail.template.id).toBe('nyc-ospo-endorsement-thanks')
    expect(mail.template.variables).toEqual({
      GREETING_NAME: 'Sam',
      ON_BEHALF: ' on behalf of Acme &lt;b&gt;Civic&lt;/b&gt;',
      NAME_NOTE: ' You asked not to be listed by name, so your endorsement will be counted without your name.',
      UPDATES_NOTE: '',
    })
    expect(mail.subject).toBeUndefined()
    expect(mail.text).toBeUndefined()
    expect(mail.reply_to).toEqual(['team@example.invalid'])
    delete process.env.CAMPAIGN_EMAIL_NYC_OSPO_USE_TEMPLATES
  })

  it('with templates on: a refused template falls back to the built-in words', async () => {
    configure()
    process.env.CAMPAIGN_EMAIL_NYC_OSPO_USE_TEMPLATES = '1'
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      String(init?.body ?? '').includes('"template"')
        ? new Response('{"message":"template not published"}', { status: 422 })
        : new Response('{"id":"x"}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await signup('fallback@example.invalid')
    await vi.waitFor(() => expect(emails(fetchMock)).toHaveLength(2))
    const [tpl, text] = emails(fetchMock)
    expect(tpl.template.id).toBe('nyc-ospo-welcome')
    expect(text.subject).toBe('Thanks for following the campaign for an NYC OSPO')
    expect(text.text).toContain('https://ospo.opensource.nyc/endorse')
    delete process.env.CAMPAIGN_EMAIL_NYC_OSPO_USE_TEMPLATES
  })

  it('first names: the person, or the contact for an organization', () => {
    expect(firstName({ kind: 'individual', name: '  Pat  Doe ' })).toBe('Pat')
    expect(firstName({ kind: 'organization', name: 'Acme', contactName: 'Sam Rivera' })).toBe('Sam')
    expect(firstName({ kind: 'organization', name: 'Acme' })).toBeNull()
  })
})
