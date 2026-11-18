import type { FieldAccess } from 'payload'

/**
 * FIELD-level read rule for an endorser's identifying fields (name, title,
 * organization, website, quote, logo): public, unless the signer said not to
 * show them (`displayPublicly: false`). Signed-in users always see everything.
 *
 * Payload calls a field's read access in two ways, and this rule answers each:
 *
 *  - Reading a document (afterRead): `siblingData`/`doc` is that document, so
 *    the answer can depend on its `displayPublicly`. A hidden signer still
 *    counts (kind, campaign stay public) but reaches the public as a row with
 *    no name.
 *  - Building permissions for a `where` query: there is no document. Answering
 *    false there means an anonymous request cannot FILTER on these fields,
 *    which would otherwise reveal a hidden signer by name
 *    (`?where[name][equals]=…` returning one result). No front-end filters on
 *    them; they filter on `campaign`, `kind` and `published`.
 *
 * `displayPublicly` has no default, and only an explicit `false` hides: older
 * entries (UNNYC's wall) predate the field, hold NULL, and stay visible.
 */
export const publicUnlessHidden: FieldAccess = ({ req: { user }, doc, siblingData }) => {
  if (user) return true
  const entry = siblingData ?? doc
  if (!entry) return false
  return entry.displayPublicly !== false
}
