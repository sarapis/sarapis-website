import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Backup health, served PUBLICLY at /next/backup/health for an uptime monitor.
 *
 * The nightly job (site/deploy/backup/sarapis-backup.py) writes its outcome to
 * `backup-status.json` beside the database, a directory this container already
 * mounts. This reads it and answers 503 unless the last backup:
 *   - exists, succeeded, and is under 26 hours old, AND
 *   - was copied OFF the machine. A backup on the same disk does not survive
 *     losing the disk, so "not configured" counts as unhealthy rather than
 *     being reported green.
 *
 * A backup job that stops, or starts failing, produces no error anyone sees.
 * This check exists so that one would.
 *
 * Public, so the body carries a verdict and timestamps only: no file names,
 * paths or error text.
 */
export const BACKUP_STALE_AFTER_MS = 26 * 60 * 60 * 1000

export type BackupStatus = {
  ok?: boolean
  at?: string | null
  offbox?: { remote?: string | null; ok?: boolean | null; at?: string | null } | null
}

export type BackupHealth = {
  ok: boolean
  lastBackupAt: string | null
  offbox: 'ok' | 'failing' | 'stale' | 'not configured' | 'unknown'
  reason: string | null
}

const ageMs = (iso: string | null | undefined, now: number) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? Infinity : now - t
}

export function backupHealth(status: BackupStatus | null, now: number = Date.now()): { status: number; body: BackupHealth } {
  const fail = (reason: string, offbox: BackupHealth['offbox'] = 'unknown') => ({
    status: 503,
    body: { ok: false, lastBackupAt: status?.at ?? null, offbox, reason },
  })
  if (!status) return fail('no backup has been recorded')

  const off = status.offbox
  const offbox: BackupHealth['offbox'] = !off?.remote
    ? 'not configured'
    : off.ok !== true
      ? 'failing'
      : ageMs(off.at, now) > BACKUP_STALE_AFTER_MS
        ? 'stale'
        : 'ok'

  if (ageMs(status.at, now) > BACKUP_STALE_AFTER_MS) return fail('no backup in the last 26 hours', offbox)
  if (offbox === 'failing') return fail('the off-box copy is failing', offbox)
  if (status.ok !== true) return fail('the last backup failed', offbox)
  if (offbox === 'not configured') return fail('backups are not copied off the machine', offbox)
  if (offbox === 'stale') return fail('no off-box copy in the last 26 hours', offbox)

  return { status: 200, body: { ok: true, lastBackupAt: status.at ?? null, offbox, reason: null } }
}

/** `backup-status.json` beside the database, unless BACKUP_STATUS_FILE says otherwise. */
export function backupStatusPath(): string {
  if (process.env.BACKUP_STATUS_FILE) return process.env.BACKUP_STATUS_FILE
  const db = (process.env.DATABASE_URI || 'file:./sarapis.db').replace(/^file:/, '')
  return path.join(path.dirname(db), 'backup-status.json')
}

/** The job's status record, or null if it is missing or unreadable. */
export async function readBackupStatus(file: string = backupStatusPath()): Promise<BackupStatus | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as BackupStatus
  } catch {
    return null
  }
}
