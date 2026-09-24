import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import '../../home.css'
import { DonateWidget } from './DonateWidget'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Donate · Sarapis',
  description:
    'Support Sarapis — a 501(c)(3) nonprofit building free, libre & open-source solutions for nonprofits and the public sector. Contributions are tax-deductible.',
}

export default async function DonatePage() {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || ''

  return (
    <div className="sds-page sds-project">
      {/* Header */}
      <section className="sds-container sds-projhead">
        <nav className="sds-crumb" aria-label="Breadcrumb">
          <Link href="/">← Home</Link>
          <span className="sds-crumb__sep">/</span>
          <span className="sds-crumb__here">Donate</span>
        </nav>
        <div className="sds-projhead__row">
          <h1 className="sds-projhead__title">Help us help people who help people.</h1>
        </div>
        <p className="sds-projhead__sum" style={{ maxWidth: '52rem' }}>
          Your donation funds free, libre &amp; open-source solutions for the organizations that
          serve the public — built in the open, owned by the communities that use them.
        </p>
      </section>

      {/* Donation widget */}
      <section className="sds-container sds-band sds-band--first">
        <div className="sds-seclead">
          <h2 className="sds-seclead__title">Make a donation</h2>
          <span className="sds-seclead__meta">Tax-deductible · 501(c)(3)</span>
        </div>
        {publishableKey ? (
          <DonateWidget publishableKey={publishableKey} />
        ) : (
          <div className="sds-empty">
            Online donations are almost ready — in the meantime, please{' '}
            <Link href="/#contact">get in touch</Link> and we’ll make it easy.
          </div>
        )}
      </section>

      {/* What it funds */}
      <section className="sds-container sds-band" style={{ paddingBottom: 56 }}>
        <div className="sds-seclead">
          <h2 className="sds-seclead__title">Where it goes</h2>
          <span className="sds-seclead__meta">The work</span>
        </div>
        <div className="sds-about">
          <div>
            <p className="sds-about__body">
              Sarapis builds and stewards open technology for the public good: open data standards
              that connect people to health and human services, transparency tools that make city
              government legible, and disaster-response platforms communities can run themselves.
              See it all, live, on our <Link href="/#projects">Projects</Link> page.
            </p>
            <p className="sds-about__body">
              Because everything we make is free and open source, every dollar goes further — one
              donation helps every organization that uses the commons we maintain.
            </p>
          </div>
          <div className="sds-about-facts">
            <div className="sds-fact">
              <span className="sds-fact__k">Structure</span>
              <span className="sds-fact__v">501(c)(3) nonprofit</span>
            </div>
            <div className="sds-fact">
              <span className="sds-fact__k">EIN</span>
              <span className="sds-fact__v">27-1074148</span>
            </div>
            <div className="sds-fact">
              <span className="sds-fact__k">Deductibility</span>
              <span className="sds-fact__v">Contributions are tax-deductible</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
