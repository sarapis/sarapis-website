import { syncHealth } from '@/endpoints/github-sync-health'

// Public on purpose: an uptime monitor polls it without credentials. It reveals
// only whether the last sync run succeeded and when (see github-sync-health.ts).
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const { status, body } = syncHealth()
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
