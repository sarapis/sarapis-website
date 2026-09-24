import { getPayload } from 'payload'
import config from '@payload-config'
const payload = await getPayload({ config })
let n = 0
for (const coll of ['posts','pages'] as const) {
  const res = await payload.find({ collection: coll, limit: 1000, depth: 0 })
  for (const d of res.docs as any[]) {
    const heroId = typeof d.heroImage === 'object' ? d.heroImage?.id : d.heroImage
    const metaImg = d.meta?.image
    if (heroId && !metaImg) {
      await payload.update({ collection: coll, id: d.id, data: { meta: { ...(d.meta||{}), image: heroId } } as any, context: { disableRevalidate: true } })
      n++
    }
  }
}
console.log('meta.image backfilled:', n)
