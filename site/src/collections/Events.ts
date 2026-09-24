import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedOnly } from '../access/publishedOnly'
import { siteField } from '../fields/siteField'

/**
 * Events — brand-scoped calendar/announcement items. Migrated 1:1 from WeGov's
 * Strapi `events` type (title, category, start/end, dateLabel, location, link,
 * description). Public read is gated to `published: true` (curate in admin).
 */
export const Events: CollectionConfig = {
  slug: 'events',
  labels: { singular: 'Event', plural: 'Events' },
  access: { create: authenticated, delete: authenticated, read: publishedOnly, update: authenticated },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'sites', 'startDate', 'published'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    siteField(),
    { name: 'description', type: 'textarea' },
    { name: 'category', type: 'text' },
    { name: 'startDate', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'endDate', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'dateLabel',
      type: 'text',
      admin: { description: 'Free-text date display, e.g. "Sept 2026" (overrides the computed range).' },
    },
    { name: 'location', type: 'text' },
    { name: 'link', type: 'text' },
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Public front-ends only show published events.' },
    },
  ],
}
