/**
 * The single site navigation — used by SpNav on the home page AND on every inner
 * page (via (main)/layout.tsx), so the whole site shares ONE menu system. Links
 * point at the full pages (/posts, /projects, /services, /about) so the menu
 * behaves identically from anywhere; "Let's talk" targets the home contact
 * section (/#contact) since there is no standalone contact page. Logo → home.
 */
export const SITE_NAV = [
  { label: 'Posts', href: '/posts' },
  { label: 'Projects', href: '/projects' },
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Let’s talk', href: '/#contact' },
]

export const LOGO_HREF = '/'
