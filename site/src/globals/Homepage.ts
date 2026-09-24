import type { GlobalConfig } from 'payload'

/**
 * Homepage — editorial content for the single-page site (route `/`).
 *
 * The data-dense sections (Recent News, Activities, Projects) pull live from the
 * Posts / ActivityEvents / KnowledgeItems / Tasks / Projects collections. This
 * global holds only the *editorial* copy that has no natural collection: the
 * hero, the Services offerings, the Case Studies, and the About block — so they
 * stay editable in the admin without a deploy.
 */
export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Homepage',
  access: { read: () => true },
  admin: { group: 'Site' },
  fields: [
    {
      type: 'group',
      name: 'hero',
      fields: [
        { name: 'eyebrow', type: 'text', defaultValue: 'Building since 2010' },
        {
          name: 'title',
          type: 'text',
          required: true,
          defaultValue: 'Open Source Good',
        },
        {
          name: 'lead',
          type: 'textarea',
          defaultValue:
            'Sarapis advances the movement for open source abundance by building practical solutions for people doing good in New York City and beyond.',
        },
        { name: 'primaryCtaLabel', type: 'text', defaultValue: 'Let’s talk' },
        { name: 'primaryCtaHref', type: 'text', defaultValue: '#contact' },
        { name: 'secondaryCtaLabel', type: 'text', defaultValue: 'About Us' },
        { name: 'secondaryCtaHref', type: 'text', defaultValue: '/about' },
      ],
    },
    {
      type: 'array',
      name: 'services',
      label: 'Services',
      admin: { description: 'Numbered offerings. Each becomes an anchored section on /services.' },
      fields: [
        { name: 'number', type: 'text', admin: { width: '20%' } },
        { name: 'slug', type: 'text', admin: { width: '30%', description: 'URL anchor on /services (e.g. solution-delivery).' } },
        { name: 'title', type: 'text', required: true },
        { name: 'blurb', type: 'textarea', admin: { description: 'Short line shown in the home Services catalog.' } },
        { name: 'description', type: 'textarea', admin: { description: 'Fuller explanation shown in this service’s section on /services.' } },
        { name: 'href', type: 'text', admin: { hidden: true } },
      ],
    },
    {
      type: 'array',
      name: 'caseStudies',
      label: 'Case Studies',
      admin: { description: 'Example work. Set “service” to group a case study under a service on /services.' },
      fields: [
        { name: 'type', type: 'text', admin: { width: '33%' } },
        { name: 'source', type: 'text', admin: { width: '33%' } },
        { name: 'service', type: 'text', admin: { width: '33%', description: 'Slug of the related service (e.g. solution-delivery) — groups it on /services.' } },
        { name: 'title', type: 'text', required: true },
        { name: 'href', type: 'text', defaultValue: '#' },
      ],
    },
    {
      type: 'array',
      name: 'board',
      label: 'Board of Directors',
      admin: { description: 'Shown on /about. Order here is display order.' },
      fields: [
        { name: 'name', type: 'text', required: true, admin: { width: '50%' } },
        { name: 'role', type: 'text', admin: { width: '50%', description: 'e.g. Principal, Director. Leave blank for plain members.' } },
        { name: 'bio', type: 'textarea' },
        { name: 'link', type: 'text', admin: { description: 'Optional personal/work URL.' } },
      ],
    },
    {
      type: 'group',
      name: 'about',
      fields: [
        {
          name: 'lede',
          type: 'textarea',
          defaultValue:
            'We help nonprofits and government agencies leverage open source software and open data to work transparently and democratically.',
        },
        {
          name: 'paragraphs',
          type: 'array',
          fields: [{ name: 'text', type: 'textarea', required: true }],
        },
        {
          name: 'facts',
          type: 'array',
          fields: [
            { name: 'key', type: 'text', required: true, admin: { width: '40%' } },
            { name: 'value', type: 'text', required: true },
          ],
        },
      ],
    },
  ],
}
