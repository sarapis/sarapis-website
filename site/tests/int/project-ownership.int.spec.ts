import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'

import { loadProjectMeta, projectEventsWhere } from '@/app/(frontend)/rdData'

/**
 * An event belongs to the project it is assigned to; an unassigned event belongs to the
 * project that owns its repo. The project page (projectEventsWhere) and the cards
 * (loadProjectMeta) must agree on that, including when an editor reassigns an event.
 */
let payload: Payload
const ids: Record<string, number> = {}
const REPO = 'owntest/repo'

describe('project ownership of activity', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
    const mk = (name: string) => payload.create({ collection: 'projects', data: { name, published: true } as any, overrideAccess: true })
    ids.a = (await mk('owntest A')).id as number
    ids.b = (await mk('owntest B')).id as number
    await payload.create({ collection: 'repos', data: { fullName: REPO, project: ids.a, published: true } as any, overrideAccess: true })
    const ev = (title: string, occurredAt: string, project?: number) =>
      payload.create({ collection: 'activity-events', data: { title, kind: 'commit', repoFullName: REPO, occurredAt, project, published: true, externalId: `owntest-${title}` } as any, overrideAccess: true })
    await ev('unassigned-old', '2026-01-01T00:00:00Z')
    await ev('reassigned-new', '2026-02-01T00:00:00Z', ids.b)
  })
  afterAll(cleanup)

  async function cleanup() {
    await payload.delete({ collection: 'activity-events', where: { externalId: { like: 'owntest-' } }, overrideAccess: true })
    await payload.delete({ collection: 'repos', where: { fullName: { equals: REPO } }, overrideAccess: true })
    await payload.delete({ collection: 'projects', where: { name: { like: 'owntest ' } }, overrideAccess: true })
  }
  const titles = async (pid: number, repos: string[]) =>
    (await payload.find({ collection: 'activity-events', where: projectEventsWhere(pid, repos), depth: 0 })).docs.map((d: any) => d.title).sort()

  it('the repo owner gets its unassigned events, but not one reassigned elsewhere', async () => {
    expect(await titles(ids.a, [REPO])).toEqual(['unassigned-old'])
    expect(await titles(ids.b, [])).toEqual(['reassigned-new'])
  })
  it('the cards credit the same project as the profile page', async () => {
    const meta = await loadProjectMeta(payload, [ids.a, ids.b])
    expect(meta.latest.get(ids.a)?.title).toBe('unassigned-old')
    expect(meta.latest.get(ids.b)?.title).toBe('reassigned-new')
    expect(meta.updated.get(ids.a)).toMatch(/^2026-01-01/)
  })
})
