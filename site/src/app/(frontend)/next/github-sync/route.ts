import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { timingSafeEqual } from 'node:crypto'
import { syncGithub } from '@/endpoints/github-sync'

// Vercel-only hint — self-hosted, the real time bound is the per-request
// AbortSignal timeout inside the sync's GitHub fetches.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

async function authorized(): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed
  const h = await headers()
  return safeEqual(h.get('authorization') || '', `Bearer ${secret}`)
}

// One sync at a time — a stalled run must not stack with the hourly cron.
// Module-level state survives across requests in the standalone server.
let running = false

async function run(): Promise<Response> {
  if (!(await authorized())) return new Response('Forbidden.', { status: 403 })
  if (running) return new Response('Sync already running.', { status: 409 })
  running = true
  const payload = await getPayload({ config })
  try {
    const summary = await syncGithub({ payload })
    payload.logger.info({ msg: 'github-sync complete', summary })
    return Response.json({ success: true, summary })
  } catch (e) {
    payload.logger.error({ err: e, msg: 'github-sync failed' })
    return new Response(`github-sync failed: ${(e as Error).message}`, { status: 500 })
  } finally {
    running = false
  }
}

// Cron hits this with `curl -H "Authorization: Bearer $CRON_SECRET"`.
export async function GET(): Promise<Response> {
  return run()
}
export async function POST(): Promise<Response> {
  return run()
}
