/**
 * Site navigation. The header carries the home page's section links: on the home
 * page they are same-page jumps (with a scroll-spy), on every other page they
 * return to the matching home section. The footer links to the full pages.
 * "Let’s talk" opens the floating contact panel (see LetsTalk.tsx) from anywhere.
 */
export type NavItem = { label: string; href: string; id?: string }

export const SITE_NAV: NavItem[] = [
  { label: 'Projects', href: '/#projects', id: 'projects' },
  { label: 'In the open', href: '/#open', id: 'open' },
  { label: 'Posts', href: '/#posts', id: 'posts' },
  { label: 'Services', href: '/#services', id: 'services' },
  { label: 'About', href: '/#about', id: 'about' },
]

export const FOOTER_NAV: NavItem[] = [
  { label: 'Projects', href: '/projects' },
  { label: 'Posts', href: '/posts' },
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Let’s talk', href: '/#contact' },
]

export const LOGO_HREF = '/'
