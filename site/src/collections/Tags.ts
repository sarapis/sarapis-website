import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

/**
 * Tags — lightweight, reusable labels for Posts (finer-grained than categories).
 * Public read; managed by authenticated admins. Each tag has a slug so it can
 * drive a filter on /posts (?tag=<slug>).
 */
export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Tag', plural: 'Tags' },
  access: { create: authenticated, delete: authenticated, read: anyone, update: authenticated },
  admin: { useAsTitle: 'title', group: 'Content', defaultColumns: ['title', 'slug'] },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { description: 'URL-safe id (auto-derived from the title if left blank).' },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            const base = value || data?.title || ''
            return String(base).toLowerCase().trim().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '')
          },
        ],
      },
    },
  ],
}
