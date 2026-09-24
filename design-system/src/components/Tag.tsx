import * as React from 'react'

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode
}

/**
 * Uppercase brand-red category label used on article and project cards
 * (e.g. "OPEN GOVERNMENT"). Inline; pair multiple with commas.
 */
export function Tag({ className = '', children, ...rest }: TagProps) {
  return (
    <span className={`sds-tag ${className}`.trim()} {...rest}>
      {children}
    </span>
  )
}
