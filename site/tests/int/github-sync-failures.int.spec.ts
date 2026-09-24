import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest'

import { syncGithub } from '@/endpoints/github-sync'

/**
 * The sync's failures must be REPORTED, not converted into plausible success.
 * Runs the real syncGithub against the local DB with GitHub and Gemini replaced
 * by a scripted fetch:
 *
 *   rtest-dead   — owner whose token is rejected (401)
 *   rtest-ok/a   — pulls fetch fails (500); two commit-days need summaries
 *   rtest-ok/b   — returns exactly 10 pages x 100 commits, hitting the cap:
 *                  600 on 2026-09-02, then 400 on 2026-09-01 (the cut day)
 *   Gemini       — answers 503
 */
const OWNER = 'rtest-ok'
const calls: string[] = []
const geminiKeyHeaders: (string | null)[] = []
let payload: Payload
let summary: Awaited<ReturnType<typeof syncGithub>>
const savedEnv: Record<string, string | undefined> = {}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

const repo = (name: string) => ({
  full_name: `${OWNER}/${name}`,
  html_url: `https://github.com/${OWNER}/${name}`,
  description: null,
  pushed_at: new Date().toISOString(),
  created_at: '2026-01-01T00:00:00Z',
  default_branch: 'main',
  archived: false,
  owner: { login: OWNER },
})

const commit = (day: string, i: number) => ({
  sha: `${day}-${i}`,
  author: { login: 'contributor' },
  commit: {
    message: `Add feature ${i}`,
    author: { name: 'Contributor', date: `${day}T12:00:00Z` },
    committer: { date: `${day}T12:00:00Z` },
  },
})

// Newest first, as GitHub returns them.
const bigHistory = [
  ...Array.from({ length: 600 }, (_, i) => commit('2026-09-02', i)),
  ...Array.from({ length: 400 }, (_, i) => commit('2026-09-01', i)),
]

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  calls.push(url.href)
  const page = Number(url.searchParams.get('page') || '1')
  const p = url.pathname

  if (url.hostname === 'generativelanguage.googleapis.com') {
    geminiKeyHeaders.push(new Headers(init?.headers).get('x-goog-api-key'))
    return Promise.resolve(json({ error: 'overloaded' }, 503))
  }
  if (url.hostname !== 'api.github.com') throw new Error(`unexpected fetch: ${url.href}`)

  if (p === '/orgs/rtest-dead/repos') return Promise.resolve(json({ message: 'Bad credentials' }, 401))
  if (p === `/orgs/${OWNER}/repos`) return Promise.resolve(json(page === 1 ? [repo('a'), repo('b')] : []))

  if (p === `/repos/${OWNER}/a/commits`)
    return Promise.resolve(json(page === 1 ? [commit('2026-09-10', 1), commit('2026-09-11', 2)] : []))
  if (p === `/repos/${OWNER}/a/pulls`) return Promise.resolve(json({ message: 'Server Error' }, 500))
  if (p === `/repos/${OWNER}/b/commits`) return Promise.resolve(json(bigHistory.slice((page - 1) * 100, page * 100)))
  if (p.endsWith('/releases') || p.endsWith('/pulls')) return Promise.resolve(json([]))

  throw new Error(`unexpected GitHub path: ${url.href}`)
}

async function cleanup() {
  await payload.delete({ collection: 'activity-events', where: { repoFullName: { like: `${OWNER}/` } }, overrideAccess: true })
  await payload.delete({ collection: 'repos', where: { fullName: { like: `${OWNER}/` } }, overrideAccess: true })
}

describe('github-sync reports its failures', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
    for (const k of ['GITHUB_TOKEN', 'SYNC_OWNERS', 'GEMINI_API_KEY', 'GEMINI_THROTTLE_MS', 'SUMMARY_MAX_PER_RUN']) savedEnv[k] = process.env[k]
    Object.assign(process.env, {
      GITHUB_TOKEN: 'test-token',
      SYNC_OWNERS: `${OWNER},rtest-dead`,
      GEMINI_API_KEY: 'test-key',
      GEMINI_THROTTLE_MS: '0',
      SUMMARY_MAX_PER_RUN: '10',
    })
    vi.stubGlobal('fetch', vi.fn(fakeFetch))
    summary = await syncGithub({ payload })
  }, 60_000)

  afterAll(async () => {
    vi.unstubAllGlobals()
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    await cleanup()
  })

  it('M1: a dead owner token is an error', () => {
    expect(summary.errors.some((e) => e.startsWith('list rtest-dead'))).toBe(true)
  })

  it('M2: a failed per-repo fetch is an error, not an empty list', () => {
    expect(summary.errors.some((e) => e.startsWith(`${OWNER}/a pulls`))).toBe(true)
  })

  it('M4: the commit fetch is windowed with `since`', () => {
    const commitCalls = calls.filter((u) => u.includes('/commits'))
    expect(commitCalls.length).toBeGreaterThan(0)
    for (const u of commitCalls) expect(u).toMatch(/[?&]since=\d{4}-\d{2}-\d{2}T00:00:00Z/)
  })

  it('M4: a capped window keeps complete days only, with the true count', async () => {
    const events = await payload.find({
      collection: 'activity-events',
      where: { and: [{ repoFullName: { equals: `${OWNER}/b` } }, { kind: { equals: 'commit' } }] },
      overrideAccess: true,
      depth: 0,
    })
    const byDay = Object.fromEntries(events.docs.map((d) => [String(d.occurredAt).slice(0, 10), d.title]))
    expect(byDay['2026-09-02']).toBe('600 commits to main')
    expect(byDay['2026-09-01']).toBeUndefined() // the cut day is skipped, not written short
    expect(summary.warnings.some((w) => w.includes(`${OWNER}/b: commits capped at 1000`))).toBe(true)
  })

  it('M5: one Gemini failure stops Gemini for the rest of the run', () => {
    expect(calls.filter((u) => u.includes('generativelanguage')).length).toBe(1)
  })

  it('M5: a Gemini failure is a warning, not a sync error', () => {
    expect(summary.warnings.some((w) => w.startsWith('gemini 503'))).toBe(true)
    expect(summary.errors.some((e) => e.startsWith('gemini'))).toBe(false)
  })

  it('L5: the Gemini key travels in a header, never in the URL', () => {
    const geminiCalls = calls.filter((u) => u.includes('generativelanguage'))
    expect(geminiCalls.length).toBeGreaterThan(0)
    for (const u of geminiCalls) expect(u).not.toContain('test-key')
    expect(geminiKeyHeaders).toEqual(['test-key'])
  })
})
