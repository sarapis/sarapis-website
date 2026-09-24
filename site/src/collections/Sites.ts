import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

/**
 * Sites — the brand registry for the multi-brand CMS. One document per site the
 * single Payload instance powers (sarapis, wegovnyc, databook, ctfg). Replaces
 * Strapi's per-site `global` singleton, but as documents so it scales to N brands.
 *
 * Each brand's front-end reads its Site doc (nav, footer, SEO defaults, logo) and
 * filters content collections by `site` (see src/fields/siteField.ts). `read` is
 * public so an unauthenticated front-end can fetch its brand config; writes are
 * admin-only.
 */
export const Sites: CollectionConfig = {
  slug: 'sites',
  labels: { singular: 'Site', plural: 'Sites' },
  access: { create: authenticated, delete: authenticated, read: anyone, update: authenticated },
  admin: {
    useAsTitle: 'name',
    group: 'Brands',
    defaultColumns: ['name', 'key', 'domain'],
    description:
      'Brand registry — one doc per site the CMS powers (sarapis, wegovnyc, databook, ctfg).',
  },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Display name, e.g. "WeGov NYC".' } },
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Stable slug used in API filters, e.g. "wegovnyc". Lowercase, no spaces.',
      },
    },
    { name: 'domain', type: 'text', admin: { description: 'Primary domain, e.g. "wegov.nyc".' } },
    { name: 'siteName', type: 'text', admin: { description: 'Site title / wordmark (header + SEO).' } },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'nav',
      type: 'array',
      labels: { singular: 'Nav link', plural: 'Nav links' },
      admin: { description: 'Primary navigation for this brand.' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'href', type: 'text', required: true },
      ],
    },
    {
      name: 'footer',
      type: 'group',
      fields: [
        { name: 'tagline', type: 'textarea' },
        {
          name: 'links',
          type: 'array',
          labels: { singular: 'Footer link', plural: 'Footer links' },
          fields: [
            { name: 'label', type: 'text', required: true },
            { name: 'href', type: 'text', required: true },
          ],
        },
      ],
    },
    {
      name: 'defaultSeo',
      type: 'group',
      label: 'Default SEO',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'image', type: 'upload', relationTo: 'media' },
      ],
    },
  ],
}
