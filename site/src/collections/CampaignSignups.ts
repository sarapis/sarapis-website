import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { siteField } from '../fields/siteField'

/**
 * CampaignSignups — email capture from campaign forms (WeGov's "Get Updates").
 * Slug matches Strapi's `campaign-signups` so the front-end only swaps the API
 * host, not the path. Anonymous create; read/manage admin-only; honeypot rejects
 * bots. `email` is NOT unique (a person may follow multiple campaigns).
 */
export const CampaignSignups: CollectionConfig = {
  slug: 'campaign-signups',
  labels: { singular: 'Campaign Signup', plural: 'Campaign Signups' },
  access: { create: anyone, delete: authenticated, read: authenticated, update: authenticated },
  admin: {
    useAsTitle: 'email',
    group: 'Submissions',
    defaultColumns: ['email', 'campaign', 'site', 'createdAt'],
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.website) throw new Error('Invalid submission')
        if (data) delete data.website
        return data
      },
    ],
  },
  fields: [
    { name: 'email', type: 'email', required: true },
    { name: 'campaign', type: 'text', admin: { description: 'Campaign key the signup came from, e.g. "un-open-source".' } },
    { name: 'source', type: 'text', maxLength: 200, admin: { description: 'Originating path, e.g. "/unnyc#open-source".' } },
    siteField({ hasMany: false, required: false }),
    // Honeypot — accepted into the payload, validated away in beforeValidate, never stored.
    { name: 'website', type: 'text', virtual: true, admin: { hidden: true } },
  ],
}
