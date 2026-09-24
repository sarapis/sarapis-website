import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Create an admin user, or RESET the password of an existing one.
 *
 *   ADMIN_EMAIL=you@example.org ADMIN_PASSWORD='…' pnpm payload run scripts/create-admin.ts
 *
 * Both values are required and deliberately have no defaults: this script
 * overwrites the password of any user matching ADMIN_EMAIL, so a baked-in
 * fallback would quietly reset a real account to a publicly known value.
 */
const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD.')
  process.exit(1)
}

const payload = await getPayload({ config })
const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1 })
if (existing.docs.length) {
  await payload.update({ collection: 'users', id: (existing.docs[0] as any).id, data: { password } })
  console.log('admin password reset for', email)
} else {
  await payload.create({ collection: 'users', data: { email, password, name: email.split('@')[0] } as any })
  console.log('admin created:', email)
}
