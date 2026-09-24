import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

import { backupHealth, readBackupStatus, BACKUP_STALE_AFTER_MS } from '@/endpoints/backup-health'

const NOW = Date.parse('2026-09-25T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()
const good = { ok: true, at: hoursAgo(8), offbox: { remote: 'r2:bucket', ok: true, at: hoursAgo(8) } }

describe('backupHealth', () => {
  it('is healthy only when a recent backup succeeded AND left the machine', () => {
    const h = backupHealth(good, NOW)
    expect(h.status).toBe(200)
    expect(h.body).toEqual({ ok: true, lastBackupAt: good.at, offbox: 'ok', reason: null })
  })

  it('no status file at all is unhealthy', () => {
    expect(backupHealth(null, NOW)).toMatchObject({ status: 503, body: { reason: 'no backup has been recorded' } })
  })

  it('a failed backup is unhealthy', () => {
    expect(backupHealth({ ...good, ok: false }, NOW)).toMatchObject({ status: 503, body: { reason: 'the last backup failed' } })
  })

  it('a backup job that stopped is unhealthy', () => {
    const old = hoursAgo(BACKUP_STALE_AFTER_MS / 3_600_000 + 1)
    expect(backupHealth({ ...good, at: old }, NOW)).toMatchObject({ status: 503, body: { reason: 'no backup in the last 26 hours' } })
  })

  it('a backup that never left the machine is NOT reported green', () => {
    const h = backupHealth({ ok: true, at: hoursAgo(1), offbox: { remote: null, ok: null, at: null } }, NOW)
    expect(h.status).toBe(503)
    expect(h.body).toMatchObject({ offbox: 'not configured', reason: 'backups are not copied off the machine' })
  })

  it('a failing off-box copy is named as the cause', () => {
    const h = backupHealth({ ok: false, at: hoursAgo(1), offbox: { remote: 'r2:b', ok: false, at: null } }, NOW)
    expect(h.body).toMatchObject({ offbox: 'failing', reason: 'the off-box copy is failing' })
  })

  it('an unparseable timestamp counts as stale, never as fresh', () => {
    expect(backupHealth({ ...good, at: 'not a date' }, NOW).status).toBe(503)
  })

  it('exposes no paths, file names or error text', () => {
    expect(Object.keys(backupHealth(good, NOW).body).sort()).toEqual(['lastBackupAt', 'offbox', 'ok', 'reason'])
  })
})

describe('readBackupStatus', () => {
  it('reads the job output, and treats a missing or corrupt file as no backup', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'bk-'))
    const file = path.join(dir, 'backup-status.json')
    expect(await readBackupStatus(file)).toBeNull()
    await writeFile(file, '{ truncated')
    expect(await readBackupStatus(file)).toBeNull()
    await writeFile(file, JSON.stringify(good))
    expect(await readBackupStatus(file)).toEqual(good)
    await rm(dir, { recursive: true })
  })
})
