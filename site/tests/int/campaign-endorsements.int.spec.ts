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
    for (const field of ['email', 'contactName', 'activity', 'activityConsent', 'source', 'wantsUpdates', 'logoUrl']) {
      expect(pub, `anonymous read leaked "${field}"`).not.toHaveProperty(field)
    }
  })

  /* ospo.opensource.nyc asks every signer whether they may be shown publicly.
     A "no" must keep them counted but nameless; a "yes" (and older entries,
     which never answered) must be shown as before. */
  it('counts but does not name a signer who declined public display', async () => {
    const doc = await payload.create({
      collection: 'campaign-endorsements',
      data: {
        name: 'Private Signer',
        email: 'quiet@example.invalid',
        kind: 'individual',
        title: 'Hidden Title',
        organization: 'Hidden Org',
        quote: 'Hidden quote',
        campaign: 'test-display',
        displayPublicly: false,
        published: true,
      },
      overrideAccess: true,
    })
    created.push(doc.id)

    const res = await payload.find({
      collection: 'campaign-endorsements',
      where: { campaign: { equals: 'test-display' } },
      overrideAccess: false,
    })
    expect(res.totalDocs).toBe(1)
    const pub = res.docs[0] as unknown as Record<string, unknown>
    expect(pub.kind).toBe('individual')
    for (const field of ['name', 'title', 'organization', 'website', 'quote', 'logo']) {
      expect(pub, `hidden signer's "${field}" was readable`).not.toHaveProperty(field)
    }

    // ...and cannot be found by name either.
    await expect(
      payload.find({
        collection: 'campaign-endorsements',
        where: { name: { equals: 'Private Signer' } },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    // An admin still sees everything.
    const admin = await payload.findByID({ collection: 'campaign-endorsements', id: doc.id, overrideAccess: true })
    expect(admin.name).toBe('Private Signer')
  })

  it('shows the name and quote of a signer who agreed, and of older entries that never answered', async () => {
    for (const displayPublicly of [true, undefined]) {
      const doc = await payload.create({
        collection: 'campaign-endorsements',
        data: {
          name: `Shown ${displayPublicly}`,
          email: 'shown@example.invalid',
          kind: 'individual',
          quote: 'Open source keeps it public.',
          campaign: `test-shown-${displayPublicly}`,
          ...(displayPublicly === undefined ? {} : { displayPublicly }),
          published: true,
        },
        overrideAccess: true,
      })
      created.push(doc.id)

      const res = await payload.find({
        collection: 'campaign-endorsements',
        where: { campaign: { equals: `test-shown-${displayPublicly}` } },
        overrideAccess: false,
      })
      const pub = res.docs[0] as unknown as Record<string, unknown>
      expect(pub.name).toBe(`Shown ${displayPublicly}`)
      expect(pub.quote).toBe('Open source keeps it public.')
    }
  })

  it('ignores a `logo` on an anonymous create', async () => {
    const media = await payload.find({ collection: 'media', limit: 1, overrideAccess: true })
    const doc = await payload.create({
      collection: 'campaign-endorsements',
      data: {
        name: 'Logo Org',
        email: 'logo@example.invalid',
        kind: 'organization',
        logoUrl: 'https://example.invalid/logo.svg',
        // Any id: an existing one when the DB has media, else a made-up one.
        logo: (media.docs[0]?.id as number | undefined) ?? 1,
      },
      overrideAccess: false,
    })
    created.push(doc.id)

    const stored = await payload.findByID({ collection: 'campaign-endorsements', id: doc.id, depth: 0, overrideAccess: true })
    expect(stored.logo ?? null).toBeNull()
    expect(stored.logoUrl).toBe('https://example.invalid/logo.svg')
  })
})
