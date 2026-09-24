import * as React from 'react'
import { Logo } from './Logo'
import { Button } from './Button'
import { NAV } from '../screens/content'

export interface HeaderProps {
  className?: string
}

/**
 * Site header — the Sarapis logo, the primary nav (Work + top-level links), and a
 * Donate pill. Presentational; used to give the page screens their top chrome.
 */
export function Header({ className = '' }: HeaderProps) {
  return (
    <header className={`sds-header ${className}`.trim()}>
      <div className="sds-container sds-header__bar">
        <Logo />
        <nav className="sds-header__nav">
          <a className="sds-header__link" href="#">
            Focus Areas ▾
          </a>
          <a className="sds-header__link" href="/activity">
            Activity
          </a>
          {NAV.map((n) => (
            <a key={n.label} className="sds-header__link" href={n.href}>
              {n.label}
            </a>
          ))}
          <Button href="#" size="sm">
            Donate
          </Button>
        </nav>
      </div>
    </header>
  )
}
