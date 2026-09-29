'use client'

import React, { useEffect, useRef, useState } from 'react'

/** Counts from 0 to `value` (ease-out, 1.3s) the first time it scrolls into view. Renders the real number without JS. */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return
        io.disconnect()
        const t0 = performance.now()
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / 1300)
          setShown(Math.round(value * (1 - Math.pow(1 - k, 3))))
          if (k < 1) raf = requestAnimationFrame(step)
        }
        setShown(0)
        raf = requestAnimationFrame(step)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value])

  return <span ref={ref}>{(shown ?? value).toLocaleString('en-US')}</span>
}
