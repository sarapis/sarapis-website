import React from 'react'
import Link from 'next/link'
import { GitHubIcon, BookIcon } from './RdIcons'
import { hashOf, monogram, mediaUrl, siteHref, siteLabel } from './rd'
import { SiteMono, SiteThumb } from './SiteMono'
import { CardImg } from './CardImg'

/** Rounded maroon tile with a two-letter monogram (project / app / post identity). */
export function Mono({ text, size = 40, className = '', site }: { text: string; size?: number; className?: string; site?: string | null }) {
  if (site) return <SiteMono text={text} site={site} size={size} className={className} />
  return (
    <span
      className={`rd-mono ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3), borderRadius: Math.max(4, Math.round(size * 0.225)) }}
    >
      {text}
    </span>
  )
}

/** Placeholder for items without an image: an empty, softly tinted panel (or, with `site`, the site's logo or wordmark). */
export function Thumb({ name, label, site }: { name: string; label?: string; site?: string | null }) {
  if (site) return <SiteThumb name={name} text={label ?? monogram(name)} site={site} />
  const h = hashOf(name, 360)
  return <div className="rd-thumb" style={{ ['--rd-mix' as any]: 18 + (h % 5) * 6 }} />
}

/**
 * Glass card whose image dissolves into the card, with a text panel that grows
 * upward on hover/focus to reveal more (`reveal`). The whole card is one link;
 * links inside `children`/`reveal` sit above it.
 */
export function HoverCard({
  href,
  label,
  ratio = '3 / 4',
  img,
  alt = '',
  thumb,
  className = '',
  gap = 12,
  children,
  reveal,
}: {
  href?: string
  label: string
  ratio?: string
  img?: string | null
  alt?: string
  thumb?: React.ReactNode
  className?: string
  gap?: number
  children: React.ReactNode
  reveal?: React.ReactNode
}) {
  return (
    // With no link inside, a card with hidden reveal content (a board bio) is made focusable
    // itself, so keyboard users can open it via :focus-within.
    <article className={`rd-glass rd-lift rd-rise rd-revealcard ${className}`} tabIndex={!href && reveal ? 0 : undefined}>
      {href && (href.startsWith('/') ? (
        <Link className="rd-cardlink" href={href} aria-label={label} />
      ) : (
        <a className="rd-cardlink" href={href} aria-label={label} />
      ))}
      <div className="rd-media" style={{ aspectRatio: ratio }}>
        <div className="rd-revealimg">
          {/* placeholder art sits underneath, so an image that 404s (or is transparent) just shows it */}
          {thumb}
          {img && <CardImg src={img} alt={alt} />}
        </div>
        <div className="rd-hoverpanel" style={{ gap }}>
          {children}
          {reveal && (
            <div className="rd-reveal">
              <div className="rd-reveal__in">{reveal}</div>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export function IconLink({ href, title, children, fill = false }: { href: string; title: string; children: React.ReactNode; fill?: boolean }) {
  const cls = `rd-ib${fill ? ' rd-ib--fill' : ''}`
  return href.startsWith('/') ? (
    <Link className={cls} href={href} title={title} aria-label={title}>
      {children}
    </Link>
  ) : (
    <a className={cls} href={href} title={title} aria-label={title} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export type ProjectCardData = {
  id: number
  name: string
  region?: string
  status?: string
  summary?: string | null
  site?: string | null
  img?: string | null
  stats: { n: string | number; l: string }[]
  apps: { id: number; name: string; site?: string | null }[]
  activity?: string | null
  gh?: string | null
  featured?: boolean
  ratio?: string
  span?: string
  variant?: 'project' | 'app'
}

/** Project card (home mosaic, /projects) and app card (project page). */
export function ProjectCard({ p }: { p: ProjectCardData }) {
  const app = p.variant === 'app'
  const href = `/projects/${p.id}`
  return (
    <HoverCard
      href={href}
      label={`${p.name} — full profile`}
      ratio={p.ratio || (app ? '4 / 5' : '3 / 4')}
      img={p.img}
      alt="" // decorative: the card link is already labelled, and a missing image must show nothing, not alt text
      thumb={<Thumb name={p.name} site={p.site} />}
      className={`rd-pcard ${p.featured ? 'is-featured' : ''} ${p.span || ''}`}
      gap={app ? 10 : 12}
      reveal={
        <div className="rd-stack" style={{ gap: app ? 10 : 12, paddingTop: app ? 8 : 12 }}>
          {!app && p.stats.length > 0 && (
            <div className="rd-stats">
              {p.stats.map((s) => (
                <div key={s.l}>
                  <div className="rd-stats__n">{s.n}</div>
                  <div className="rd-stats__l">{s.l}</div>
                </div>
              ))}
            </div>
          )}
          {!app && p.apps.length > 0 && (
            <div className="rd-apps">
              {p.apps.map((a) => (
                <Link key={a.id} className="rd-apptile" href={`/projects/${a.id}`} title={a.name} aria-label={a.name}>
                  <SiteMono text={monogram(a.name)} site={a.site} tile={false} />
                </Link>
              ))}
            </div>
          )}
          {p.activity && (
            <div className="rd-actline">
              <span className="rd-actline__dot" />
              <span className="rd-actline__txt">{p.activity}</span>
            </div>
          )}
          <div className="rd-cardfoot">
            {p.site ? (
              <a className="rd-sitelink" href={siteHref(p.site)} target="_blank" rel="noopener noreferrer">
                {siteLabel(p.site)} ↗
              </a>
            ) : (
              <span />
            )}
            <div className="rd-cardfoot__btns">
              {p.gh && (
                <IconLink href={p.gh} title="GitHub">
                  <GitHubIcon size={app ? 14 : 15} />
                </IconLink>
              )}
              {!app && (
                <IconLink href={`${href}#knowledge`} title="Documentation">
                  <BookIcon />
                </IconLink>
              )}
              <IconLink href={href} title="Full profile" fill>
                →
              </IconLink>
            </div>
          </div>
        </div>
      }
    >
      <div className="rd-idrow">
        <div className="rd-idrow__txt">
          <h3 className={app ? 'rd-cardtitle rd-cardtitle--app' : 'rd-cardtitle'}>{p.name}</h3>
          {!app && (
            <div className="rd-cardregion">
              {p.region}
              {p.status && p.status !== 'active' && <span className={`sds-badge sds-badge--${p.status}`} style={{ marginLeft: 8 }}>{p.status}</span>}
            </div>
          )}
        </div>
      </div>
      {p.summary && <p className="rd-cardblurb">{p.summary}</p>}
    </HoverCard>
  )
}

