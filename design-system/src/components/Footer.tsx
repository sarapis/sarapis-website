import * as React from 'react'
import { Logo } from './Logo'
import { NAV, WORK_AREAS } from '../screens/content'

export interface FooterProps {
  className?: string
}

/**
 * Site footer — warm near-black band mirroring the header: a "Work" column (the four
 * focus areas), a "Menu" column (top-level links + Donate), the logo, and a note.
 */
export function Footer({ className = '' }: FooterProps) {
  return (
    <footer className={`sds-footer ${className}`.trim()}>
      <div className="sds-container">
        <div className="sds-footer__inner">
          <div style={{ maxWidth: '20rem' }}>
            <Logo />
            <p className="sds-footer__note" style={{ marginTop: 'var(--sds-space-4)' }}>
              Free, libre &amp; open source solutions for nonprofits and the public sector.
            </p>
          </div>
          <div className="sds-footer__cols">
            <div>
              <p className="sds-footer__heading">Focus Areas</p>
              {WORK_AREAS.map((w) => (
                <a key={w.label} className="sds-footer__link" href={w.href}>
                  {w.label}
                </a>
              ))}
            </div>
            <div>
              <p className="sds-footer__heading">Menu</p>
              {NAV.map((n) => (
                <a key={n.label} className="sds-footer__link" href={n.href}>
                  {n.label}
                </a>
              ))}
              <a className="sds-footer__link" href="#">
                Donate
              </a>
            </div>
          </div>
        </div>
        <div
          className="sds-footer__note sds-footer__note--divider"
          style={{ paddingBlock: 'var(--sds-space-6)' }}
        >
          © Sarapis · 501(c)(3) nonprofit
        </div>
      </div>
    </footer>
  )
}
