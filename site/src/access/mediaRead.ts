import type { Access, CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from 'payload'

/**
 * Media is public (images are hot-linked by the brand sites), EXCEPT a file that is the
 * artifact of an unpublished knowledge item: a draft's .md/.html/.docx must not be
 * listable or downloadable before the item is published. Signed-in users see everything.
 *
 * Returned as a query constraint, so Payload applies it to lists, by-id reads and the
 * file route alike. The hidden-id list is memoised briefly because this runs on every
 * anonymous media request; any knowledge-item write clears it (hooks below).
 */
const TTL_MS = 30_000
let memo: { at: number; ids: Promise<(number | string)[]> } | null = null

async function loadHiddenArtifactIds(payload: Payload): Promise<(number | string)[]> {
  const res = await payload.find({
    collection: 'knowledge-items',
    where: { and: [{ published: { not_equals: true } }, { artifact: { exists: true } }] },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return (res.docs as any[]).map((k) => (k.artifact && typeof k.artifact === 'object' ? k.artifact.id : k.artifact)).filter((id) => id != null)
}

export function hiddenArtifactIds(payload: Payload): Promise<(number | string)[]> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.ids
  const ids = loadHiddenArtifactIds(payload)
  memo = { at: Date.now(), ids }
  ids.catch(() => (memo = null))
  return ids
}

export const mediaRead: Access = async ({ req }) => {
  if (req.user) return true
  const hidden = await hiddenArtifactIds(req.payload)
  return hidden.length ? { id: { not_in: hidden } } : true
}

export const clearHiddenArtifacts: CollectionAfterChangeHook = ({ doc }) => {
  memo = null
  return doc
}
export const clearHiddenArtifactsOnDelete: CollectionAfterDeleteHook = ({ doc }) => {
  memo = null
  return doc
}
