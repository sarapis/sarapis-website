import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

/**
 * EmailSignups — addresses from the "Support Us" signup on the /about page.
 * Anonymous create (the form POSTs to /api/email-signups); read/manage is
 * admin-only. Mirrors ContactSubmissions: a hidden honeypot silently rejects
 * bots server-side. `email` is unique so a repeat submission is a no-op the
 * client surfaces as "already subscribed".
 */
export const EmailSignups: CollectionConfig = {
  slug: 'email-signups',
  labels: { singular: 'Email Signup', plural: 'Email Signups' },
  access: { create: anyone, delete: authenticated, read: authenticated, update: authenticated },
  admin: { useAsTitle: 'email', group: 'Site', defaultColumns: ['email', 'source', 'createdAt'] },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        // Honeypot: real users never fill "website". Reject silently-ish (400) on bots.
        if (data?.website) throw new Error('Invalid submission')
        if (data) delete data.website
        return data
      },
    ],
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'source', type: 'text', maxLength: 100, admin: { description: 'Where the signup came from (e.g. about-support).' } },
    // Honeypot — accepted into the create payload, validated in beforeValidate, never stored.
    { name: 'website', type: 'text', virtual: true, admin: { hidden: true } },
  ],
}
