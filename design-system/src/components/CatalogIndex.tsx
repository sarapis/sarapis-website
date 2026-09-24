import React from 'react'

export interface CatalogEntry {
  /** Display number, e.g. "01". Falls back to the row index + 1. */
  num?: string
  title: string
  blurb?: string
  href?: string
}

export interface CatalogIndexProps {
  /** Left-hand head label, e.g. "Index of work". */
  label: string
  /** Right-hand head meta, e.g. "Four areas" or a date range. */
  meta?: string
  entries: CatalogEntry[]
  className?: string
}

/**
 * CatalogIndex — Sarapis's "card-catalog" list pattern.
 *
 * A numbered, ruled index used for focus areas, archives, or any
 * scannable list. Saffron accent bar animates in on hover. This is the
 * information-management identity made literal.
 *
 * Styles live in styles.css under the `.sds-catalog` block.
 *
 *   <CatalogIndex
 *     label="Focus Areas"
 *     entries={workAreas.map(w => ({ title: w.label, blurb: w.blurb, href: w.href }))}
 *   />
 */
export function CatalogIndex({ label, meta, entries, className = '' }: CatalogIndexProps) {
  return (
    <div className={`sds-catalog ${className}`.trim()}>
      <div className="sds-catalog__head">
        <span>{label}</span>
        {meta ? <span className="meta">{meta}</span> : null}
      </div>
      {entries.map((e, i) => {
        const Root = e.href ? 'a' : 'div'
        const num = e.num ?? String(i + 1).padStart(2, '0')
        return (
          <Root
            key={e.title}
            className="sds-catalog__row"
            {...(e.href ? { href: e.href } : {})}
          >
            <span className="sds-catalog__num">{num}</span>
            <span className="sds-catalog__title">{e.title}</span>
            <span className="sds-catalog__blurb">{e.blurb}</span>
            <span className="sds-catalog__arrow" aria-hidden="true">&rarr;</span>
          </Root>
        )
      })}
    </div>
  )
}

export default CatalogIndex
