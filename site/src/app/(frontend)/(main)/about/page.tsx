import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import '../../home.css'
import { SupportSignup } from '../../SupportSignup'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'About · Sarapis',
  description:
    'Sarapis is a New York-incorporated 501(c)(3) nonprofit, formed in 2010, helping nonprofits and the public sector adopt free, libre & open-source technology.',
}

export default async function AboutPage() {
  const payload = await getPayload({ config: configPromise })
  const hp = (await payload.findGlobal({ slug: 'homepage' })) as any

  const paragraphs: any[] = Array.isArray(hp?.about?.paragraphs) ? hp.about.paragraphs : []
  const board: any[] = Array.isArray(hp?.board) ? hp.board : []

  return (
    <div className="sds-page sds-project">
      {/* Header */}
      <section className="sds-container sds-projhead">
        <nav className="sds-crumb" aria-label="Breadcrumb">
          <Link href="/">← Home</Link>
          <span className="sds-crumb__sep">/</span>
          <span className="sds-crumb__here">About</span>
        </nav>
        <div className="sds-projhead__row">
          <h1 className="sds-projhead__title">About Sarapis</h1>
        </div>
        <p className="sds-projhead__sum" style={{ maxWidth: '52rem' }}>
          We envision a world where people can access and own the technologies they need to create a
          just, abundant and sustainable society.
        </p>
      </section>

      {/* Story */}
      <section className="sds-container sds-band sds-band--first">
        <div className="sds-seclead">
          <h2 className="sds-seclead__title">Who we are</h2>
          <span className="sds-seclead__meta">Since 2010</span>
        </div>
        <div className="sds-about">
          <div>
            {hp?.about?.lede && <p className="sds-about__lede">{hp.about.lede}</p>}
            {paragraphs.map((p, i) => (
              <p key={i} className="sds-about__body">{p.text}</p>
            ))}
          </div>
          <aside className="sds-support">
            <h3 className="sds-support__title">Support us</h3>
            <p className="sds-support__text">
              Get occasional updates on our work — new projects, tools, and open-source releases.
            </p>
            <SupportSignup />
            <div className="sds-support__donate">
              <p className="sds-support__text">
                Prefer to chip in? We’re a 501(c)(3) — donations are tax-deductible.
              </p>
              <Link className="sds-button sds-button--outline sds-button--md" href="/donate">Donate →</Link>
            </div>
          </aside>
        </div>
      </section>

      {/* Board */}
      {board.length > 0 && (
        <section className="sds-container sds-band">
          <div className="sds-seclead">
            <h2 className="sds-seclead__title">Board of Directors</h2>
            <span className="sds-seclead__meta">{board.length} members</span>
          </div>
          <div className="sds-board">
            {board.map((m, i) => (
              <div key={i} className="sds-board__card">
                <div className="sds-board__head">
                  <h3 className="sds-board__name">{m.name}</h3>
                  {m.role && <span className="sds-board__role">{m.role}</span>}
                </div>
                {m.bio && <p className="sds-board__bio">{m.bio}</p>}
                {m.link && (
                  <a
                    className="sds-board__link"
                    href={/^https?:\/\//.test(m.link) ? m.link : `https://${m.link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ↗ {String(m.link).replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Support */}
      <section className="sds-container sds-band" style={{ paddingBottom: 56 }}>
        <section className="sds-callout">
          <h2 className="sds-callout__title">Help us help people who help people.</h2>
          <p className="sds-callout__text">
            Sarapis is a New York-incorporated 501(c)(3) nonprofit — contributions are tax-deductible.
          </p>
          <div className="sds-callout__actions">
            <span style={{ ['--sds-primary' as any]: 'var(--sds-gold)', ['--sds-primary-foreground' as any]: 'var(--sds-ink)' } as React.CSSProperties}>
              <Link className="sds-button sds-button--primary sds-button--lg" href="/donate">Donate</Link>
            </span>
          </div>
        </section>
      </section>
    </div>
  )
}
