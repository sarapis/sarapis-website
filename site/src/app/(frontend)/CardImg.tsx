'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * A card image that removes itself if it fails to load (a project site with no
 * social-preview image answers 404), so the placeholder art underneath shows
 * cleanly instead of a broken-image icon.
 */
export function CardImg({ src, alt = '' }: { src: string; alt?: string }) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const el = ref.current
    // an error that fired before hydration never reaches onError
    if (el?.complete && el.naturalWidth === 0) setFailed(true)
  }, [])
  if (failed) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
}
