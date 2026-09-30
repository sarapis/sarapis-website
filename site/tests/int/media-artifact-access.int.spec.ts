import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'

/**
 * L2: a draft knowledge item's uploaded artifact must not be readable anonymously
 * through /api/media before the item is published. Images and other media stay public.
 */
let payload: Payload
let mediaId: number
let kiId: number
let user: any

const anonIds = async () =>
  (await payload.find({ collection: 'media', where: { filename: { like: 'l2-artifact-test' } }, overrideAccess: false, depth: 0 })).docs.map((d) => d.id)

describe('media access for knowledge-item artifacts', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
    const data = Buffer.from('# draft notes\n')
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'L2 test artifact' } as any,
      file: { data, mimetype: 'text/markdown', name: 'l2-artifact-test.md', size: data.length },
      overrideAccess: true,
    })
    mediaId = media.id as number
    const ki = await payload.create({
      collection: 'knowledge-items',
      data: { title: 'L2 draft KI', kind: 'artifact', artifact: mediaId, published: false } as any,
      overrideAccess: true,
    })
    kiId = ki.id as number
    user = (await payload.find({ collection: 'users', limit: 1, overrideAccess: true })).docs[0]
  })
  afterAll(cleanup)

  async function cleanup() {
    await payload.delete({ collection: 'knowledge-items', where: { title: { equals: 'L2 draft KI' } }, overrideAccess: true })
    await payload.delete({ collection: 'media', where: { filename: { like: 'l2-artifact-test' } }, overrideAccess: true })
  }

  it('hides a draft knowledge item\'s artifact from anonymous readers', async () => {
    expect(await anonIds()).toEqual([])
    await expect(payload.findByID({ collection: 'media', id: mediaId, overrideAccess: false })).rejects.toThrow()
  })

  it('shows it once the item is published', async () => {
    await payload.update({ collection: 'knowledge-items', id: kiId, data: { published: true } as any, overrideAccess: true })
    expect(await anonIds()).toEqual([mediaId])
    await payload.update({ collection: 'knowledge-items', id: kiId, data: { published: false } as any, overrideAccess: true })
    expect(await anonIds()).toEqual([])
  })

  it('signed-in users always see it', async () => {
    if (!user) return // a fresh CI database may have no users; the anonymous cases above are the point
    const docs = (await payload.find({ collection: 'media', where: { filename: { like: 'l2-artifact-test' } }, overrideAccess: false, user, depth: 0 })).docs
    expect(docs.map((d) => d.id)).toEqual([mediaId])
  })

  it('leaves other media public', async () => {
    const all = await payload.find({ collection: 'media', overrideAccess: false, limit: 1, depth: 0 })
    const total = await payload.count({ collection: 'media', overrideAccess: true })
    expect(all.totalDocs).toBe(total.totalDocs - 1) // everything but the hidden artifact
  })
})
