import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import '../../home.css'
import { SupportSignup } from '../../SupportSignup'
import { HoverCard, Thumb } from '../../RdCards'
import { mediaUrl } from '../../rd'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'About · Sarapis',
  description:
    'Sarapis is a New York-incorporated 501(c)(3) nonprofit, formed in 2010, helping nonprofits and the public sector adopt free, libre & open-source technology.',
}

const initials = (name: string) => {
  const w = name.split(/\s+/).filter(Boolean)
  return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase()
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
          </div>
          <div className="rd-boardgrid">
            {board.map((m, i) => (
              <HoverCard
                key={m.id || i}
                label={m.name}
                ratio="3 / 4"
                // a portrait, once the CMS has a field for one; until then the card shows initials on placeholder art
                img={mediaUrl(m.portrait) || mediaUrl(m.image)}
                thumb={<Thumb name={m.name} label={initials(m.name)} />}
                className="rd-boardcard"
                gap={6}
                reveal={
                  (m.bio || m.link) && (
                    <div className="rd-stack" style={{ gap: 10, paddingTop: 6 }}>
                      {m.bio && <p className="rd-bio">{m.bio}</p>}
                      {m.link && (
                        <a
                          className="rd-sitelink rd-sitelink--rule"
                          href={/^https?:\/\//.test(m.link) ? m.link : `https://${m.link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {String(m.link).replace(/^https?:\/\//, '')} ↗
                        </a>
                      )}
                    </div>
                  )
                }
              >
                <h3 className="rd-cardtitle rd-cardtitle--board">{m.name}</h3>
                {m.role && <div className="rd-role-tag">{m.role}</div>}
              </HoverCard>
            ))}
          </div>
        </section>
      )}

      <div style={{ height: 56 }} />
    </div>
  )
}
