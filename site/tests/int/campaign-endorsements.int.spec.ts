import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'

/**
 * The endorser wall on the campaign site reads this collection ANONYMOUSLY and
 * shows every `published` doc, so two access rules carry the whole trust model:
 *
 *  1. an anonymous submitter must NOT be able to approve their own entry —
 *     `published` is the review gate, and it only means something if a human
 *     sets it. (It could be set by anyone until this test was written: one POST
 *     with `"published": true` put an entry straight onto the public wall.)
 *  2. anonymous reads must never include a signer's private fields.
 *
 * Both run with `overrideAccess: false` and no `user`, i.e. exactly what an
 * unauthenticated REST/GraphQL request gets.
 */
let payload: Payload
const created: (string | number)[] = []

describe('campaign-endorsements access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const id of created) {
      await payload.delete({ collection: 'campaign-endorsements', id, overrideAccess: true })
    }
  })

  it('ignores `published: true` on an anonymous create', async () => {
    const doc = await payload.create({
      collection: 'campaign-endorsements',
      data: { name: 'Test Signer', email: 'signer@example.invalid', kind: 'individual', published: true },
      overrideAccess: false,
    })
    created.push(doc.id)

    const stored = await payload.findByID({ collection: 'campaign-endorsements', id: doc.id, overrideAccess: true })
    expect(stored.published).toBe(false)

    const wall = await payload.find({
      collection: 'campaign-endorsements',
      where: { id: { equals: doc.id } },
      overrideAccess: false,
    })
    expect(wall.totalDocs).toBe(0)
  })

  it('still lets an admin publish', async () => {
    const doc = await payload.create({
      collection: 'campaign-endorsements',
      data: { name: 'Approved Signer', email: 'approved@example.invalid', kind: 'individual' },
      overrideAccess: false,
    })
    created.push(doc.id)

    const approved = await payload.update({
      collection: 'campaign-endorsements',
      id: doc.id,
      data: { published: true },
      overrideAccess: true,
    })
    expect(approved.published).toBe(true)
  })

  it('withholds private fields from anonymous reads of a published entry', async () => {
    const doc = await payload.create({
      collection: 'campaign-endorsements',
      data: {
        name: 'Public Org',
        email: 'private@example.invalid',
        kind: 'organization',
        contactName: 'Private Person',
        activity: 'Private description',
        source: '/campaign/sign',
        wantsUpdates: true,
        published: true,
      },
      overrideAccess: true,
    })
    created.push(doc.id)

    const res = await payload.find({
      collection: 'campaign-endorsements',
      where: { id: { equals: doc.id } },
      overrideAccess: false,
    })
    expect(res.totalDocs).toBe(1)
    const pub = res.docs[0] as unknown as Record<string, unknown>
    expect(pub.name).toBe('Public Org')
    for (const field of ['email', 'contactName', 'activity', 'activityConsent', 'source', 'wantsUpdates']) {
      expect(pub, `anonymous read leaked "${field}"`).not.toHaveProperty(field)
    }
  })
})