/** Case-study card (home and /services). `c` is a Homepage caseStudies entry; `post` the post it links to (for its image). */
export function CaseStudyCard({ c, post, serviceTitle }: { c: any; post?: any; serviceTitle?: string | null }) {
  const href = c.href && c.href !== '#' ? c.href : undefined
  return (
    <HoverCard
      href={href}
      label={c.title}
      img={post ? mediaUrl(post.heroImage) || mediaUrl(post.meta?.image) : null}
      alt={c.title}
      thumb={<Thumb name={c.title} label={monogram(c.source || c.type || 'CS')} />}
      gap={10}
      reveal={
        <div className="rd-stack" style={{ gap: 10, paddingTop: 6 }}>
          <p className="rd-role">
            {c.source && (
              <>
                <b>Partner:</b> {c.source}
              </>
            )}
            {c.source && serviceTitle && <br />}
            {serviceTitle && (
              <>
                <b>Service:</b> {serviceTitle}
              </>
            )}
          </p>
          {href && (
            <div className="rd-postfoot rd-postfoot--end">
              <IconLink href={href} title="Read the case study" fill>
                →
              </IconLink>
            </div>
          )}
        </div>
      }
    >
      <span className="sds-tag">{c.type}</span>
      <h3 className="rd-cardtitle rd-cardtitle--post">{c.title}</h3>
    </HoverCard>
  )
}

/** slug of the post a case study links to (`/posts/<slug>`), if any */
export const caseStudySlug = (c: any): string | undefined => String(c?.href || '').match(/^\/posts\/([^/?#]+)/)?.[1]
