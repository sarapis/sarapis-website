import React from 'react'

import { RdShell } from '../RdShell'

/**
 * Chrome group — every frontend page EXCEPT the single-page home (`/`) renders
 * inside the shared shell (compass background, nav, footer, "Let's talk" panel).
 * The home page renders the same shell with `home` set (see ../page.tsx). The
 * shell's `.sds-project` wrapper provides the design-system tokens to the chrome
 * (tokens are scoped to .sds-single/.sds-project); inner pages nest their own
 * wrapper inside, which is fine.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <RdShell>{children}</RdShell>
}
