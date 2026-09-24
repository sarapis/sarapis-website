import { NextRequest, NextResponse } from 'next/server'

import { getServerSideURL } from '@/utilities/getURL'

/**
 * Creates a Stripe Embedded Checkout session for a donation.
 * POST { amount: number (whole USD), interval: 'once' | 'monthly' }
 * → { clientSecret } consumed by DonateWidget (ui_mode: embedded).
 *
 * Uses the raw Stripe REST API (form-encoded) — no server SDK dependency.
 * STRIPE_SECRET_KEY lives only in the runtime env, never in the repo.
 */
export const maxDuration = 30

const MIN_USD = 1
const MAX_USD = 25000

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Donations are not configured yet.' }, { status: 503 })
  }

  let body: { amount?: unknown; interval?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const amount = Math.floor(Number(body.amount))
  const interval = body.interval === 'monthly' ? 'monthly' : 'once'
  if (!Number.isFinite(amount) || amount < MIN_USD || amount > MAX_USD) {
    return NextResponse.json(
      { error: `Amount must be between $${MIN_USD} and $${MAX_USD.toLocaleString()}.` },
      { status: 400 },
    )
  }

  const params = new URLSearchParams()
  params.set('ui_mode', 'embedded')
  params.set('return_url', `${getServerSideURL()}/donate/thanks?session_id={CHECKOUT_SESSION_ID}`)
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price_data][currency]', 'usd')
  params.set('line_items[0][price_data][unit_amount]', String(amount * 100))
  if (interval === 'monthly') {
    params.set('mode', 'subscription')
    params.set('line_items[0][price_data][product_data][name]', 'Monthly donation to Sarapis')
    params.set('line_items[0][price_data][recurring][interval]', 'month')
  } else {
    params.set('mode', 'payment')
    params.set('submit_type', 'donate')
    params.set('line_items[0][price_data][product_data][name]', 'Donation to Sarapis')
  }

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    })
    const session = await res.json()
    if (!res.ok || !session?.client_secret) {
      console.error('[donate] stripe error:', session?.error?.message || res.status)
      return NextResponse.json({ error: 'Could not start the donation — please try again.' }, { status: 502 })
    }
    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (err) {
    console.error('[donate] request failed:', err)
    return NextResponse.json({ error: 'Could not reach the payment provider — please try again.' }, { status: 502 })
  }
}
