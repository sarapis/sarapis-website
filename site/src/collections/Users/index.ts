import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

const sameEmail = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: true,
  hooks: {
    // A pass vouches for an email: re-pointing a granted account at another address must
    // not carry it over. (By here `data.collabPass` is the stored value: field access has
    // already replaced whatever the request sent.)
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        if (operation === 'update' && data.email !== undefined && !sameEmail(data.email, originalDoc?.email)) {
          data.collabPass = false
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      // Gates "Sign in with the CMS" (src/endpoints/collab-pass.ts). Any signed-in user can
      // create users and change emails here, unverified, so only a maintainer may set it,
      // out of band (see deploy/migration-round46.sql). Changing the email clears it.
      name: 'collabPass',
      type: 'checkbox',
      defaultValue: false,
      access: { create: () => false, update: () => false },
      admin: {
        description:
          'May sign in to collab sites (comms-strat…) as this email. Set by a maintainer only; cleared when the email changes.',
      },
    },
  ],
  timestamps: true,
}
