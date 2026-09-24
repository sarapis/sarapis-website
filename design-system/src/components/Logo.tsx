import * as React from 'react'
import { MARK_DATA_URI } from '../mark'

export interface LogoProps {
  /** Show the "Sarapis" wordmark next to the compass mark. Defaults to true. */
  showWordmark?: boolean
  className?: string
}

/**
 * The Sarapis logo — the multicolor compass mark paired with the "Sarapis"
 * wordmark in the brand serif. The mark is embedded, so the logo is fully
 * self-contained. Set `showWordmark={false}` for the mark alone.
 */
export function Logo({ showWordmark = true, className = '' }: LogoProps) {
  return (
    <span className={`sds-logo ${className}`.trim()}>
      <img className="sds-logo__mark" src={MARK_DATA_URI} alt="Sarapis" width={36} height={36} />
      {showWordmark ? <span className="sds-logo__word">Sarapis</span> : null}
    </span>
  )
}
