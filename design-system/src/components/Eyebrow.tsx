import * as React from 'react'

export interface EyebrowProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode
}

/**
 * Small brand-red kicker line that sits above a heading (e.g. "Free, libre &
 * open source · 501(c)(3) nonprofit"). Use to label a section before its title.
 */
export function Eyebrow({ className = '', children, ...rest }: EyebrowProps) {
  return (
    <p className={`sds-eyebrow ${className}`.trim()} {...rest}>
      {children}
    </p>
  )
}
