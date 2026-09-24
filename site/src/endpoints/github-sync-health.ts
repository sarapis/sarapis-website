/**
 * The GitHub sync's last outcome, served by the PUBLIC health check at
 * /next/github-sync/health, which an uptime monitor can watch. Any 4xx/5xx
 * there reads as degraded.
 *
 * Why this exists: the sync's own response is written to a cron log nobody
 * reads, so a run that failed was indistinguishable from one that succeeded.
 * One dead token failed 766 consecutive hourly runs that way. A health URL
 * puts the verdict where people already look.
 *
 * 503 when the last run had errors, OR when no run has completed recently.
 * The second case matters as much: a cron that stops running, or whose secret
 * no longer matches, produces no failing run at all, just silence.
 *
 * The last run is kept in `github-sync-status.json` beside the database (a
 * mounted directory that outlives the container), and cached on `globalThis`,
 * because the sync route and this health route are separate bundles. It used
 * to live in memory only, so every deploy wiped it and a failing sync read
 * green for up to an hour. Now a restart keeps the verdict; only a box that has
 * never recorded a run gets one cron cycle of grace.
 *
 * The response is public, so it carries counts and timestamps only, never
 * error text or repo names.
 */

import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

type LastRun = { at: number; ok: boolean; errors: number; warnings: number }
const KEY = '__sarapisGithubSyncLastRun'
const store = globalThis as unknown as Record<string, LastRun | undefined>

// Hourly cron plus time for a slow run. A healthy schedule never gets near this.
export const STALE_AFTER_MS = 150 * 60 * 1000

/** `github-sync-status.json` beside the database, unless SYNC_STATUS_FILE says otherwise. */
export function syncStatusPath(): string {
  if (process.env.SYNC_STATUS_FILE) return process.env.SYNC_STATUS_FILE
  const db = (process.env.DATABASE_URI || 'file:./sarapis.db').replace(/^file:/, '')
  return path.join(path.dirname(db), 'github-sync-status.json')
}

/**
 * Records a run in memory and on disk. Returns false if the disk write failed:
 * health still works until the next restart, but the caller should say so.
 */
export function recordSyncRun(run: Omit<LastRun, 'at'>, now: number = Date.now()): boolean {
  const last = { at: now, ...run }
  store[KEY] = last
  const file = syncStatusPath()
  try {
    writeFileSync(`${file}.tmp`, JSON.stringify(last))
    renameSync(`${file}.tmp`, file) // atomic: a reader never sees half a file
    return true
  } catch {
    return false
  }
}

function loadLastRun(): LastRun | undefined {
  if (store[KEY]) return store[KEY]
  try {
    const r = JSON.parse(readFileSync(syncStatusPath(), 'utf8')) as LastRun
    if (typeof r.at !== 'number' || typeof r.ok !== 'boolean') return undefined
    store[KEY] = r
    return r
  } catch {
    return undefined
  }
}

export type SyncHealth = {
  ok: boolean
  stale: boolean
  lastRunAt: string | null
  errors: number | null
  warnings: number | null
}

export function syncHealth(
  now: number = Date.now(),
  processUptimeMs: number = process.uptime() * 1000,
): { status: number; body: SyncHealth } {
  const last = loadLastRun()
  if (!last) {
    const stale = processUptimeMs > STALE_AFTER_MS
    return {
      status: stale ? 503 : 200,
      body: { ok: !stale, stale, lastRunAt: null, errors: null, warnings: null },
    }
  }
  const stale = now - last.at > STALE_AFTER_MS
  const ok = last.ok && !stale
  return {
    status: ok ? 200 : 503,
    body: { ok, stale, lastRunAt: new Date(last.at).toISOString(), errors: last.errors, warnings: last.warnings },
  }
}

/** Test hook: forget the in-memory copy, as a restart does; `wipeFile` also removes the record on disk. */
export function resetSyncHealth({ wipeFile = true } = {}): void {
  delete store[KEY]
  if (wipeFile) rmSync(syncStatusPath(), { force: true })
}
