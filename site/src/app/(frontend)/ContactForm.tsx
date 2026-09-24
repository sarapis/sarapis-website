'use client'

import React, { useState } from 'react'

/**
 * Public "Let's talk" form on the single-page home. POSTs to the Payload REST
 * create endpoint for `contact-submissions` (anonymous create allowed; read is
 * admin-only). Includes a hidden honeypot ("website") the server rejects on.
 * Styling: .sds-form* in home.css.
 */
export function ContactForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setState('sending')
    try {
      const res = await fetch('/api/contact-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          message: fd.get('message'),
          website: fd.get('website') || undefined,
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
      form.reset()
      setState('sent')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="sds-form__done" role="status">
        <strong>Thanks — we got it.</strong> We read every message and will get back to you soon.
      </div>
    )
  }

  return (
    <form className="sds-form" onSubmit={onSubmit}>
      <div className="sds-form__row">
        <label className="sds-form__field">
          <span className="sds-form__label">Name</span>
          <input className="sds-form__input" name="name" type="text" required maxLength={200} autoComplete="name" />
        </label>
        <label className="sds-form__field">
          <span className="sds-form__label">Email</span>
          <input className="sds-form__input" name="email" type="email" required autoComplete="email" />
        </label>
      </div>
      <label className="sds-form__field">
        <span className="sds-form__label">What are you working on?</span>
        <textarea className="sds-form__input sds-form__textarea" name="message" required maxLength={5000} rows={5} />
      </label>
      {/* Honeypot — hidden from real users; bots that fill it get rejected server-side */}
      <div className="sds-form__hp" aria-hidden="true">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="sds-form__actions">
        <button className="sds-button sds-button--primary sds-button--lg" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send message'}
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
