import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { safeEqual } from '@/utilities/safeEqual'
import { parseBackfillSince, syncGithub, syncOutcome } from '@/endpoints/github-sync'
import { recordSyncRun } from '@/endpoints/github-sync-health'

// Vercel-only hint — self-hosted, the real time bound is the per-request
// AbortSignal timeout inside the sync's GitHub fetches.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

async function authorized(): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed
  const h = await headers()
  return safeEqual(h.get('authorization') || '', `Bearer ${secret}`)
}

// One sync at a time — a stalled run must not stack with the hourly cron.
// Module-level state survives across requests in the standalone server.
let running = false

async function run(req: Request): Promise<Response> {
  if (!(await authorized())) return new Response('Forbidden.', { status: 403 })
  const { since, bad } = parseBackfillSince(new URL(req.url).searchParams.get('since'))
  if (bad) return new Response('`since` must be a date, YYYY-MM-DD.', { status: 400 })
  if (running) return new Response('Sync already running.', { status: 409 })
  running = true
  const payload = await getPayload({ config })
  try {
    const summary = await syncGithub({ payload, backfillSince: since })
    // A run that skipped data is a FAILURE, reported as one — it used to say
    // `success: true` with HTTP 200 however much it had skipped.
    const { ok, status } = syncOutcome(summary)
    if (!recordSyncRun({ ok, errors: summary.errors.length, warnings: summary.warnings.length }))
      payload.logger.warn({ msg: 'github-sync: could not persist the run outcome; health resets on restart' })
    if (ok) payload.logger.info({ msg: 'github-sync complete', summary })
    else payload.logger.error({ msg: 'github-sync completed WITH ERRORS', summary })
    return Response.json({ success: ok, summary }, { status })
  } catch (e) {
    if (!recordSyncRun({ ok: false, errors: 1, warnings: 0 }))
      payload.logger.warn({ msg: 'github-sync: could not persist the run outcome; health resets on restart' })
    payload.logger.error({ err: e, msg: 'github-sync failed' })
    return new Response(`github-sync failed: ${(e as Error).message}`, { status: 500 })
  } finally {
    running = false
  }
}

// Cron hits this with `curl -H "Authorization: Bearer $CRON_SECRET"`.
export async function GET(req: Request): Promise<Response> {
  return run(req)
}
export async function POST(req: Request): Promise<Response> {
  return run(req)
}
