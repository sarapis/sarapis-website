import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'
import { revalidateTag } from 'next/cache'

import { FRONTEND_TAG } from '../utilities/cachedQuery'

/**
 * Drops the cached public-page data after a write. Wrapped in try/catch because writes
 * also happen outside a Next request (tests, scripts), where revalidateTag throws: a
 * failed revalidation must never fail the write itself; the cache TTL bounds the damage.
 */
function revalidate(context: Record<string, unknown>) {
  if (context?.disableRevalidate) return
  try {
    revalidateTag(FRONTEND_TAG, 'max')
  } catch {
    /* not in a Next request context */
  }
}

export const revalidateFrontendAfterChange: CollectionAfterChangeHook = ({ doc, req }) => {
  revalidate(req.context)
  return doc
}
export const revalidateFrontendAfterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  revalidate(req.context)
  return doc
}
export const revalidateFrontendGlobal: GlobalAfterChangeHook = ({ doc, req }) => {
  revalidate(req.context)
  return doc
}
