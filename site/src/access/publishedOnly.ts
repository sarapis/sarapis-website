import type { Access } from 'payload'

/**
 * Anonymous requests may only read docs with `published: true`; authenticated
 * users read everything. The Activity collections' curation gate — without this,
 * the public REST/GraphQL API exposes unpublished (uncurated) docs even though
 * the /activity page filters on `published`.
 *
 * Same pattern as `authenticatedOrPublished`, but for collections that use a
 * `published` checkbox instead of drafts/`_status`.
 */
export const publishedOnly: Access = ({ req: { user } }) => {
  if (user) {
    return true
  }

  return {
    published: {
      equals: true,
    },
  }
}
