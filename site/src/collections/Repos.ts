import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedOnly } from '../access/publishedOnly'

/**
 * Repos — GitHub-synced source data (Phase 2 github-sync upserts by fullName).
 * `project`, `focusArea`, `published`, `pinned` are editorial and never
 * overwritten by the sync.
 */
export const Repos: CollectionConfig = {
  slug: 'repos',
  access: { create: authenticated, delete: authenticated, read: publishedOnly, update: authenticated },
  // Hidden from the nav — managed inline from the Project edit page via the `repos` join field.
  admin: { useAsTitle: 'fullName', group: 'Activity', hidden: true, defaultColumns: ['fullName', 'lastPushedAt', 'published'] },
  fields: [
    // ---- GitHub-synced — read-only in the CMS (the sync writes via the API) ----
    // `readOnly: true` here made the join-field "Add repo" drawer UNUSABLE: this is
    // the only required field, so rendering it uneditable meant a manual create
    // could never satisfy validation. Field-level access gives the behaviour that
    // was actually wanted — settable on CREATE, frozen afterwards — and the sync
    // still writes it because every sync call passes `overrideAccess: true`, which
    // skips field access.
    {
      name: 'fullName',
      type: 'text',
      required: true,
      unique: true,
      access: { update: () => false },
      admin: { description: 'owner/repo — the sync key. Set it when adding a repo by hand; it cannot be changed afterwards (renaming it would orphan the synced events).' },
    },
    { name: 'description', type: 'textarea', admin: { readOnly: true } },
    { name: 'url', type: 'text', admin: { readOnly: true } },
    { name: 'lastPushedAt', type: 'date', admin: { readOnly: true } },
    // ---- Editable in the CMS ----
    { name: 'project', type: 'relationship', relationTo: 'projects' },
    {
      name: 'focusArea',
      type: 'select',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Open Government', value: 'open-government' },
        { label: 'Human Services', value: 'human-services' },
        { label: 'Emergency Management', value: 'emergency-management' },
        { label: 'Collaborative Economy', value: 'collaborative-economy' },
      ],
    },
    { name: 'published', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    { name: 'pinned', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}
