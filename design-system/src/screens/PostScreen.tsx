import * as React from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Tag } from '../components/Tag'
import { POST } from './content'

/**
 * A blog post page — contained editorial header (category, serif title, date, framed
 * hero image) followed by the article body. Iterate here to redesign the real post page.
 */
export function PostScreen() {
  return (
    <div className="sds-page">
      <Header />

      <article style={{ paddingBlock: 'var(--sds-space-8)' }}>
        <header className="sds-container">
          <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
            <Tag>{POST.category}</Tag>
            <h1
              style={{
                fontFamily: 'var(--sds-font-serif)',
                fontWeight: 500,
                fontSize: 'clamp(1.9rem, 1rem + 3vw, 3rem)',
                lineHeight: 1.1,
                margin: 'var(--sds-space-3) 0 var(--sds-space-4)',
              }}
            >
              {POST.title}
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--sds-muted-foreground)' }}>{POST.date}</p>
          </div>
          <div
            style={{
              maxWidth: '56rem',
              margin: 'var(--sds-space-8) auto 0',
              aspectRatio: '16 / 9',
              overflow: 'hidden',
              borderRadius: 'var(--sds-radius-lg)',
              border: '1px solid var(--sds-border)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={POST.hero}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </header>

        <div className="sds-container" style={{ marginTop: 'var(--sds-space-8)' }}>
          <div className="sds-prose">
            {POST.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </article>

      <Footer />
    </div>
  )
}
