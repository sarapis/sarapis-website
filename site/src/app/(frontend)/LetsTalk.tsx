'use client'

import React, { useEffect, useState } from 'react'

/**
 * Floating "Let's talk" contact panel, on every page. Collapsed it is a pill with a
 * pulsing saffron dot; open it is a glass panel with the contact form. It opens
 * when any link to `#contact` is followed (hero button, footer link, `/#contact`
 * from another page). POSTs to the anonymous-create `contact-submissions`
 * collection, with the same honeypot ("website") as before.
 */
export function LetsTalk() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === '#contact') setOpen(true)
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const u = new URL(a.href, window.location.href)
      if (u.hash === '#contact' && u.pathname === window.location.pathname) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('hashchange', fromHash)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

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

  return (
    <div className="rd-talk">
      {open ? (
        <section className="rd-talk__panel" aria-label="Contact Sarapis">
          <div className="rd-talk__top">
            <h2 className="rd-talk__title">Building something for the public good?</h2>
            <button type="button" className="rd-talk__x" aria-label="Collapse" onClick={() => setOpen(false)}>
              –
            </button>
          </div>
          {state === 'sent' ? (
            <p className="rd-talk__text" role="status">
              <strong>Thanks — we got it.</strong> We read every message and will get back to you soon.
            </p>
          ) : (
            <>
              <p className="rd-talk__text">
                Tell us what you’re working on — or how you’d like to collaborate. We work in the open with everyone
                from grassroots groups to government agencies.
              </p>
              <form className="rd-talk__form" onSubmit={onSubmit}>
                <input className="rd-talk__input" name="name" placeholder="Name" aria-label="Name" required maxLength={200} autoComplete="name" />
                <input className="rd-talk__input" name="email" type="email" placeholder="Email" aria-label="Email" required autoComplete="email" />
                <textarea
                  className="rd-talk__input rd-talk__area"
                  name="message"
                  placeholder="What are you working on?"
                  aria-label="What are you working on?"
                  rows={3}
                  required
                  maxLength={5000}
                />
                {/* Honeypot — hidden from real users; bots that fill it get rejected server-side */}
                <div className="sds-form__hp" aria-hidden="true">
                  <label>
                    Website
                    <input name="website" type="text" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                <button className="sds-button sds-button--primary sds-button--sm rd-talk__send" type="submit" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Sending…' : 'Send'}
                </button>
                {state === 'error' && (
                  <span className="sds-form__err rd-talk__err" role="alert">
                    Something went wrong — please try again.
                  </span>
                )}
              </form>
            </>
          )}
        </section>
      ) : (
        <button type="button" className="sds-button sds-button--primary sds-button--md rd-talk__btn" aria-expanded="false" onClick={() => setOpen(true)}>
          <span className="rd-talk__dot" />
          Let’s talk
        </button>
      )}
    </div>
  )
}
