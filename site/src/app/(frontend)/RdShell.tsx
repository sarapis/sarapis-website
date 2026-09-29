import React from 'react'
import { SpNav } from './SpNav'
import { SiteFooter } from './SiteFooter'
import { LetsTalk } from './LetsTalk'
import { ArrowUpIcon } from './RdIcons'
import { SITE_NAV, FOOTER_NAV, LOGO_HREF } from './nav'
import './home.css'
import './redesign.css'

/**
 * Page chrome shared by the whole site: the persistent compass background, the
 * sticky nav, the footer, the floating "Let's talk" panel and back-to-top. The
 * home page (`home`) uses the `.sds-single` token scope and a nav that reads the
 * scroll position; every other page uses `.sds-project`.
 */
export function RdShell({ home = false, children }: { home?: boolean; children: React.ReactNode }) {
  return (
    <div id="top" className={`rd-shell ${home ? 'sds-single' : 'sds-project'}`}>
      <div className="rd-compass" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rd-compass__halo" src="/sarapis-mark.svg" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rd-compass__mark" src="/sarapis-mark.svg" alt="" />
        <div className="rd-compass__wash" />
      </div>
      <SpNav navItems={SITE_NAV} logoHref={LOGO_HREF} home={home} />
      <div className="rd-content">{children}</div>
      <SiteFooter explore={FOOTER_NAV} />
      <LetsTalk />
      <a className="rd-totop" href="#top" aria-label="Back to top" title="Back to top">
        <ArrowUpIcon />
      </a>
    </div>
  )
}
