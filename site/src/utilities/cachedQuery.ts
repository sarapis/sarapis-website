import { unstable_cache } from 'next/cache'

/**
 * Tag on every cached public-page data loader. Any write to a collection or global the
 * public pages read revalidates it (see hooks/revalidateFrontend.ts), so edits show up
 * at once; the TTL only bounds staleness from writes that bypass hooks (raw SQL).
 */
export const FRONTEND_TAG = 'frontend-data'

/**
 * Caches a public page's data for `revalidate` seconds (default 5 min), keyed by `key` — which must
 * include every input the loader reads (ids, page numbers, filters). The home, projects
 * and posts pages are force-dynamic, so without this every anonymous request re-ran
 * their queries; under a burst of 20 requests the home page took ~1.5 s at the median.
 *
 * The result goes through JSON: return plain data (no Map, Date or class instances).
 */
export function cachedQuery<T>(key: string, load: () => Promise<T>, revalidate = 300): Promise<T> {
  return unstable_cache(load, ['frontend', key], { revalidate, tags: [FRONTEND_TAG] })()
}
