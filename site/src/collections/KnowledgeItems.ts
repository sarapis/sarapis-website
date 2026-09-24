import type { CollectionConfig } from 'payload'

import { publishedOnly } from '../access/publishedOnly'
import { authenticated } from '../access/authenticated'

/**
 * KnowledgeItems — captured via the admin form or the `sarapis-kb` CLI (Phase 3).
 * A knowledge item is either an external link or an uploaded artifact (.md/.html).
 * One of the three Activity-feed sources.
 */
export const KnowledgeItems: CollectionConfig = {
  slug: 'knowledge-items',
  labels: { singular: 'Knowledge Item', plural: 'Knowledge Items' },
  access: { create: authenticated, delete: authenticated, read: publishedOnly, update: authenticated },
  admin: { useAsTitle: 'title', group: 'Activity', defaultColumns: ['title', 'kind', 'date', 'published'] },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'link',
      options: [
        { label: 'Link', value: 'link' },
        { label: 'Artifact', value: 'artifact' },
      ],
    },
    { name: 'url', type: 'text', admin: { condition: (_, s) => s?.kind === 'link', description: 'External URL.' } },
    { name: 'artifact', type: 'upload', relationTo: 'media', admin: { condition: (_, s) => s?.kind === 'artifact' } },
    {
      name: 'fileType',
      type: 'select',
      admin: { condition: (_, s) => s?.kind === 'artifact' },
      options: [
        { label: '.MD', value: 'md' },
        { label: '.HTML', value: 'html' },
        { label: 'Doc', value: 'doc' },
      ],
    },
    { name: 'summary', type: 'textarea' },
    { name: 'date', type: 'date', defaultValue: () => new Date().toISOString() },
    { name: 'project', type: 'relationship', relationTo: 'projects' },
    { name: 'published', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    { name: 'pinned', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}
