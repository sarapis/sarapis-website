import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { loadAllowedSites } from '@/app/(frontend)/siteAssets'

/**
 * /next/logo may fetch an endorsing organization's website (ospo.opensource.nyc
 * shows its logo from there), but only once the endorsement is approved, and
 * never for one that declined public display or for an individual: the route
 * must not become a proxy for any site someone submits.
 */
let payload: Payload
const created: (string | number)[] = []

describe('endorsement websites in the logo allowlist', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const mk = async (data: Record<string, unknown>) => {
      const doc = await payload.create({
        collection: 'campaign-endorsements',
        data: { email: 'x@example.invalid', campaign: 'test-logos', ...data } as any,
        overrideAccess: true,
      })
      created.push(doc.id)
    }
    await mk({ name: 'Shown Org', kind: 'organization', website: 'https://www.shown-org.example/', displayPublicly: true, published: true })
    await mk({ name: 'Old Org', kind: 'organization', website: 'old-org.example/about', published: true }) // NULL display: shown
    await mk({ name: 'Hidden Org', kind: 'organization', website: 'https://hidden-org.example', displayPublicly: false, published: true })
    await mk({ name: 'Pending Org', kind: 'organization', website: 'https://pending-org.example', displayPublicly: true, published: false })
    await mk({ name: 'A Person', kind: 'individual', website: 'https://person.example', displayPublicly: true, published: true })
  })

  afterAll(async () => {
    for (const id of created) await payload.delete({ collection: 'campaign-endorsements', id, overrideAccess: true })
  })

  it('allows approved, shown organizations (www. and trailing slash normalised), and older ones that never answered', async () => {
    const { keys, hosts } = await loadAllowedSites()
    expect(keys.has('shown-org.example')).toBe(true)
    expect(hosts.has('www.shown-org.example')).toBe(true)
    expect(keys.has('old-org.example/about')).toBe(true)
  })

  it('refuses hidden, unapproved and individual entries', async () => {
    const { keys } = await loadAllowedSites()
    expect(keys.has('hidden-org.example')).toBe(false)
    expect(keys.has('pending-org.example')).toBe(false)
    expect(keys.has('person.example')).toBe(false)
  })
})
