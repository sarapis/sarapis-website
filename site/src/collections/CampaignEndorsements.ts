import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { authenticatedField } from '../access/authenticatedField'
import { publicUnlessHidden } from '../access/publicUnlessHidden'
import { publishedOnly } from '../access/publishedOnly'
import { siteField } from '../fields/siteField'
import { notifyNewEndorsement } from '../hooks/notifyNewEndorsement'
import { campaignEndorsementEmails } from '../hooks/campaignEmails'

/**
 * CampaignEndorsements — signatures for a campaign, as an individual or an
 * organization (WeGov's "The World is Going Open Source" endorsers, and the
 * ospo.opensource.nyc endorsements, `campaign: 'nyc-ospo'`). Slug matches
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
    defaultColumns: ['name', 'kind', 'published', 'displayPublicly', 'organization', 'campaign', 'createdAt'],
  },
  hooks: {
    // An email to the reviewers per new endorsement, once configured; and,
    // for a campaign that sends email, a thank-you to the endorser and a note
    // when it is published (src/lib/campaignEmail.ts).
    afterChange: [notifyNewEndorsement, campaignEndorsementEmails],
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
    { name: 'name', type: 'text', required: true, access: { read: publicUnlessHidden }, admin: { description: 'Person name, or organization name when kind=organization.' } },
    /* ⚠ FIELD-LEVEL ACCESS. Introduced here because collection read is now
       public: without it, `GET /api/campaign-endorsements` would hand every
       signer's email address to anyone who asked. Payload omits these fields
       entirely for anonymous requests. The endorser wall renders only kind,
       name, website, title and organization, so none of this is missed.
       Keep this list in step with anything genuinely private. */
    { name: 'email', type: 'email', required: true, access: { read: authenticatedField } },
    { name: 'title', type: 'text', access: { read: publicUnlessHidden }, admin: { description: 'Job title (individuals).' } },
    { name: 'organization', type: 'text', access: { read: publicUnlessHidden }, admin: { description: 'Affiliation (individuals).' } },
    { name: 'website', type: 'text', access: { read: publicUnlessHidden }, admin: { description: 'Organization website (organizations).' } },
    { name: 'contactName', type: 'text', access: { read: authenticatedField }, admin: { description: 'Contact person (organizations). PRIVATE — the org name is public, its staff are not.' } },
    { name: 'campaign', type: 'text' },
    /* PUBLIC DISPLAY CONSENT, asked on every new form (ospo.opensource.nyc):
       an individual's "show my name publicly", an organization's "you may show
       our name and logo". Only an explicit `false` hides: the identifying
       fields (name, title, organization, website, quote, logo) are then
       withheld from anonymous reads by `publicUnlessHidden`, while the entry
       still counts. No default on purpose — older entries hold NULL and stay
       visible, as they were when submitted. */
    {
      name: 'displayPublicly',
      type: 'checkbox',
      admin: { description: 'Did the signer agree to be shown publicly (organizations: name AND logo)? Unchecked by the signer = counted but not named on the public wall. Empty on entries from before this question existed (shown).' },
    },
    /* A personal message of support, shown beside the name (OSI-style
       "statements of support"). Published with the entry, so the approver
       reads it before ticking `published`. */
    {
      name: 'quote',
      type: 'textarea',
      maxLength: 600,
      access: { read: publicUnlessHidden },
      admin: { description: 'Optional message of support. PUBLIC once the entry is published — read it before approving.' },
    },
    /* Organizations' logos. The public cannot upload to Media, so the form
       sends a LINK (`logoUrl`, private); the approver downloads it, uploads it
       to Media and attaches it here. Anonymous create may not set `logo`, or a
       submitter could attach any existing media file to their entry. */
    {
      name: 'logoUrl',
      type: 'text',
      maxLength: 500,
      access: { read: authenticatedField },
      admin: { description: 'Logo link the organization submitted (organizations). PRIVATE — use it to upload the file below.' },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      access: { create: authenticatedField, read: publicUnlessHidden },
      admin: { description: 'The logo shown on the endorser wall (organizations). Upload from the submitted link, only if they agreed to be shown publicly.' },
    },
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
