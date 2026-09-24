import React from 'react'
import Link from 'next/link'

/**
 * Shared colophon footer (sds design) — used by the single-page home and by every
 * inner page via the (main) layout, so the whole site shares one footer.
 * `explore` are the primary nav links; on the home page they are hash jump-links,
 * on inner pages they are routes.
 */
export function SiteFooter({ explore }: { explore: { label: string; href: string }[] }) {
  return (
    <footer className="sds-footer">
      <div className="sds-container">
        <div className="sds-footer__inner">
          <div style={{ maxWidth: '22rem' }}>
            <span className="sds-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="sds-logo__mark" src="/sarapis-mark.png" alt="Sarapis" width={32} height={32} />
              <span className="sds-logo__word">Sarapis</span>
            </span>
            <p className="sds-footer__note" style={{ marginTop: 'var(--sds-space-3)' }}>
              Free, libre &amp; open source solutions for nonprofits and the public sector.
            </p>
          </div>
          <nav className="sds-footer__links" aria-label="Footer">
            {explore.map((n) => (
              <a key={n.label} className="sds-footer__link" href={n.href}>{n.label}</a>
            ))}
            <Link className="sds-footer__link" href="/donate">Donate</Link>
          </nav>
        </div>
        <div className="sds-footer__note sds-footer__note--divider" style={{ paddingBlock: 'var(--sds-space-3)' }}>
          © Sarapis · a New York-incorporated 501(c)(3) nonprofit · EIN 27-1074148 · contributions are tax-deductible
        </div>
      </div>
    </footer>
  )
}
