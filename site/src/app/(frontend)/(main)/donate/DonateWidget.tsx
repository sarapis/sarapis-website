'use client'

import React, { useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'

const PRESETS = [25, 50, 100, 250]

/**
 * Donation amount picker + Stripe Embedded Checkout. The publishable key is
 * passed from the server component (runtime env — not baked at build time).
 * Flow: pick amount/frequency → POST /next/donate-session → mount embedded
 * checkout with the returned client secret. Card data goes only to Stripe.
 */
export function DonateWidget({ publishableKey }: { publishableKey: string }) {
  const [amount, setAmount] = useState<number>(50)
  const [custom, setCustom] = useState<string>('')
  const [interval, setInterval] = useState<'once' | 'monthly'>('once')
  const [phase, setPhase] = useState<'pick' | 'loading' | 'checkout' | 'error'>('pick')
  const [error, setError] = useState<string>('')
  const mountRef = useRef<HTMLDivElement>(null)
  const checkoutRef = useRef<{ destroy: () => void } | null>(null)

  // Clean up an embedded checkout instance on unmount.
  useEffect(() => () => checkoutRef.current?.destroy(), [])

  const effAmount = custom !== '' ? Math.floor(Number(custom)) : amount
  const valid = Number.isFinite(effAmount) && effAmount >= 1 && effAmount <= 25000

  const start = async () => {
    if (!valid) return
    setPhase('loading')
    setError('')
    try {
      const res = await fetch('/next/donate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: effAmount, interval }),
      })
      const data = await res.json()
      if (!res.ok || !data.clientSecret) throw new Error(data.error || 'Could not start the donation.')
      const stripe = await loadStripe(publishableKey)
      if (!stripe) throw new Error('Payment library failed to load.')
      const checkout = await stripe.createEmbeddedCheckoutPage({ clientSecret: data.clientSecret })
      checkoutRef.current = checkout
      setPhase('checkout')
      // mount after state flips so the target div exists
      requestAnimationFrame(() => {
        if (mountRef.current) checkout.mount(mountRef.current)
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — please try again.')
      setPhase('error')
    }
  }

  const back = () => {
    checkoutRef.current?.destroy()
    checkoutRef.current = null
    setPhase('pick')
  }

  if (phase === 'checkout') {
    return (
      <div className="sds-donate">
        <button type="button" className="sds-donate__back" onClick={back}>
          ← Change amount
        </button>
        <div ref={mountRef} className="sds-donate__checkout" />
      </div>
    )
  }

  return (
    <div className="sds-donate">
      <div className="sds-donate__freq" role="group" aria-label="Frequency">
        <button
          type="button"
          className={`sds-chip${interval === 'once' ? ' sds-chip--active' : ''}`}
          onClick={() => setInterval('once')}
        >
          One-time
        </button>
        <button
          type="button"
          className={`sds-chip${interval === 'monthly' ? ' sds-chip--active' : ''}`}
          onClick={() => setInterval('monthly')}
        >
          Monthly
        </button>
      </div>
      <div className="sds-donate__amounts" role="group" aria-label="Amount">
        {PRESETS.map((v) => (
          <button
            key={v}
            type="button"
            className={`sds-donate__amt${custom === '' && amount === v ? ' is-on' : ''}`}
            onClick={() => {
              setAmount(v)
              setCustom('')
            }}
          >
            ${v}
          </button>
        ))}
        <label className={`sds-donate__amt sds-donate__amt--custom${custom !== '' ? ' is-on' : ''}`}>
          $
          <input
            type="number"
            min={1}
            max={25000}
            placeholder="Other"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Custom amount in dollars"
          />
        </label>
      </div>
      <button
        type="button"
        className="sds-button sds-button--primary sds-button--lg"
        disabled={!valid || phase === 'loading'}
        onClick={start}
      >
        {phase === 'loading'
          ? 'Starting…'
          : `Donate $${valid ? effAmount.toLocaleString() : '—'}${interval === 'monthly' ? '/month' : ''}`}
      </button>
      {phase === 'error' && (
        <p className="sds-donate__err" role="alert">
          {error}
        </p>
      )}
      <p className="sds-donate__fine">
        Payments are processed by Stripe — card details never touch our servers. Sarapis is a
        501(c)(3) nonprofit (EIN 27-1074148); contributions are tax-deductible. You’ll receive a
        receipt by email.
      </p>
    </div>
  )
}
