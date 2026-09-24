import * as React from 'react'

export interface CalloutProps {
  /** Serif headline on the brand-red band. */
  title: React.ReactNode
  /** Optional supporting line below the title. */
  text?: React.ReactNode
  /** Call-to-action node (typically a Button) shown below the text. */
  action?: React.ReactNode
  className?: string
}

/**
 * Full-width call-to-action band in the brand red — a centered serif headline,
 * optional supporting text, and an action (usually a light Button). Used to
 * close a page ("Building something for the public good?").
 */
export function Callout({ title, text, action, className = '' }: CalloutProps) {
  return (
    <section className={`sds-callout ${className}`.trim()}>
      <h2 className="sds-callout__title">{title}</h2>
      {text ? <p className="sds-callout__text">{text}</p> : null}
      {action ? <div className="sds-callout__actions">{action}</div> : null}
    </section>
  )
}
