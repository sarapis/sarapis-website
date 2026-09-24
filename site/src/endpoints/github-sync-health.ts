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
 * State lives on `globalThis`, not in a module variable, because the sync route
 * and this health route are separate bundles; the process-wide object is the
 * one thing both are guaranteed to see. It resets when the process restarts,
 * so a fresh process gets one full cron cycle of grace before "no run" counts
 * as a failure.
 *
 * The response is public, so it carries counts and timestamps only, never
 * error text or repo names.
 */

type LastRun = { at: number; ok: boolean; errors: number; warnings: number }
const KEY = '__sarapisGithubSyncLastRun'
const store = globalThis as unknown as Record<string, LastRun | undefined>

// Hourly cron plus time for a slow run. A healthy schedule never gets near this.
export const STALE_AFTER_MS = 150 * 60 * 1000

export function recordSyncRun(run: Omit<LastRun, 'at'>, now: number = Date.now()): void {
  store[KEY] = { at: now, ...run }
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
  const last = store[KEY]
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

/** Test hook: forget the last run. */
export function resetSyncHealth(): void {
  delete store[KEY]
}
