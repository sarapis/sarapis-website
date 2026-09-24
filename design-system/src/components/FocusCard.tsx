import * as React from 'react'

export interface FocusCardProps {
  /** Focus-area title (serif, brand red). */
  title: React.ReactNode
  /** Short supporting blurb. */
  blurb?: React.ReactNode
  /** Destination URL — the whole tile is a link. */
  href?: string
  className?: string
}

/**
 * Work / focus-area tile — a serif brand-red title with a short blurb, used in
 * the homepage "Our work" grid. The whole tile links to `href`.
 */
export function FocusCard({ title, blurb, href, className = '' }: FocusCardProps) {
  const Root: React.ElementType = href ? 'a' : 'div'
  return (
    <Root className={`sds-focus-card ${className}`.trim()} {...(href ? { href } : {})}>
      <h3 className="sds-focus-card__title">{title}</h3>
      {blurb ? <p className="sds-focus-card__blurb">{blurb}</p> : null}
    </Root>
  )
}
