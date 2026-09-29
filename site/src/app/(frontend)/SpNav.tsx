'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import type { NavItem } from './nav'

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
 * Sticky nav. On the home page (`home`) the links are same-page jumps, the bar
 * starts translucent and turns solid as you scroll (CSS scroll timeline, see
 * redesign.css), and the active link is the last section whose top has scrolled
 * above the viewport's vertical centre. Elsewhere the links go back to the home
 * sections and the bar is solid from the top. Collapses to a hamburger on mobile.
 */
export function SpNav({
  navItems,
  logoHref = '/',
  home = false,
}: {
  navItems: NavItem[]
  logoHref?: string
  home?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string | null>(home ? navItems[0]?.id ?? null : null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!home) return
    const ids = navItems.map((n) => n.id).filter(Boolean) as string[]
    const spy = () => {
      const mid = window.innerHeight / 2
      let cur = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= mid) cur = id
      }
      setActive(cur)
    }
    window.addEventListener('scroll', spy, { passive: true })
    spy()
    return () => window.removeEventListener('scroll', spy)
  }, [home, navItems])

  return (
    <header className={`sds-spnav rd-nav${home ? ' rd-nav--home' : ''}`}>
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
            <a
              key={n.label}
              className={`sds-spnav__link${home && active === n.id ? ' is-active' : ''}`}
              href={home ? n.href.replace(/^\//, '') : n.href}
              onClick={close}
            >
              {n.label}
            </a>
          ))}
          <Link className="sds-button sds-button--primary sds-button--sm" href="/donate" onClick={close}>
            Donate
          </Link>
        </nav>
      </div>
    </header>
  )
}
