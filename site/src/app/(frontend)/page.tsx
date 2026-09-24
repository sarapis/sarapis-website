import React from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { SpNav } from './SpNav'
import { SiteFooter } from './SiteFooter'
import { ContactForm } from './ContactForm'
import { ProjectsView } from './ProjectsView'
import { SITE_NAV, LOGO_HREF } from './nav'
import './home.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sarapis — free, libre & open source for the public sector',
  description:
    'Sarapis builds open solutions with — not for — nonprofits and the public sector. A live view of our projects, in the open.',
}

const fmtMonthYear = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase() : ''
const mediaUrl = (m: any): string | null => (m && typeof m === 'object' ? m.url || null : null)
const slugify = (s: string) =>
  String(s || '').toLowerCase().trim().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '')

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>
}) {
  const sp = await searchParams
  const region = sp.region === 'global' ? 'global' : sp.region === 'nyc' ? 'nyc' : 'all'

  const payload = await getPayload({ config: configPromise })

  const [homepage, recentPosts] = await Promise.all([
    payload.findGlobal({ slug: 'homepage' }),
    payload.find({ collection: 'posts', where: { _status: { equals: 'published' } }, sort: '-publishedAt', limit: 3, depth: 1 }),
  ])

  const hp = homepage as any

  // ---- Recent Posts ----
  const allPosts = recentPosts.docs as any[]
  const postCat = (p: any) =>
    Array.isArray(p.categories) && p.categories[0] && typeof p.categories[0] === 'object' ? p.categories[0].title : 'Sarapis'
  const recent = allPosts.slice(0, 3)

  const services: any[] = Array.isArray(hp?.services) ? hp.services : []
  const caseStudies: any[] = Array.isArray(hp?.caseStudies) ? hp.caseStudies : []
  const facts: any[] = Array.isArray(hp?.about?.facts) ? hp.about.facts : []
  const aboutParas: any[] = Array.isArray(hp?.about?.paragraphs) ? hp.about.paragraphs : []

  return (
    <div className="sds-page sds-single">
      {/* Sticky jump nav — client component (hamburger on mobile) */}
      <SpNav navItems={SITE_NAV} logoHref={LOGO_HREF} />

      {/* Hero */}
      <section id="top" className="sds-container">
        <div className="sds-onehero">
          <div>
            {hp?.hero?.eyebrow && <p className="sds-eyebrow">{hp.hero.eyebrow}</p>}
            <h1 className="sds-onehero__title">{hp?.hero?.title || 'Open Source Good'}</h1>
          </div>
          <div>
            {hp?.hero?.lead && <p className="sds-onehero__lead">{hp.hero.lead}</p>}
            <div className="sds-onehero__actions">
              <a className="sds-button sds-button--primary sds-button--md" href={hp?.hero?.primaryCtaHref || '#contact'}>
                {hp?.hero?.primaryCtaLabel || 'Let’s talk'}
              </a>
              <a className="sds-button sds-button--outline sds-button--md" href={hp?.hero?.secondaryCtaHref || '/about'}>
                {hp?.hero?.secondaryCtaLabel || 'About Us'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Posts */}
      {recent.length > 0 && (
        <section id="posts" className="sds-container sds-band sds-band--first" style={{ scrollMarginTop: 90 }}>
          <div className="sds-catalog__head">
            <span>Recent Posts</span>
            <a className="meta" href="/posts" style={{ color: 'var(--sds-primary)', textDecoration: 'none' }}>
              All posts →
            </a>
          </div>
          <div className="sds-grid sds-grid-3" style={{ marginTop: 22 }}>
            {recent.map((p) => {
              const img = mediaUrl(p.heroImage) || mediaUrl(p.meta?.image)
              return (
                <a key={p.id} className="sds-card" href={`/posts/${p.slug}`}>
                  <div className="sds-card__media">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={p.title} />
                    ) : (
                      <div className="sds-card__placeholder">Sarapis</div>
                    )}
                  </div>
                  <div className="sds-card__body">
                    <div><span className="sds-tag">{postCat(p)}</span></div>
                    <h3 className="sds-card__title">{p.title}</h3>
                    <p className="sds-card__date">{fmtMonthYear(p.publishedAt)}</p>
                  </div>
                </a>
              )
            })}
          </div>
        </section>
      )}

      {/* Active Projects — region tabs + lineage (shared with /projects) */}
      <ProjectsView
        basePath="/"
        anchor="#projects"
        region={region}
        restrictActive
        perProjectEvents={1}
        heading="Active Projects"
        metaSlot={
          <a className="sds-seclead__meta" href="/projects" style={{ color: 'var(--sds-primary)', textDecoration: 'none' }}>
            All projects →
          </a>
        }
      />

      {/* Services + Case Studies */}
      {services.length > 0 && (
        <section id="services" className="sds-container sds-band">
          <div className="sds-seclead">
            <h2 className="sds-seclead__title">Services</h2>
            <a className="sds-seclead__meta" href="/services" style={{ color: 'var(--sds-primary)', textDecoration: 'none' }}>
              All services →
            </a>
          </div>
          <div>
            {services.map((s, i) => (
              <a key={i} className="sds-catalog__row" href={`/services#${s.slug || slugify(s.title)}`}>
                <span className="sds-catalog__num">{s.number || String(i + 1).padStart(2, '0')}</span>
                <span className="sds-catalog__title">{s.title}</span>
                <span className="sds-catalog__blurb">{s.blurb}</span>
                <span className="sds-catalog__arrow">→</span>
              </a>
            ))}
          </div>
          {caseStudies.length > 0 && (
            <>
              <div className="sds-catalog__head" style={{ marginTop: 'var(--sds-space-8)', borderBottom: 'none', paddingBottom: 0 }}>
                <span>Case Studies</span>
              </div>
              <div className="sds-feed" style={{ marginTop: 22 }}>
                {caseStudies.map((f, i) => (
                  <a key={i} className="sds-fcard" href={f.href || '#'}>
                    <span className="sds-fcard__kicker">
                      {f.type} <span className="src">· {f.source}</span>
                    </span>
                    <span className="sds-fcard__title">{f.title}</span>
                    <span className="sds-fcard__date">Read the case study →</span>
                  </a>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* About */}
      {(hp?.about?.lede || aboutParas.length > 0) && (
        <section id="about" className="sds-container sds-band">
          <div className="sds-seclead">
            <h2 className="sds-seclead__title">About</h2>
            <a className="sds-seclead__meta" href="/about" style={{ color: 'var(--sds-primary)', textDecoration: 'none' }}>
              Full story &amp; board →
            </a>
          </div>
          <div className="sds-about">
            <div>
              {hp?.about?.lede && <p className="sds-about__lede">{hp.about.lede}</p>}
              {aboutParas.map((para, i) => (
                <p key={i} className="sds-about__body">{para.text}</p>
              ))}
            </div>
            {facts.length > 0 && (
              <div className="sds-about-facts">
                {facts.map((f, i) => (
                  <div key={i} className="sds-fact">
                    <span className="sds-fact__k">{f.key}</span>
                    <span className="sds-fact__v">{f.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Let’s talk */}
      <section id="contact" className="sds-container sds-band" style={{ paddingBottom: 56 }}>
        <section className="sds-callout">
          <h2 className="sds-callout__title">Building something for the public good?</h2>
          <p className="sds-callout__text">
            Tell us what you’re working on — or how you’d like to collaborate. We work in the open with everyone from
            grassroots groups to government agencies.
          </p>
          <ContactForm />
        </section>
      </section>

      {/* Colophon footer (shared with inner pages) */}
      <SiteFooter explore={SITE_NAV} />
    </div>
  )
}
