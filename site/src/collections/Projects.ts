import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedOnly } from '../access/publishedOnly'

const FOCUS_AREAS = [
  { label: 'Open Government', value: 'open-government' },
  { label: 'Human Services', value: 'human-services' },
  { label: 'Emergency Management', value: 'emergency-management' },
  { label: 'Collaborative Economy', value: 'collaborative-economy' },
]

/**
 * Blank means blank: trim on save and store NULL rather than an empty/whitespace
 * string. The front end hides these fields when they're falsy, and in JS `""` is
 * falsy but `" "` is NOT — so a single stray space typed in /admin would render
 * an orphaned "PROJECT LEADER" label with no value on all three surfaces
 * (profile header, list cards, child rows). Normalizing here fixes it once for
 * every consumer, including the REST API, instead of six render-site guards.
 */
const blankToNull = [
  ({ value }: { value?: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
]

/**
 * Projects — the manually-curated spine of the Activity page. Repos, knowledge
 * items, and tasks link to a project; project metrics roll up from those.
 */
export const Projects: CollectionConfig = {
  slug: 'projects',
  access: { create: authenticated, delete: authenticated, read: publishedOnly, update: authenticated },
  admin: { useAsTitle: 'name', group: 'Activity', defaultColumns: ['name', 'status', 'focusArea', 'published'] },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Declared', value: 'declared' },
        { label: 'Active', value: 'active' },
        { label: 'Reached', value: 'reached' },
      ],
    },
    { name: 'focusArea', type: 'select', options: FOCUS_AREAS },
    {
      name: 'region',
      type: 'select',
      defaultValue: 'nyc',
      options: [
        { label: 'New York City', value: 'nyc' },
        { label: 'Global', value: 'global' },
      ],
      admin: { description: 'Which region tab this project shows under on the home Projects section.' },
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'standalone',
      options: [
        { label: 'Flagship (a parent that integrates apps)', value: 'flagship' },
        { label: 'Integrated app / child', value: 'child' },
        { label: 'Standalone', value: 'standalone' },
      ],
      admin: { description: 'Lineage role. Children nest under their flagship parent.' },
    },
    {
      name: 'lineage',
      type: 'text',
      admin: { description: 'Optional lineage chip, e.g. "Experiment → App → Integrated".' },
    },
    {
      name: 'site',
      type: 'text',
      label: 'Project website',
      admin: { description: 'Public site URL (shown as the ↗ project-home link), e.g. databook.nyc.' },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'projects',
      label: 'Child of',
      admin: { description: 'Parent project — organizes projects into a tree.' },
      validate: (value: any, { id }: { id?: string | number }) =>
        value && id && String(value) === String(id) ? 'A project cannot be its own parent.' : true,
    },
    { name: 'summary', type: 'textarea' },
    {
      name: 'projectLeader',
      type: 'text',
      label: 'Project leader',
      hooks: { beforeValidate: blankToNull },
      admin: { description: 'Person who leads this project. Shown in the profile header, the projects list cards, and the child rows. Leave blank to hide it.' },
    },
    {
      name: 'sarapisRole',
      type: 'text',
      label: 'Sarapis role',
      hooks: { beforeValidate: blankToNull },
      admin: {
        description:
          "What Sarapis does on this project, e.g. stewardship, hosting, development. Shown in the profile header. NOT the 'Lineage role' field above (flagship/child/standalone) - that one is about how projects nest.",
      },
    },
    { name: 'workspaceTags', type: 'text', hasMany: true, admin: { description: 'Free-text workspace labels (e.g. Databook2).' } },
    {
      name: 'repos',
      type: 'join',
      collection: 'repos',
      on: 'project',
      label: 'Repositories',
      admin: {
        description: 'Repos under this project — create, edit, and remove inline.',
        allowCreate: true,
        defaultColumns: ['fullName', 'lastPushedAt', 'published'],
      },
    },
    {
      name: 'driveFolderId',
      type: 'text',
      admin: { position: 'sidebar', description: 'Google Drive folder id (Phase 4 — drive-sync).' },
    },
    { name: 'published', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    { name: 'pinned', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}
