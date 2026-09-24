'use client'

import React, { useState } from 'react'

/**
 * "Support Us" email signup on the /about page. POSTs to the Payload REST
 * create endpoint for `email-signups` (anonymous create; read is admin-only).
 * Includes a hidden honeypot ("website") the server rejects on. A repeat
 * address hits the unique constraint — surfaced as "already subscribed", still
 * a success state. Styling: .sds-form* scoped under .sds-support in home.css.
 */
export function SupportSignup() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'dupe' | 'error'>('idle')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setState('sending')
    try {
      const res = await fetch('/api/email-signups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fd.get('email'),
          source: 'about-support',
          website: fd.get('website') || undefined,
        }),
      })
      if (res.ok) {
        form.reset()
        setState('sent')
        return
      }
      // A duplicate address trips the unique index — treat as already-subscribed.
      const body = await res.text().catch(() => '')
      if (/unique|duplicate|already|E_UNIQUE|value must be unique/i.test(body)) {
        form.reset()
        setState('dupe')
        return
      }
      throw new Error(String(res.status))
    } catch {
      setState('error')
    }
  }

  if (state === 'sent' || state === 'dupe') {
    return (
      <div className="sds-form__done" role="status">
        <strong>{state === 'dupe' ? 'You’re already on the list.' : 'Thanks — you’re subscribed.'}</strong>{' '}
        We’ll send occasional updates on our work.
      </div>
    )
  }

  return (
    <form className="sds-form" onSubmit={onSubmit}>
      <label className="sds-form__field">
        <span className="sds-form__label">Email</span>
        <input className="sds-form__input" name="email" type="email" required autoComplete="email" placeholder="you@example.org" />
      </label>
      {/* Honeypot — hidden from real users; bots that fill it get rejected server-side */}
      <div className="sds-form__hp" aria-hidden="true">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="sds-form__actions">
        <button className="sds-button sds-button--primary sds-button--md" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Subscribing…' : 'Get updates'}
        </button>
        {state === 'error' && (
          <span className="sds-form__err" role="alert">
            Something went wrong — please try again.
          </span>
        )}
      </div>
    </form>
  )
}
