import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'

/**
 * Shared Projects section — region tabs + lineage hierarchy + per-project
 * activity feed. Used by the home page ("Active Projects", active-only, no
 * status filter, links out to /projects) and the /projects All Projects page
 * (every status, with the status filter). Self-contained: fetches its own data.
 */

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
const fmtMonthYear = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase() : ''

const eventDot: Record<string, string> = { commit: 'code', pr: 'code', release: 'release', repo: 'repo' }
const statusBadge: Record<string, string> = { active: 'active', reached: 'reached', declared: 'declared' }

const REGIONS = [
  { key: 'all', name: 'All Projects', tag: 'Everything we build', text: 'Every open-source project we actively build and maintain — local civic tech in New York City and infrastructure for the global movement.' },
  { key: 'nyc', name: 'New York City', tag: 'Local civic tech', text: 'Open tools and shared data built with NYC agencies and community groups to make city government legible and accountable.' },
  { key: 'global', name: 'Global Movement', tag: 'Open source at large', text: 'Platforms, standards and infrastructure we maintain for communities and institutions worldwide.' },
]

const PROJECT_STATUSES: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Declared', value: 'declared' },
  { label: 'Active', value: 'active' },
  { label: 'Reached', value: 'reached' },
]

export async function ProjectsView({
  basePath,
  anchor = '',
  region,
  pstatus = null,
  restrictActive = false,
  showStatusFilter = false,
  perProjectEvents = 3,
  heading,
  metaSlot,
}: {
  basePath: string
  anchor?: string
  region: 'all' | 'nyc' | 'global'
  pstatus?: string | null
  restrictActive?: boolean
  showStatusFilter?: boolean
  perProjectEvents?: number
  heading: string
  metaSlot?: React.ReactNode
}) {
  const payload = await getPayload({ config: configPromise })
  const projectsRes = await payload.find({
    collection: 'projects',
    where: { published: { equals: true } },
    sort: 'name',
    limit: 200,
    depth: 1,
  })
  const allProjects = projectsRes.docs as any[]

  const pId = (p: any) => p?.id
  const parentId = (p: any) => (p?.parent && typeof p.parent === 'object' ? p.parent.id : p.parent) ?? null
  const regionOf = (p: any) => (p?.region === 'global' ? 'global' : 'nyc')
  // Home restricts to active projects; the All Projects page shows every status.
  const inScope = (p: any) => (restrictActive ? p.status === 'active' : true)

  // Per-project recent activity.
  const visibleIds = allProjects.map(pId)
  const eventsByProject = new Map<number, any[]>()
  const lastActiveByProject = new Map<number, string>()
  if (visibleIds.length) {
    const evRes = await payload.find({
      collection: 'activity-events',
      where: { published: { equals: true }, project: { in: visibleIds } } as Where,
      // Pinned events float to the front so a single-item card (home) shows the
      // curated highlight if one exists, else the most recent event.
      sort: ['-pinned', '-occurredAt'],
      limit: 400,
      depth: 0,
    })
    for (const e of evRes.docs as any[]) {
      const idp = e.project && typeof e.project === 'object' ? e.project.id : e.project
      if (idp == null) continue
      if (!eventsByProject.has(idp)) eventsByProject.set(idp, [])
      const arr = eventsByProject.get(idp)!
      if (arr.length < perProjectEvents) arr.push(e)
      // "Last activity" label = most recent event, independent of pinning.
      const prev = lastActiveByProject.get(idp)
      if (!prev || (e.occurredAt && e.occurredAt > prev)) lastActiveByProject.set(idp, e.occurredAt)
    }
  }

  const countFor = (r: string) => allProjects.filter((p) => (r === 'all' || regionOf(p) === r) && inScope(p)).length
  const regionProjects = allProjects
    .filter((p) => (region === 'all' || regionOf(p) === region) && inScope(p))
    .filter((p) => (pstatus ? p.status === pstatus : true))
  const idSet = new Set(regionProjects.map(pId))
  const childrenOf = new Map<number, any[]>()
  const topLevel: any[] = []
  for (const p of regionProjects) {
    const par = parentId(p)
    if (par != null && idSet.has(par)) {
      if (!childrenOf.has(par)) childrenOf.set(par, [])
      childrenOf.get(par)!.push(p)
    } else topLevel.push(p)
  }
  topLevel.sort((a, b) => {
    const rank = (p: any) => (p.role === 'flagship' || childrenOf.has(pId(p)) ? 0 : 1)
    return rank(a) - rank(b) || String(a.name).localeCompare(String(b.name))
  })

  const projHref = (id: number) => `/projects/${id}`
  const regionHref = (r: string) => {
    const u = new URLSearchParams()
    if (r !== 'all') u.set('region', r)
    if (pstatus) u.set('pstatus', pstatus)
    const s = u.toString()
    return (s ? `${basePath}?${s}` : basePath) + anchor
  }
  const chipHref = (val: string | null) => {
    const u = new URLSearchParams()
    if (region !== 'all') u.set('region', region)
    if (val) u.set('pstatus', val)
    const s = u.toString()
    return (s ? `${basePath}?${s}` : basePath) + anchor
  }

  const activityFeed = (p: any) => {
    const evs = eventsByProject.get(pId(p)) || []
    if (!evs.length) {
      return (
        <div className="sds-empty" style={{ margin: 14, border: 'none', background: 'transparent', padding: '14px 16px' }}>
          No activity synced yet.
        </div>
      )
    }
    return evs.map((e, i) => (
      <div className="sds-trow" key={i}>
        <div className="sds-trow__date">{fmtDate(e.occurredAt)}</div>
        <div className={`sds-tdot sds-tdot--${eventDot[e.kind] || 'code'}`} />
        <div>
          <span className="sds-lrow__title" style={{ fontSize: 13.5 }}>
            {e.title}{' '}
            {e.repoFullName && <span className="repo" style={{ fontFamily: 'var(--sds-font-mono)', fontWeight: 700, color: 'var(--sds-primary)' }}>{e.repoFullName}</span>}
          </span>
          {(e.summary || e.note) && <p className="sds-esum">{e.summary || e.note}</p>}
        </div>
      </div>
    ))
  }

  const ProjectCard = ({ p }: { p: any }) => {
    const kids = childrenOf.get(pId(p)) || []
    const isFlagship = p.role === 'flagship' || kids.length > 0
    const last = lastActiveByProject.get(pId(p))
    return (
      <div className="sds-pcardwrap">
        <div className="sds-pcard">
          <div className="sds-pcard__main">
            <div className="sds-pcard__head">
              <a href={projHref(pId(p))} style={{ textDecoration: 'none' }}>
                <h3 className="sds-pcard__title">{p.name}</h3>
              </a>
              <span className={`sds-badge sds-badge--${statusBadge[p.status] || 'declared'}`}>
                {p.status === 'active' && <span className="dot" />}
                {p.status}
              </span>
            </div>
            {(isFlagship || p.lineage) && (
              <div className="sds-lstrip">
                <span className="sds-lchip">{isFlagship ? '★ Flagship platform' : p.lineage}</span>
                {isFlagship && (
                  <span className="sds-lnote">
                    Integrates <strong>{kids.length}</strong> app{kids.length === 1 ? '' : 's'} that began as experiments
                  </span>
                )}
              </div>
            )}
            {p.summary && <p className="sds-pcard__blurb">{p.summary}</p>}
            {/* Who leads it / what Sarapis does — reuses .sds-lstrip (already carries
                the card's 0 16px inset) and .sds-lnote (mono, muted, with strong in
                primary), so no new CSS and the design-system sync stays at r34. */}
            {(p.projectLeader || p.sarapisRole) && (
              <div className="sds-lstrip">
                {p.projectLeader && (
                  <span className="sds-lnote">
                    Project leader <strong>{p.projectLeader}</strong>
                  </span>
                )}
                {p.sarapisRole && (
                  <span className="sds-lnote">
                    Sarapis role <strong>{p.sarapisRole}</strong>
                  </span>
                )}
              </div>
            )}
            {p.site && (
              <a className="sds-psite" href={/^https?:\/\//.test(p.site) ? p.site : `https://${p.site}`} target="_blank" rel="noopener noreferrer">
                ↗ {p.site.replace(/^https?:\/\//, '')}
              </a>
            )}
            <a className="sds-pfoot" href={projHref(pId(p))}>
              Full profile &amp; activity <span className="sds-arr">→</span>
            </a>
          </div>
          <div className="sds-pcard__side">
            <div className="sds-sidehd">Last activity{last ? ` · ${fmtMonthYear(last)}` : ''}</div>
            {activityFeed(p)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <section id="projects" className="sds-container sds-band">
      <div className="sds-seclead">
        <h2 className="sds-seclead__title">{heading}</h2>
        {metaSlot}
      </div>

      {/* Region tabs */}
      <div className="sds-rtabs">
        {REGIONS.map((r) => (
          <Link key={r.key} className={`sds-rtab${region === r.key ? ' is-on' : ''}`} href={regionHref(r.key)} scroll={false}>
            <div className="sds-rtab__top">
              <span className="sds-rtab__name">{r.name}</span>
              <span className="sds-rtab__tag">{r.tag}</span>
              <span className="sds-rtab__count">{countFor(r.key)} projects</span>
            </div>
            <div className="sds-rtab__text">{r.text}</div>
          </Link>
        ))}
      </div>

      {/* Status filter (All Projects page only) */}
      {showStatusFilter && (
        <div className="sds-toolbar" style={{ marginBottom: 'var(--sds-space-6)' }}>
          <div style={{ display: 'flex', gap: 'var(--sds-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="sds-seclead__meta">Status</span>
            {PROJECT_STATUSES.map((s) => (
              <Link key={s.label} className={`sds-chip${(pstatus || null) === s.value ? ' sds-chip--active' : ''}`} href={chipHref(s.value)} scroll={false}>
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Lineage hierarchy */}
      <div className="sds-pcol">
        {topLevel.length ? (
          topLevel.map((p) => {
            const kids = childrenOf.get(pId(p)) || []
            return (
              <React.Fragment key={p.id}>
                <ProjectCard p={p} />
                {kids.length > 0 && (
                  <>
                    <div className="sds-subhead">Integrated apps ↓</div>
                    {kids.map((c) => {
                      const clast = lastActiveByProject.get(pId(c))
                      return (
                        // A div, not an <a>: the row carries two destinations — the
                        // profile and (when set) the subproject's own site — and an
                        // anchor can't be nested inside an anchor.
                        <div key={c.id} className="sds-childrow">
                          <a className="sds-cm-name" href={projHref(pId(c))} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {c.name}
                          </a>
                          {c.lineage && <span className="sds-lchip">{c.lineage}</span>}
                          <span className="sds-cm-note">↳ in <span className="repo">{p.name}</span></span>
                          {/* Same labels as the card + profile header, for consistency
                              across all three surfaces. Reuses .sds-cm-note (mono 10.5px
                              muted, with .repo in primary) — the exact treatment already
                              used by the "in <parent>" note, so no new CSS.
                              ⚠ These MUST stay ahead of .sds-cm-date, which has
                              margin-left:auto and pins itself + "Open full card" to the
                              right edge; anything after it joins that right-hand group. */}
                          {c.projectLeader && (
                            <span className="sds-cm-note">
                              Project leader <span className="repo">{c.projectLeader}</span>
                            </span>
                          )}
                          {c.sarapisRole && (
                            <span className="sds-cm-note">
                              Sarapis role <span className="repo">{c.sarapisRole}</span>
                            </span>
                          )}
                          {c.site && (
                            <a
                              className="sds-psite"
                              style={{ margin: 0 }}
                              href={/^https?:\/\//.test(c.site) ? c.site : `https://${c.site}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              ↗ {c.site.replace(/^https?:\/\//, '')}
                            </a>
                          )}
                          <span className="sds-cm-date">{clast ? fmtMonthYear(clast) : (c.status || '')}</span>
                          <a className="sds-cm-open" href={projHref(pId(c))} style={{ textDecoration: 'none' }}>
                            Open full card →
                          </a>
                        </div>
                      )
                    })}
                  </>
                )}
              </React.Fragment>
            )
          })
        ) : (
          <div className="sds-empty">No projects in this region{pstatus ? ` with status “${pstatus}”` : ''} yet.</div>
        )}
      </div>
    </section>
  )
}
