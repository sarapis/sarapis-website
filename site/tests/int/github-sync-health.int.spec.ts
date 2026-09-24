import { describe, it, expect, beforeEach } from 'vitest'

import { syncOutcome, commitWindowStart, parseBackfillSince } from '@/endpoints/github-sync'
import { recordSyncRun, syncHealth, resetSyncHealth, STALE_AFTER_MS } from '@/endpoints/github-sync-health'

const NOW = Date.parse('2026-09-24T16:00:00Z')
const MIN = 60_000

describe('syncOutcome', () => {
  it('a run with no errors succeeds', () => {
    expect(syncOutcome({ errors: [] })).toEqual({ ok: true, status: 200 })
  })
  it('any error fails the run — no more success:true over skipped data', () => {
    expect(syncOutcome({ errors: ['list wegovnyc: GitHub 401'] })).toEqual({ ok: false, status: 500 })
  })
})

describe('commitWindowStart', () => {
  it('reopens the newest recorded day at 00:00 UTC, so it is refetched whole', () => {
    expect(commitWindowStart('2026-09-18T12:00:00.000Z', undefined, NOW)).toBe('2026-09-18T00:00:00Z')
  })
  it('gives a never-seen repo the whole active window', () => {
    expect(commitWindowStart(undefined, undefined, NOW)).toBe('2025-08-20T00:00:00Z')
  })
  it('a backfill date can widen the window', () => {
    expect(commitWindowStart('2026-09-18T12:00:00.000Z', '2026-07-22', NOW)).toBe('2026-07-22T00:00:00Z')
  })
  it('but never narrows it', () => {
    expect(commitWindowStart('2026-09-18T12:00:00.000Z', '2026-09-20', NOW)).toBe('2026-09-18T00:00:00Z')
  })
})

describe('parseBackfillSince', () => {
  it('accepts a real date', () => expect(parseBackfillSince('2026-07-22')).toEqual({ since: '2026-07-22' }))
  it('no value is no backfill', () => expect(parseBackfillSince(null)).toEqual({}))
  // Found by running the built image: this threw (Invalid Date .toISOString()) and the route 500'd.
  it('rejects an impossible date without throwing', () => expect(parseBackfillSince('2026-13-45')).toEqual({ bad: true }))
  it('rejects a date that would silently roll over', () => expect(parseBackfillSince('2026-02-30')).toEqual({ bad: true }))
  it('rejects anything not YYYY-MM-DD', () => expect(parseBackfillSince('last week')).toEqual({ bad: true }))
})

describe('syncHealth', () => {
  beforeEach(() => resetSyncHealth())

  it('is healthy after a clean recent run', () => {
    recordSyncRun({ ok: true, errors: 0, warnings: 2 }, NOW - 30 * MIN)
    const h = syncHealth(NOW, 10 * 60 * MIN)
    expect(h.status).toBe(200)
    expect(h.body).toMatchObject({ ok: true, stale: false, errors: 0, warnings: 2 })
  })

  it('is unhealthy after a run with errors', () => {
    recordSyncRun({ ok: false, errors: 1, warnings: 0 }, NOW - 5 * MIN)
    expect(syncHealth(NOW, 10 * 60 * MIN).status).toBe(503)
  })

  it('is unhealthy when the last clean run is too old — the cron stopped', () => {
    recordSyncRun({ ok: true, errors: 0, warnings: 0 }, NOW - STALE_AFTER_MS - MIN)
    const h = syncHealth(NOW, 10 * 60 * MIN)
    expect(h.status).toBe(503)
    expect(h.body.stale).toBe(true)
  })

  it('gives a freshly started process one cron cycle of grace', () => {
    expect(syncHealth(NOW, 20 * MIN).status).toBe(200)
  })

  it('but a long-running process that has never completed a run is unhealthy', () => {
    const h = syncHealth(NOW, STALE_AFTER_MS + MIN)
    expect(h.status).toBe(503)
    expect(h.body).toMatchObject({ ok: false, stale: true, lastRunAt: null })
  })

  it('exposes counts only — no error text in the public body', () => {
    recordSyncRun({ ok: false, errors: 3, warnings: 1 }, NOW)
    expect(Object.keys(syncHealth(NOW, MIN).body).sort()).toEqual(['errors', 'lastRunAt', 'ok', 'stale', 'warnings'])
  })
})
