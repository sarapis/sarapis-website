'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/**
 * A case study as a plain row in a ruled list (no card chrome), with an arrow that expands
 * the full report inline: the screenshot at full size, then the write-up (`children`,
 * rendered on the server). Opens when the page is loaded
 * with, or navigated to, its `#id` (the wiki sidebar links here). With no `children`
 * (a case study that links elsewhere, or has no report yet) it is a plain row, and a
 * link if it has an `href`.
 */
export function CaseStudyRow({
  id,
  type,
  title,
  source,
  image,
  href,
  pageHref,
  children,
}: {
  id: string
  type?: string
  title: string
  source?: string
  image?: string | null
  href?: string
  /** the post's own page, offered inside the expanded report */
  pageHref?: string
  children?: React.ReactNode
}) {
  const expandable = !!children
  const [open, setOpen] = useState(false)
  const [imgOk, setImgOk] = useState(!!image)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!expandable) return
    const fromHash = () => {
      if (window.location.hash === `#${id}`) {
        setOpen(true)
        // let the panel start opening, then bring the row to the top
        requestAnimationFrame(() => root.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [id, expandable])

  const summary = (
    <>
      <span className="rd-cs__txt">
        {type && <span className="sds-tag">{type}</span>}
        <span className="rd-cs__title">{title}</span>
        {source && <span className="rd-cs__meta">Partner · {source}</span>}
      </span>
    </>
  )

  return (
    <article ref={root} id={id} className={`rd-cs${open ? ' is-open' : ''}`}>
      {expandable ? (
        <button
          type="button"
          className="rd-cs__head"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((v) => !v)}
        >
          {summary}
          <span className="rd-cs__arrow" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
      ) : href ? (
        <Link className="rd-cs__head" href={href}>
          {summary}
          <span className="rd-cs__arrow" aria-hidden="true">→</span>
        </Link>
      ) : (
        <div className="rd-cs__head rd-cs__head--static">{summary}</div>
      )}
      {expandable && (
        <div id={`${id}-body`} className="rd-cs__body" role="region" aria-label={title} >
          <div className="rd-cs__bodyin">
            <div className="rd-cs__report">
              {image && imgOk && (
                // the full screenshot, uncropped, at the width of the report
                <figure className="rd-cs__shot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt={`Screenshot: ${title}`} loading="lazy" onError={() => setImgOk(false)} />
                </figure>
              )}
              <div className="rd-cs__text">{children}</div>
              {pageHref && (
                <p className="rd-cs__open">
                  <Link href={pageHref}>Open as its own page →</Link>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
