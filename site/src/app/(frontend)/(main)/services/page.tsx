import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import '../../home.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Services · Sarapis',
  description: 'How Sarapis works with nonprofits and the public sector — solution delivery, project facilitation, and open-source software development.',
}

const slugify = (s: string) =>
  String(s || '').toLowerCase().trim().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '')

export default async function ServicesPage() {
  const payload = await getPayload({ config: configPromise })
  const hp = (await payload.findGlobal({ slug: 'homepage' })) as any

  const services: any[] = Array.isArray(hp?.services) ? hp.services : []
  const caseStudies: any[] = Array.isArray(hp?.caseStudies) ? hp.caseStudies : []
  const serviceSlug = (s: any) => s.slug || slugify(s.title)

  return (
    <div className="sds-page sds-project">
      {/* Header */}
      <section className="sds-container sds-projhead">
        <nav className="sds-crumb" aria-label="Breadcrumb">
          <Link href="/">← Home</Link>
          <span className="sds-crumb__sep">/</span>
          <span className="sds-crumb__here">Services</span>
        </nav>
        <div className="sds-projhead__row">
          <h1 className="sds-projhead__title">Services</h1>
        </div>
        <p className="sds-projhead__sum">
          We work alongside your team — scoping, building, facilitating, and maintaining the open
          tools your mission depends on. Every engagement is scoped to the client.
        </p>
        {services.length > 1 && (
          <div className="sds-kin" style={{ marginTop: 20 }}>
            <span className="sds-kin__label">Jump to</span>
            {services.map((s) => (
              <a key={serviceSlug(s)} href={`#${serviceSlug(s)}`}>{s.title}</a>
            ))}
          </div>
        )}
      </section>

      {/* One anchored section per service */}
      {services.map((s, i) => {
        const slug = serviceSlug(s)
        const related = caseStudies.filter((c) => c.service && slugify(c.service) === slug)
        return (
          <section
            key={slug}
            id={slug}
            className={`sds-container sds-band${i === 0 ? ' sds-band--first' : ''}`}
            style={{ scrollMarginTop: 90 }}
          >
            <div className="sds-seclead">
              <h2 className="sds-seclead__title">
                <span style={{ fontFamily: 'var(--sds-font-mono)', fontSize: '0.7em', color: 'var(--sds-primary)', marginRight: 12 }}>
                  {s.number || String(i + 1).padStart(2, '0')}
                </span>
                {s.title}
              </h2>
              <a className="sds-seclead__meta" href="#contact-cta" style={{ color: 'var(--sds-primary)', textDecoration: 'none' }}>
                Start a project →
              </a>
            </div>

            {related.length > 0 ? (
              <div className="sds-svcgrid">
                <p className="sds-about__lede">{s.description || s.blurb || ''}</p>
                <aside>
                  <div className="sds-catalog__head" style={{ marginTop: 0 }}>
                    <span>Case studies</span>
                    <span className="meta">{s.title}</span>
                  </div>
                  <div className="sds-svccol">
                    {related.map((c, j) => (
                      <a key={j} className="sds-fcard" href={c.href || '#'}>
                        <span className="sds-fcard__kicker">
                          {c.type} <span className="src">· {c.source}</span>
                        </span>
                        <span className="sds-fcard__title">{c.title}</span>
                        <span className="sds-fcard__date">Read the case study →</span>
                      </a>
                    ))}
                  </div>
                </aside>
              </div>
            ) : (
              <p className="sds-about__lede" style={{ maxWidth: '52rem' }}>{s.description || s.blurb || ''}</p>
            )}
          </section>
        )
      })}

      {/* CTA */}
      <section id="contact-cta" className="sds-container sds-band" style={{ paddingBottom: 56, scrollMarginTop: 90 }}>
        <section className="sds-callout">
          <h2 className="sds-callout__title">Building something for the public good?</h2>
          <p className="sds-callout__text">Tell us what you’re working on — we’ll help you scope, build, and run it in the open.</p>
          <div className="sds-callout__actions">
            <span style={{ ['--sds-primary' as any]: 'var(--sds-gold)', ['--sds-primary-foreground' as any]: 'var(--sds-ink)' } as React.CSSProperties}>
              <Link className="sds-button sds-button--primary sds-button--lg" href="/#contact">Let’s Talk</Link>
            </span>
          </div>
        </section>
      </section>
    </div>
  )
}
