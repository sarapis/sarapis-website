import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

/**
 * Tasks — native to Payload (mirrors the Sarapis task app's fields). Managed in
 * admin; flip `publishToActivity` to surface one into the Activity feed.
 * Read access is authenticated-only so unpublished/internal tasks aren't exposed
 * over the public API — the Activity page reads them server-side and filters.
 */
export const Tasks: CollectionConfig = {
  slug: 'tasks',
  access: { create: authenticated, delete: authenticated, read: authenticated, update: authenticated },
  admin: { useAsTitle: 'title', group: 'Activity', defaultColumns: ['title', 'status', 'scope', 'publishToActivity'] },
  fields: [
    { name: 'title', type: 'text', required: true, admin: { description: 'The card headline (maps to the task app "description").' } },
    { name: 'body', type: 'textarea', admin: { description: 'Longer description (maps to "more_info").' } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'Idea',
      options: ['Idea', 'Open', 'In Progress', 'Review', 'Done'].map((v) => ({ label: v, value: v })),
    },
    {
      name: 'list',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Backburner', value: 'backburner' },
      ],
    },
    {
      name: 'scope',
      type: 'select',
      defaultValue: 'Sarapis',
      options: ['Sarapis', 'GridMarket', 'Personal'].map((v) => ({ label: v, value: v })),
    },
    { name: 'project', type: 'relationship', relationTo: 'projects' },
    {
      name: 'artifacts',
      type: 'array',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'filename', type: 'text' },
        { name: 'url', type: 'text' },
      ],
    },
    { name: 'priority', type: 'number', admin: { position: 'sidebar' } },
    { name: 'starred', type: 'checkbox', admin: { position: 'sidebar' } },
    { name: 'source', type: 'text', admin: { position: 'sidebar' } },
    { name: 'createdBy', type: 'text', admin: { position: 'sidebar' } },
    {
      name: 'publishToActivity',
      type: 'checkbox',
      defaultValue: false,
      label: 'Publish to Activity',
      admin: { position: 'sidebar' },
    },
    { name: 'pinned', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}
