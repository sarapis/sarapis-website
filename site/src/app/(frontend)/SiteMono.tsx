'use client'

import React, { useEffect, useRef, useState } from 'react'
import { hashOf, siteKey, WORDMARK_STYLES } from './rd'

/** Bump when /next/logo starts returning different images, so browsers that cached the old response (24h) refetch. */
const LOGO_URL_VERSION = 2

const hostOf = (site?: string | null): string | null => {
  if (!site) return null
  try {
    return new URL(/^https?:\/\//.test(site) ? site : `https://${site}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * A project's logo tile: the site's own icon (served by /next/logo) when it has
 * one that is big enough to look right, otherwise the two-letter monogram. With no
 * `site`, or while the icon loads or if it is missing/tiny, the monogram shows.
 * `tile` = the maroon rounded tile (cards, profile header); otherwise it is just the
 * glyph, to sit inside an existing box (the small subproject tiles).
 */
export function SiteMono({
  text,
  site,
  size,
  tile = true,
  className = '',
}: {
  text: string
  site?: string | null
  size?: number
  tile?: boolean
  className?: string
}) {
  const host = hostOf(site)
  const [ok, setOk] = useState(false)
  const [failed, setFailed] = useState(!host)
  const img = useRef<HTMLImageElement>(null)

  const judge = (el: HTMLImageElement) => {
    // A 16px favicon blown up to a 40px tile looks worse than the monogram.
    if (el.naturalWidth >= 32) setOk(true)
    else setFailed(true)
  }
  useEffect(() => {
    const el = img.current
    if (el?.complete) (el.naturalWidth > 0 ? judge(el) : setFailed(true))
  }, [])

  const style: React.CSSProperties | undefined =
    tile && size ? { width: size, height: size, fontSize: Math.round(size * 0.3), borderRadius: Math.max(4, Math.round(size * 0.225)) } : undefined
  return (
    <span className={`${tile ? 'rd-mono' : 'rd-glyph'}${ok ? ' is-logo' : ''} ${className}`} style={style}>
      {!ok && text}
      {host && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          className="rd-logoimg"
          src={`/next/logo?u=${encodeURIComponent(siteKey(site) || host)}&v=${LOGO_URL_VERSION}`}
          alt=""
          // hidden (not display:none, which would stop it loading) until it is judged big enough
          style={ok ? undefined : { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          onLoad={(e) => judge(e.currentTarget)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}

/**
 * True for a "knock-out" logo: light artwork on a transparent background (made for a
 * dark page), which would vanish on a white panel. Samples the image on a tiny canvas;
 * an opaque image (e.g. a logo on its own white square) is never one.
 */
function isKnockout(el: HTMLImageElement): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    ctx.drawImage(el, 0, 0, 32, 32)
    const d = ctx.getImageData(0, 0, 32, 32).data
    let opaque = 0
    let lum = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 128) {
        opaque++
        lum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
      }
    }
    const total = 32 * 32
    return opaque > 20 && opaque < total * 0.8 && lum / opaque > 0.82
  } catch {
    return false // tainted or unreadable canvas: assume a normal logo
  }
}

/**
 * Image area for a project card: the site's own logo filling a plain white panel,
 * or — when the site has no logo, or only a tiny one — the tinted placeholder art
 * (compass mark + big serif monogram). Used by `Thumb`.
 */
export function SiteThumb({ name, text, site }: { name: string; text: string; site?: string | null }) {
  const host = hostOf(site)
  const [ok, setOk] = useState(false)
  const [light, setLight] = useState(false)
  const [failed, setFailed] = useState(!host)
  const img = useRef<HTMLImageElement>(null)

  const judge = (el: HTMLImageElement) => {
    // shown ~300px wide, so anything much smaller than 48px would look soft
    if (el.naturalWidth >= 48) {
      setLight(isKnockout(el))
      setOk(true)
    } else setFailed(true)
  }
  useEffect(() => {
    const el = img.current
    if (el?.complete) (el.naturalWidth > 0 ? judge(el) : setFailed(true))
  }, [])

  // No logo image: use the site's header title text ("DATABOOK.NYC") as a wordmark, until it has a real logo.
  const [word, setWord] = useState<string | null>(null)
  useEffect(() => {
    const key = siteKey(site)
    if (!failed || !host || !key) return
    let live = true
    fetch(`/next/wordmark?u=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j?.text && setWord(j.text))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [failed, host, site])

  const h = hashOf(name, 360)
  if (word && !ok) {
    const st = WORDMARK_STYLES[siteKey(site) || '']
    const scale = st?.size ?? 1
    const textStyle: React.CSSProperties = {
      fontSize: `clamp(${1.25 * scale}rem, ${Math.max(1.6, 4.2 - word.length * 0.16) * scale}vw, ${Math.max(1.5, 2.9 - word.length * 0.09) * scale}rem)`,
      ...(st && { fontFamily: st.fontFamily, fontWeight: st.fontWeight, letterSpacing: st.letterSpacing }),
      ...(st?.color && { color: st.color }),
      ...(st?.gradient && { backgroundImage: st.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' }),
    }
    return (
      <div className="rd-thumb rd-thumb--logo rd-thumb--word" style={st ? { background: st.background } : undefined}>
        <span className="rd-wordmark">
          <span style={textStyle}>{word}</span>
        </span>
      </div>
    )
  }
  return (
    <div
      className={`rd-thumb${ok ? ' rd-thumb--logo' : ''}${ok && light ? ' rd-thumb--knockout' : ''}`}
      style={{ ['--rd-rot' as any]: `${h}deg`, ['--rd-mix' as any]: 18 + (h % 5) * 6 }}
    >
      {!ok && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rd-thumb__mark" src="/sarapis-mark.svg" alt="" />
          <span className="rd-thumb__mono">{text}</span>
        </>
      )}
      {host && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          className="rd-thumb__logo"
          src={`/next/logo?u=${encodeURIComponent(siteKey(site) || host)}&v=${LOGO_URL_VERSION}`}
          alt=""
          // hidden (not display:none, which would stop it loading) until it is judged big enough
          style={ok ? undefined : { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          onLoad={(e) => judge(e.currentTarget)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
