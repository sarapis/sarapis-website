import React from 'react'

import { SpNav } from '../SpNav'
import { SiteFooter } from '../SiteFooter'
import { SITE_NAV, LOGO_HREF } from '../nav'
import '../home.css'

/**
 * Chrome group — every frontend page EXCEPT the single-page home (`/`) renders
 * inside the shared sds nav + colophon footer (same design as the home page).
 * The nav + footer use the ONE shared `SITE_NAV` (see ../nav.ts), identical to
 * the home page's menu, so the whole site has a single menu system.
 * The `.sds-project` wrapper provides the design-system tokens to the chrome
 * (tokens are scoped to .sds-single/.sds-project); inner pages nest their own
 * wrapper inside, which is fine.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sds-project">
      <SpNav navItems={SITE_NAV} logoHref={LOGO_HREF} />
      {children}
      <SiteFooter explore={SITE_NAV} />
    </div>
  )
}
