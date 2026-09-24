'use client'

import React, { useState } from 'react'

const HamburgerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 6h16M3 11h16M3 16h16" />
  </svg>
)
const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M5 5l12 12M17 5 5 17" />
  </svg>
)

/**
 * Sticky jump-nav for the single-page home. Desktop shows the links inline; on
 * mobile it collapses to a hamburger that opens a dropdown panel (and closes when
 * a link is tapped). Styling comes from home.css (.sds-spnav* + the .is-open state).
 */
export function SpNav({
  navItems,
  logoHref = '#top',
}: {
  navItems: { label: string; href: string }[]
  logoHref?: string
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <header className="sds-spnav">
      <div className="sds-container sds-spnav__bar">
        <a href={logoHref} aria-label="Sarapis — home" style={{ textDecoration: 'none', color: 'inherit' }} onClick={close}>
          <span className="sds-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="sds-logo__mark" src="/sarapis-mark.png" alt="Sarapis" width={36} height={36} />
            <span className="sds-logo__word">Sarapis</span>
          </span>
        </a>
        <button
          type="button"
          className="sds-spnav__toggle"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon /> : <HamburgerIcon />}
        </button>
        <nav className={`sds-spnav__nav${open ? ' is-open' : ''}`}>
          {navItems.map((n) => (
            <a key={n.label} className="sds-spnav__link" href={n.href} onClick={close}>
              {n.label}
            </a>
          ))}
          <a className="sds-button sds-button--primary sds-button--sm" href="/donate" onClick={close}>
            Donate
          </a>
        </nav>
      </div>
    </header>
  )
}
