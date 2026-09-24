import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { authenticatedField } from '../access/authenticatedField'
import { publishedOnly } from '../access/publishedOnly'
import { siteField } from '../fields/siteField'

/**
 * CampaignEndorsements — signatures for a campaign, as an individual or an
 * organization (WeGov's "The World is Going Open Source" endorsers). Slug matches
 * Strapi's `campaign-endorsements` so the front-end only swaps the API host.
 * Anonymous create; PUBLIC read of `published` docs only; manage admin-only.
 * Private fields (email, contactName, source, wantsUpdates) are withheld from
 * anonymous reads by field-level access — see the note on `email`.
 *
 * NB: `website` is a REAL field here (an org's site), so the honeypot is `fax`
 * (never rendered to humans) rather than `website` as in the other write collections.
 */
export const CampaignEndorsements: CollectionConfig = {
  slug: 'campaign-endorsements',
  labels: { singular: 'Campaign Endorsement', plural: 'Campaign Endorsements' },
  // read is publishedOnly, NOT authenticated: the endorser wall on
  // unnyc.wegov.nyc/campaign/sign is public and fetches this anonymously. It was
  // `authenticated`, so every anonymous read 403'd and the wall rendered empty —
  // the page catches the error and falls back to [], so it failed silently and
  // had never displayed a single signature. `published` (default false) is the
  // review gate the front-end docs always claimed existed.
  access: { create: anyone, delete: authenticated, read: publishedOnly, update: authenticated },
  admin: {
    useAsTitle: 'name',
    group: 'Submissions',
    defaultColumns: ['name', 'kind', 'published', 'organization', 'campaign', 'createdAt'],
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.fax) throw new Error('Invalid submission')
        if (data) delete data.fax
        return data
      },
    ],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'individual',
      options: [
        { label: 'Individual', value: 'individual' },
        { label: 'Organization', value: 'organization' },
      ],
    },
    { name: 'name', type: 'text', required: true, admin: { description: 'Person name, or organization name when kind=organization.' } },
    /* ⚠ FIELD-LEVEL ACCESS. Introduced here because collection read is now
       public: without it, `GET /api/campaign-endorsements` would hand every
       signer's email address to anyone who asked. Payload omits these fields
       entirely for anonymous requests. The endorser wall renders only kind,
       name, website, title and organization, so none of this is missed.
       Keep this list in step with anything genuinely private. */
    { name: 'email', type: 'email', required: true, access: { read: authenticatedField } },
    { name: 'title', type: 'text', admin: { description: 'Job title (individuals).' } },
    { name: 'organization', type: 'text', admin: { description: 'Affiliation (individuals).' } },
    { name: 'website', type: 'text', admin: { description: 'Organization website (organizations).' } },
    { name: 'contactName', type: 'text', access: { read: authenticatedField }, admin: { description: 'Contact person (organizations). PRIVATE — the org name is public, its staff are not.' } },
    { name: 'campaign', type: 'text' },
    /* Formal ORGANIZATION endorsements carry a description of what the org is
       already doing, plus a per-submission consent flag governing whether that
       description may be published. Both are withheld from anonymous reads:
       field access cannot be made conditional on another field's value, so a
       human decides what to surface rather than the API guessing. */
    {
      name: 'activity',
      type: 'textarea',
      access: { read: authenticatedField },
      admin: { description: 'Relevant activity in support of the Principles (organizations). PRIVATE — publish only if activityConsent is set.' },
    },
    {
      name: 'activityConsent',
      type: 'checkbox',
      defaultValue: false,
      access: { read: authenticatedField },
      admin: { description: 'Did the submitter consent to their activity description being made public?' },
    },
    { name: 'source', type: 'text', maxLength: 200, access: { read: authenticatedField } },
    { name: 'wantsUpdates', type: 'checkbox', defaultValue: false, access: { read: authenticatedField } },
    /* ⚠ The review gate, so only a logged-in user may set it. Collection create
       is `anyone`, and without field-level create access an anonymous POST with
       `"published": true` approved ITSELF straight onto the public wall. Denied
       create access drops the value and the default (false) applies. Collection
       update is already authenticated-only. */
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: false,
      access: { create: authenticatedField },
      admin: { position: 'sidebar', description: 'Public front-ends only show published items. Approving a submission here is what puts it on the endorser wall.' },
    },
    siteField({ hasMany: false, required: false }),
    // Honeypot (see note above) — validated away in beforeValidate, never stored.
    { name: 'fax', type: 'text', virtual: true, admin: { hidden: true } },
  ],
}
