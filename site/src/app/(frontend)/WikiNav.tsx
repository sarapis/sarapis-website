'use client'

import React, { useEffect, useState } from 'react'

export type WikiItem = { id: string; label: string; num?: string; children?: { id: string; label: string }[] }

/**
 * The left sidebar of the Services page: a sticky table of contents in the style of a
 * wiki. Top level = the services; nested = their case studies. The entry for the
 * section you are reading is highlighted (the last heading whose top has scrolled past
 * the upper third of the viewport). Stacks above the content on small screens.
 */
export function WikiNav({ items, title = 'Contents' }: { items: WikiItem[]; title?: string }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    const ids = items.flatMap((i) => [i.id, ...(i.children || []).map((c) => c.id)])
    const spy = () => {
      const line = window.innerHeight / 3
      let cur = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) cur = id
      }
      setActive(cur)
    }
    window.addEventListener('scroll', spy, { passive: true })
    spy()
    return () => window.removeEventListener('scroll', spy)
  }, [items])

  return (
    <nav className="rd-wikinav" aria-label={title}>
      <div className="rd-wikinav__title">{title}</div>
      <ul className="rd-wikinav__list">
        {items.map((s) => {
          const inService = active === s.id || (s.children || []).some((c) => c.id === active)
          return (
            <li key={s.id}>
              <a className={`rd-wikinav__svc${inService ? ' is-active' : ''}`} href={`#${s.id}`}>
                {s.num && <span className="rd-wikinav__num">{s.num}</span>}
                {s.label}
              </a>
              {s.children && s.children.length > 0 && (
                <ul className="rd-wikinav__sub">
                  {s.children.map((c) => (
                    <li key={c.id}>
                      <a className={`rd-wikinav__case${active === c.id ? ' is-active' : ''}`} href={`#${c.id}`}>
                        {c.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
