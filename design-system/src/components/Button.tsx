import * as React from 'react'

export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  /** Visual style. `primary` is the dark-red brand pill; `outline` and `ghost` are secondary. */
  variant?: 'primary' | 'outline' | 'ghost'
  /** Size of the pill. */
  size?: 'sm' | 'md' | 'lg'
  /** If provided, renders an anchor `<a>` instead of a `<button>`. */
  href?: string
  /** Disables the control. */
  disabled?: boolean
  children?: React.ReactNode
}

/**
 * Primary call-to-action control for the Sarapis brand — a pill button in the
 * brand red (`primary`), or a secondary `outline` / `ghost` variant. Renders as
 * an `<a>` when `href` is set, otherwise a `<button>`.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  href,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const cls = `sds-button sds-button--${variant} sds-button--${size} ${className}`.trim()
  if (href) {
    return (
      <a className={cls} href={href} aria-disabled={disabled || undefined} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <button className={cls} disabled={disabled} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  )
}
