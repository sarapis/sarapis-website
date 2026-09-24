import { backupHealth, readBackupStatus } from '@/endpoints/backup-health'

// Public on purpose: an uptime monitor polls it without credentials. It reveals
// only whether the last backup succeeded, when, and whether it left the machine.
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const { status, body } = backupHealth(await readBackupStatus())
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
