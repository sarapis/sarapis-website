import * as React from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Eyebrow } from '../components/Eyebrow'
import { SectionHeading } from '../components/SectionHeading'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Callout } from '../components/Callout'
import { OPEN_GOV } from './content'

/**
 * A Work focus-area page (Open Government shown) — intro, a "Recent Work" project grid,
 * a pull-quote, a "Perspectives" grid, and a CTA. Mirrors the live work-area layout.
 */
export function WorkAreaScreen() {
  return (
    <div className="sds-page">
      <Header />

      <section className="sds-container sds-hero__inner">
        <Eyebrow>Open Government</Eyebrow>
        <h1 className="sds-hero__title" style={{ fontSize: 'clamp(1.75rem, 1rem + 3vw, 2.75rem)' }}>
          {OPEN_GOV.title}
        </h1>
        <p className="sds-hero__lead">{OPEN_GOV.lead}</p>
      </section>

      <section className="sds-container sds-section">
        <div className="sds-section__head">
          <SectionHeading title="Recent Work" />
        </div>
        <div className="sds-grid sds-grid-3">
          {OPEN_GOV.recentWork.map((p) => (
            <Card key={p.title} title={p.title} href="#" imageUrl={p.img} categories={[p.category]} />
          ))}
        </div>
      </section>

      <section className="sds-container sds-section">
        <blockquote
          style={{
            fontFamily: 'var(--sds-font-serif)',
            fontSize: '1.4rem',
            lineHeight: 1.4,
            maxWidth: '42rem',
            margin: '0 auto',
            paddingLeft: 'var(--sds-space-6)',
            borderLeft: '3px solid var(--sds-primary)',
            color: 'var(--sds-foreground)',
          }}
        >
          {OPEN_GOV.quote}
        </blockquote>
      </section>

      <section className="sds-container sds-section">
        <div className="sds-section__head">
          <SectionHeading title="Perspectives" />
        </div>
        <div className="sds-grid sds-grid-3">
          {OPEN_GOV.perspectives.map((p) => (
            <Card key={p.title} title={p.title} href="#" imageUrl={p.img} categories={[p.category]} />
          ))}
        </div>
      </section>

      <section className="sds-container sds-section">
        <Callout
          title="Work with Sarapis"
          text="Let's solve problems the open source way."
          action={
            <Button href="#" variant="outline" style={{ background: 'var(--sds-background)' }}>
              Get in touch
            </Button>
          }
        />
      </section>

      <Footer />
    </div>
  )
}
