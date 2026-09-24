import * as React from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Eyebrow } from '../components/Eyebrow'
import { SectionHeading } from '../components/SectionHeading'
import { FocusCard } from '../components/FocusCard'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Callout } from '../components/Callout'
import { MARK_DATA_URI } from '../mark'
import { WORK_AREAS, RECENT_POSTS } from './content'

/**
 * The Sarapis home page — full-screen composition of the real layout: hero statement,
 * "Our work" focus-area grid, "Recent writing", and a closing call-to-action band.
 * Iterate on this to redesign the actual home page.
 */
export function HomeScreen() {
  return (
    <div className="sds-page">
      <Header />

      <section className="sds-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sds-hero__mark" src={MARK_DATA_URI} alt="" aria-hidden="true" />
        <div className="sds-container sds-hero__inner">
          <Eyebrow>Free, libre &amp; open source · 501(c)(3) nonprofit</Eyebrow>
          <h1 className="sds-hero__title">Technology should belong to the people it serves.</h1>
          <p className="sds-hero__lead">
            For over a decade, Sarapis has built free, libre &amp; open source solutions
            <span style={{ fontStyle: 'italic' }}> with</span> — not for — nonprofits and the
            public sector.
          </p>
          <div className="sds-hero__actions">
            <Button href="#">Let&rsquo;s talk</Button>
            <Button href="#" variant="outline">
              Read our story
            </Button>
          </div>
        </div>
      </section>

      <section className="sds-container sds-section">
        <div className="sds-section__head">
          <SectionHeading title="Our work" />
          <span style={{ fontSize: '0.875rem', color: 'var(--sds-muted-foreground)' }}>
            Four focus areas
          </span>
        </div>
        <div className="sds-grid sds-grid-4">
          {WORK_AREAS.map((w) => (
            <FocusCard key={w.label} title={w.label} blurb={w.blurb} href={w.href} />
          ))}
        </div>
      </section>

      <section className="sds-container sds-section">
        <div className="sds-section__head">
          <SectionHeading title="Recent writing" />
          <a href="#" style={{ fontSize: '0.875rem', color: 'var(--sds-primary)' }}>
            View all →
          </a>
        </div>
        <div className="sds-grid sds-grid-3">
          {RECENT_POSTS.map((p) => (
            <Card key={p.title} title={p.title} href="#" imageUrl={p.img} categories={[p.category]} />
          ))}
        </div>
      </section>

      <section className="sds-container sds-section">
        <Callout
          title="Building something for the public good?"
          text="We partner with mission-driven organizations to design, build, and maintain open solutions."
          action={
            <Button href="#" variant="outline" style={{ background: 'var(--sds-background)' }}>
              Work with Sarapis
            </Button>
          }
        />
      </section>

      <Footer />
    </div>
  )
}
