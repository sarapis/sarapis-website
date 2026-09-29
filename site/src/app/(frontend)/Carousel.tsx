'use client'

import React, { useRef } from 'react'
import { ArrowLeftIcon, ArrowRightIcon } from './RdIcons'

/**
 * Horizontal scroll-snap track that shows three cards at a time. The header row
 * (`head`, optional `extra`, and the ← → buttons) sits above the track. Pass
 * `arrows={false}` when there are three or fewer cards — then it is just a row.
 */
export function Carousel({
  head,
  extra,
  headClassName = 'rd-head',
  arrows = true,
  below,
  children,
}: {
  head: React.ReactNode
  extra?: React.ReactNode
  headClassName?: string
  arrows?: boolean
  /** Rendered between the header row and the track (e.g. a filter row). */
  below?: React.ReactNode
  children: React.ReactNode
}) {
  const track = useRef<HTMLDivElement>(null)
  const slide = (dir: number) => {
    const el = track.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const w = card ? card.getBoundingClientRect().width + 20 : el.clientWidth / 3
    el.scrollBy({ left: dir * w, behavior: 'smooth' })
  }
  return (
    <>
      <div className={headClassName}>
        {head}
        <div className="rd-carctl">
          {extra}
          {arrows && (
            <div className="rd-carbtns">
              <button type="button" className="rd-trackbtn" aria-label="Previous" onClick={() => slide(-1)}>
                <ArrowLeftIcon />
              </button>
              <button type="button" className="rd-trackbtn" aria-label="Next" onClick={() => slide(1)}>
                <ArrowRightIcon />
              </button>
            </div>
          )}
        </div>
      </div>
      {below}
      <div className="rd-track" ref={track}>
        {children}
      </div>
    </>
  )
}
