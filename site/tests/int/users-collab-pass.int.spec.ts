import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'

import type { User } from '@/payload-types'

/**
 * "Sign in with the CMS" (src/endpoints/collab-pass.ts) vouches for a user's EMAIL to a
 * collab site whose roster trusts the email alone. Any signed-in user here can create users
 * and change emails, with no verification, so the endpoint only mints for `collabPass` users,
 * and these access rules are what make that flag mean something:
 *
 *  1. no request can set it (create or update): only a maintainer, out of band, can;
 *  2. changing a user's email clears it, so a granted account can't be re-pointed at
 *     someone else's address.
 *
 * Writes run with `overrideAccess: false` and a signed-in `user`, i.e. what any CMS editor
 * gets through /admin or REST.
 */
let payload: Payload
let editor: User
const created: number[] = []
const tag = Date.now()

const make = async (email: string, data: Record<string, unknown> = {}) => {
  const doc = (await payload.create({
    collection: 'users',
    data: { email, password: 'test-password-1234', ...data },
    overrideAccess: true,
  })) as User
  created.push(doc.id)
  return doc
}
const stored = async (id: number) =>
  (await payload.findByID({ collection: 'users', id, overrideAccess: true })) as User

describe('users.collabPass', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    editor = await make(`editor-${tag}@example.invalid`)
  })

  afterAll(async () => {
    for (const id of created) await payload.delete({ collection: 'users', id, overrideAccess: true })
  })

  it('ignores `collabPass: true` when a signed-in user creates an account', async () => {
    const doc = (await payload.create({
      collection: 'users',
      data: { email: `victim-${tag}@example.invalid`, password: 'test-password-1234', collabPass: true },
      user: editor,
      overrideAccess: false,
    })) as User
    created.push(doc.id)
    expect((await stored(doc.id)).collabPass).toBe(false)
  })

  it('ignores `collabPass: true` when a signed-in user updates an account, even their own', async () => {
    await payload.update({ collection: 'users', id: editor.id, data: { collabPass: true }, user: editor, overrideAccess: false })
    expect((await stored(editor.id)).collabPass).toBe(false)
  })

  it('clears the pass when the email changes', async () => {
    const granted = await make(`granted-${tag}@example.invalid`, { collabPass: true })
    expect(granted.collabPass).toBe(true)

    await payload.update({ collection: 'users', id: granted.id, data: { name: 'Renamed' }, user: editor, overrideAccess: false })
    expect((await stored(granted.id)).collabPass).toBe(true)

    await payload.update({
      collection: 'users',
      id: granted.id,
      data: { email: `someone-else-${tag}@example.invalid` },
      user: editor,
      overrideAccess: false,
    })
    expect((await stored(granted.id)).collabPass).toBe(false)
  })

  it('still lets a maintainer grant it out of band', async () => {
    const doc = await make(`later-${tag}@example.invalid`)
    await payload.update({ collection: 'users', id: doc.id, data: { collabPass: true }, overrideAccess: true })
    expect((await stored(doc.id)).collabPass).toBe(true)
  })
})
