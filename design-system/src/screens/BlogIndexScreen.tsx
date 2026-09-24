import * as React from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Eyebrow } from '../components/Eyebrow'
import { SectionHeading } from '../components/SectionHeading'
import { Card } from '../components/Card'
import { BLOG_POSTS } from './content'

/**
 * The blog index — editorial header plus a responsive grid of post Cards.
 * Iterate here to redesign the real "Writing & updates" listing page.
 */
export function BlogIndexScreen() {
  return (
    <div className="sds-page">
      <Header />

      <section className="sds-container" style={{ paddingBlock: 'var(--sds-space-8)' }}>
        <div style={{ borderBottom: '1px solid var(--sds-border)', paddingBottom: 'var(--sds-space-8)' }}>
          <Eyebrow>The blog</Eyebrow>
          <SectionHeading as="h1" title="Writing &amp; updates" />
          <p className="sds-hero__lead">
            Notes on open-source civic technology, data standards, and the projects we build with
            our partners.
          </p>
        </div>

        <div className="sds-grid sds-grid-3" style={{ marginTop: 'var(--sds-space-8)' }}>
          {BLOG_POSTS.map((p) => (
            <Card key={p.title} title={p.title} href="#" imageUrl={p.img} categories={[p.category]} />
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
