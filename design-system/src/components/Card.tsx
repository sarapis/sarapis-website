import * as React from 'react'
import { Tag } from './Tag'

export interface CardProps {
  /** Card title (rendered in the serif brand face). */
  title: React.ReactNode
  /** Destination URL — the whole card is a link. */
  href?: string
  /** Image URL for the card media area. Omit to show the brand placeholder. */
  imageUrl?: string
  /** Alt text for the image. */
  imageAlt?: string
  /** Category labels shown above the title (rendered as Tags). */
  categories?: string[]
  /** Optional supporting description below the title. */
  description?: React.ReactNode
  /** Optional publish date, shown as a mono dateline under the title. */
  date?: string
  className?: string
}

/**
 * Content card for articles and projects — media area (image or brand
 * placeholder), uppercase category Tags, a serif title, and an optional
 * description. The entire card links to `href`.
 */
export function Card({
  title,
  href,
  imageUrl,
  imageAlt = '',
  categories = [],
  description,
  date,
  className = '',
}: CardProps) {
  const Root: React.ElementType = href ? 'a' : 'div'
  return (
    <Root className={`sds-card ${className}`.trim()} {...(href ? { href } : {})}>
      <div className="sds-card__media">
        {imageUrl ? (
          <img src={imageUrl} alt={imageAlt} />
        ) : (
          <div className="sds-card__placeholder">Sarapis</div>
        )}
      </div>
      <div className="sds-card__body">
        {categories.length > 0 ? (
          <div>
            {categories.map((c, i) => (
              <React.Fragment key={c}>
                <Tag>{c}</Tag>
                {i < categories.length - 1 ? <span>, </span> : null}
              </React.Fragment>
            ))}
          </div>
        ) : null}
        <h3 className="sds-card__title">{title}</h3>
        {date ? <p className="sds-card__date">{date}</p> : null}
        {description ? <p className="sds-card__desc">{description}</p> : null}
      </div>
    </Root>
  )
}
