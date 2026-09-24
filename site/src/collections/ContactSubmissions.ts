import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

/**
 * ContactSubmissions — messages from the public "Let's talk" form on the home page.
 * Anonymous create (the form POSTs to /api/contact-submissions); read/manage is
 * admin-only. A hidden honeypot field silently rejects bot submissions server-side.
 */
export const ContactSubmissions: CollectionConfig = {
  slug: 'contact-submissions',
  labels: { singular: 'Contact Submission', plural: 'Contact Submissions' },
  access: { create: anyone, delete: authenticated, read: authenticated, update: authenticated },
  admin: { useAsTitle: 'name', group: 'Site', defaultColumns: ['name', 'email', 'createdAt'] },
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
    { name: 'name', type: 'text', required: true, maxLength: 200 },
    { name: 'email', type: 'email', required: true },
    { name: 'message', type: 'textarea', required: true, maxLength: 5000 },
    // Honeypot — accepted into the create payload, validated in beforeValidate, never stored.
    { name: 'website', type: 'text', virtual: true, admin: { hidden: true } },
  ],
}
