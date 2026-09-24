import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedOnly } from '../access/publishedOnly'
import { siteField } from '../fields/siteField'

/**
 * NewsItems — short "in the news" cards: an external headline with a source,
 * excerpt and link. Brand-scoped like Events (a card can appear on several
 * brands). Public read is gated to `published: true`.
 *
 * `dateLabel` is the human string shown on the card ("Q1 2025", "May 2026");
 * `sortDate` is the machine-readable ISO date used to order newest-first, so
 * fuzzy labels don't break sorting.
 */
export const NewsItems: CollectionConfig = {
  slug: 'news-items',
  labels: { singular: 'News Item', plural: 'News Items' },
  access: { create: authenticated, delete: authenticated, read: publishedOnly, update: authenticated },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'source', 'sites', 'sortDate', 'published'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    siteField(),
    { name: 'source', type: 'text', admin: { description: 'Publication or organisation, e.g. "NYC Mayor\'s Office".' } },
    { name: 'excerpt', type: 'textarea' },
    { name: 'link', type: 'text', admin: { description: 'External URL the card links to.' } },
    {
      name: 'dateLabel',
      type: 'text',
      admin: { description: 'Date as displayed, e.g. "Q1 2025" or "May 2026".' },
    },
    {
      name: 'sortDate',
      type: 'date',
      admin: {
        description: 'Machine-readable date used for newest-first ordering.',
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Public front-ends only show published items.' },
    },
  ],
}
