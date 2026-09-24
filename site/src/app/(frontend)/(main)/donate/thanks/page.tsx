import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import '../../../home.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Thank you · Sarapis',
  description: 'Thank you for supporting Sarapis.',
}

/** Return page for Stripe Embedded Checkout. Verifies the session server-side
 *  (best-effort) so a completed payment gets a confirmed message. */
export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams
  const secretKey = process.env.STRIPE_SECRET_KEY

  let confirmed = false
  let email: string | null = null
  if (session_id && secretKey && /^cs_[a-zA-Z0-9_]+$/.test(session_id)) {
    try {
      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      })
      if (res.ok) {
        const session = await res.json()
        confirmed = session?.status === 'complete'
        email = session?.customer_details?.email || null
      }
    } catch {
      /* best-effort — fall through to the generic thanks */
    }
  }

  return (
    <div className="sds-page sds-project">
      <section className="sds-container sds-projhead">
        <nav className="sds-crumb" aria-label="Breadcrumb">
          <Link href="/">← Home</Link>
          <span className="sds-crumb__sep">/</span>
          <span className="sds-crumb__here">Thank you</span>
        </nav>
        <div className="sds-projhead__row">
          <h1 className="sds-projhead__title">Thank you.</h1>
        </div>
        <p className="sds-projhead__sum" style={{ maxWidth: '52rem' }}>
          {confirmed
            ? `Your donation went through${email ? ` — a receipt is on its way to ${email}` : ' — a receipt is on its way by email'}. It funds open technology for the organizations that serve the public.`
            : 'If your donation completed, a receipt is on its way by email. It funds open technology for the organizations that serve the public.'}
        </p>
      </section>

      <section className="sds-container sds-band sds-band--first" style={{ paddingBottom: 56 }}>
        <div className="sds-seclead">
          <h2 className="sds-seclead__title">See what you’re supporting</h2>
          <span className="sds-seclead__meta">Live, in the open</span>
        </div>
        <p className="sds-about__body" style={{ maxWidth: '52rem' }}>
          Everything we build ships in public. Watch the work happen on our{' '}
          <Link href="/#projects">Projects</Link> page, or read our latest{' '}
          <Link href="/posts">writing</Link>.
        </p>
      </section>
    </div>
  )
}
