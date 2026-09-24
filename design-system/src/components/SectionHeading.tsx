import * as React from 'react'

export interface SectionHeadingProps {
  /** The serif heading text. */
  title: React.ReactNode
  /** Optional muted label aligned to the right (e.g. "Four focus areas"). */
  aside?: React.ReactNode
  /** Heading level for semantics. Defaults to `h2`. */
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}

/**
 * Editorial section header — a serif (Fraunces) title with an optional muted
 * aside label on the right. Used to introduce homepage and listing sections.
 */
export function SectionHeading({ title, aside, as = 'h2', className = '' }: SectionHeadingProps) {
  const Tag = as
  return (
    <div className={`sds-section-heading ${className}`.trim()}>
      <Tag className="sds-section-heading__title">{title}</Tag>
      {aside ? <span className="sds-section-heading__aside">{aside}</span> : null}
    </div>
  )
}
