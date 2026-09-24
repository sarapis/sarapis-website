import type { Field } from 'payload'

/**
 * `sites` / `site` — the multi-brand scoping field, a relationship to the `sites`
 * registry (sarapis / wegovnyc / databook / ctfg).
 *
 * Content collections (Posts, Pages, Events) use the **hasMany** form named
 * `sites`: an editor selects one OR MORE brands, and the content is published on
 * every selected brand's front-end. A front-end fetches its brand's content with
 * `where[sites][in]=<siteId>` (matches any doc whose `sites` includes that brand).
 *
 * Submission collections (campaign signups/endorsements) use the **single** form
 * named `site`: a submission originates from exactly one brand.
 *
 * Optional by design: unset means the Sarapis default brand, and content is
 * backfilled to explicit brand(s) during migration. Kept optional (not required)
 * so existing content stays editable and the template demo seed still builds —
 * scoping is enforced by the per-brand query filter, not a required FK.
 *
 * Return type is the broad `Field` to sidestep the relationship discriminated-union
 * strictness (hasMany true/false are different subtypes); the object is a valid
 * relationship field either way.
 */
export const siteField = (
  opts: { hasMany?: boolean; required?: boolean; description?: string } = {},
): Field => {
  const hasMany = opts.hasMany ?? true
  return {
    name: hasMany ? 'sites' : 'site',
    type: 'relationship',
    relationTo: 'sites',
    hasMany,
    required: opts.required ?? false,
    index: true,
    admin: {
      position: 'sidebar',
      description:
        opts.description ??
        (hasMany
          ? 'Brands this content is published on — select one or more.'
          : 'Brand this submission came from.'),
    },
  }
}
