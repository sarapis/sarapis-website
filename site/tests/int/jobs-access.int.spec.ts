import config from '@/payload.config'
import type { PayloadRequest } from 'payload'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

/** Anonymous callers may run Payload jobs only with the exact CRON_SECRET bearer. */
let run: (args: { req: PayloadRequest }) => boolean | Promise<boolean>
const saved = process.env.CRON_SECRET
const req = (authorization?: string, user: unknown = null) =>
  ({ user, headers: new Headers(authorization ? { authorization } : {}) }) as unknown as PayloadRequest

describe('jobs.access.run', () => {
  beforeAll(async () => {
    process.env.CRON_SECRET = 'cron-test-secret'
    run = (await config).jobs!.access!.run!
  })
  afterAll(() => {
    if (saved === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = saved
  })

  it('accepts the exact bearer', async () => {
    expect(await run({ req: req('Bearer cron-test-secret') })).toBe(true)
  })
  it('rejects a wrong, truncated, extended or missing bearer', async () => {
    for (const h of ['Bearer cron-test-secreT', 'Bearer cron-test-secre', 'Bearer cron-test-secret!', undefined])
      expect(await run({ req: req(h) })).toBe(false)
  })
  it('fails closed when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    expect(await run({ req: req('Bearer ') })).toBe(false)
    process.env.CRON_SECRET = 'cron-test-secret'
  })
  it('lets a logged-in user through', async () => {
    expect(await run({ req: req(undefined, { id: 1 }) })).toBe(true)
  })
})
