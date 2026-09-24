import type { FieldAccess } from 'payload'

/**
 * FIELD-level "logged in only", for withholding a single field from anonymous
 * reads while the collection itself is publicly readable.
 *
 * Distinct from `authenticated` on purpose: that one is typed `Access` for
 * collection-level rules, and Payload's field access has a different signature
 * (`FieldAccess` — it also receives the sibling data). Passing the collection
 * helper to a field's `access` fails to typecheck, which is how this file came
 * to exist.
 *
 * Unlike a collection rule, a field rule cannot return a query constraint — it
 * is a plain boolean. Returning false omits the field from the response
 * entirely rather than nulling it.
 *
 * First used by CampaignEndorsements, where collection read is public (the
 * endorser wall) but `email` must never leave the admin.
 */
export const authenticatedField: FieldAccess = ({ req: { user } }) => {
  return Boolean(user)
}
