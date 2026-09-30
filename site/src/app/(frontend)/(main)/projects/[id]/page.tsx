import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { Mono, Thumb, ProjectCard } from '../../../RdCards'
import { GitHubIcon } from '../../../RdIcons'
import { CardImg } from '../../../CardImg'
import { cardFor, loadProjectMeta, projectEventsWhere, type ProjectMeta } from '../../../rdData'
import { cachedQuery } from '@/utilities/cachedQuery'
import { EVENT_COLOR, childLabel, ago, fmtDay, fmtFull, monogram, repoOrg, siteHref, siteLabel } from '../../../rd'

export const dynamic = 'force-dynamic'

const eventTagLabel: Record<string, string> = { commit: 'Commits', pr: 'PR', release: 'Release', repo: 'Repo' }
const statusBadge: Record<string, string> = { active: 'active', reached: 'reached', declared: 'declared' }
const REGION_NAME: Record<string, string> = { nyc: 'New York City', global: 'Global' }

const PIN_PER = 3
const ACT_PER = 6
const KNOW_PER = 6
const REPO_PER = 8

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  try {
    const payload = await getPayload({ config: configPromise })
    const p = (await payload.findByID({ collection: 'projects', id, depth: 0 })) as any
    // The Local API bypasses access control: an unpublished project's name and summary
    // must not reach the <title> of its 404.
    if (p?.published !== true) return { title: 'Project · Sarapis' }
    return { title: `${p.name || 'Project'} · Sarapis`, description: p.summary || undefined }
  } catch {
    return { title: 'Project · Sarapis' }
  }
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pin?: string; ap?: string; kp?: string; rp?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const pin = Math.max(1, parseInt(sp.pin || '1', 10) || 1)
  const ap = Math.max(1, parseInt(sp.ap || '1', 10) || 1)
  const kp = Math.max(1, parseInt(sp.kp || '1', 10) || 1)
  const rp = Math.max(1, parseInt(sp.rp || '1', 10) || 1)

  const payload = await getPayload({ config: configPromise })

  // Cached per project and page numbers (see cachedQuery). notFound() throws, so it stays
  // outside the cached loader, which returns null for a missing or unpublished project.
  const data = await cachedQuery(`project:${id}:${ap}:${kp}:${rp}`, async () => {
    let project: any
    try {
      project = await payload.findByID({ collection: 'projects', id, depth: 1 })
    } catch {
      return null
    }
    // Only `published: true` is public, as in the access model: null/unset is not published.
    if (!project || project.published !== true) return null
    const pid = project.id
    const projWhere: Where = { project: { equals: pid } }
    // Events count for this project if assigned to it or, unassigned, from one of its repos.
    const ownRepos = await payload.find({ collection: 'repos', where: { published: { equals: true }, ...projWhere }, limit: 1000, depth: 0, pagination: false })
    const eventsWhere = projectEventsWhere(pid, (ownRepos.docs as any[]).map((r) => r.fullName))
    const [children, pinKnow, pinEvents, pinTasks, actRes, knowRes, repoRes] = await Promise.all([
      payload.find({ collection: 'projects', where: { published: { equals: true }, parent: { equals: pid } }, sort: 'name', limit: 50, depth: 0 }),
      payload.find({ collection: 'knowledge-items', where: { published: { equals: true }, pinned: { equals: true }, ...projWhere }, sort: '-date', limit: 50, depth: 0 }),
      payload.find({ collection: 'activity-events', where: { and: [eventsWhere, { pinned: { equals: true } }] }, sort: '-occurredAt', limit: 50, depth: 0 }),
      payload.find({ collection: 'tasks', where: { publishToActivity: { equals: true }, pinned: { equals: true }, ...projWhere }, sort: '-updatedAt', limit: 50, depth: 0 }),
      payload.find({ collection: 'activity-events', where: eventsWhere, sort: '-occurredAt', page: ap, limit: ACT_PER, depth: 0 }),
      payload.find({ collection: 'knowledge-items', where: { published: { equals: true }, ...projWhere }, sort: '-date', page: kp, limit: KNOW_PER, depth: 0 }),
      payload.find({ collection: 'repos', where: { published: { equals: true }, ...projWhere }, sort: '-lastPushedAt', page: rp, limit: REPO_PER, depth: 0 }),
    ])
    const m = await loadProjectMeta(payload, [pid, ...(children.docs as any[]).map((k) => k.id)])
    const meta = { latest: [...m.latest], repos: [...m.repos], updated: [...m.updated] }
    return { project, children, pinKnow, pinEvents, pinTasks, actRes, knowRes, repoRes, meta }
  })
  if (!data) notFound()
  const { project, children, pinKnow, pinEvents, pinTasks, actRes, knowRes, repoRes } = data
  const pid = project.id
  const region = project.region === 'global' ? 'global' : 'nyc'
  const kids = children.docs as any[]
  const meta: ProjectMeta = { latest: new Map(data.meta.latest), repos: new Map(data.meta.repos), updated: new Map(data.meta.updated) }

  // ---- unified pinned deck ----
  type Pin = { key: string; tag: string; title: string; meta: string; href: string; external?: boolean }
  const pins: Pin[] = []
  for (const k of pinKnow.docs as any[])
    pins.push({ key: `k${k.id}`, tag: k.kind === 'link' ? 'Link' : `.${k.fileType || 'doc'}`, title: k.title, meta: fmtFull(k.date), href: k.kind === 'link' ? k.url || '#' : `/knowledge/${k.id}`, external: k.kind === 'link' })
  for (const e of pinEvents.docs as any[])
    pins.push({ key: `e${e.id}`, tag: eventTagLabel[e.kind] || 'Event', title: e.title, meta: [e.repoFullName, fmtFull(e.occurredAt)].filter(Boolean).join(' · '), href: e.url || '#', external: !!e.url })
  for (const t of pinTasks.docs as any[])
    pins.push({ key: `t${t.id}`, tag: 'Task', title: t.title, meta: t.status, href: '#' })
  const pinTotal = pins.length
  const pinPages = Math.max(1, Math.ceil(pinTotal / PIN_PER))
  const pinCur = Math.min(pin, pinPages)
  const pinSlice = pins.slice((pinCur - 1) * PIN_PER, pinCur * PIN_PER)

  const acts = actRes.docs as any[]
  const knows = knowRes.docs as any[]
  const repos = repoRes.docs as any[]

  const hrefWith = (changes: Record<string, number | null>) => {
    const u = new URLSearchParams()
    const base: Record<string, any> = { pin: pinCur, ap, kp, rp, ...changes }
    for (const [k, v] of Object.entries(base)) if (v != null && Number(v) > 1) u.set(k, String(v))
    const s = u.toString()
    return `/projects/${pid}${s ? `?${s}` : ''}`
  }

  // A plain function, not a component: a component defined inside render is a new type every render.
  const pager = ({ label, total, per, cur, param }: { label: string; total: number; per: number; cur: number; param: string }) => {
    if (total <= per) return null
    const pages = Math.max(1, Math.ceil(total / per))
    const c = Math.min(cur, pages)
    const start = (c - 1) * per + 1
    const end = Math.min(c * per, total)
    return (
      <div className="sds-pager">
        <span className="sds-pager__info">Showing {start}–{end} of {total} {label}</span>
        <div className="sds-pager__btns">
          <Link className="sds-pager__b" aria-disabled={c <= 1 || undefined} href={hrefWith({ [param]: c - 1 } as any)} scroll={false}>Prev</Link>
          <span className="sds-pager__page">{c} / {pages}</span>
          <Link className="sds-pager__b" aria-disabled={c >= pages || undefined} href={hrefWith({ [param]: c + 1 } as any)} scroll={false}>Next</Link>
        </div>
      </div>
    )
  }

  const self = cardFor(project, kids, meta)
  // An unpublished parent is not shown: its name would leak, and its link would 404.
  const parent = project.parent && typeof project.parent === 'object' && project.parent.published === true ? project.parent : null
  const lastEvent = meta.latest.get(pid) || [...kids.map((k) => meta.latest.get(k.id))].filter(Boolean).sort((a: any, b: any) => String(b.occurredAt).localeCompare(String(a.occurredAt)))[0]
  const org = repoOrg([...(meta.repos.get(pid) || []), ...kids.flatMap((k) => meta.repos.get(k.id) || [])][0]?.fullName)
  const shot = self.img
  const focus = project.focusArea ? String(project.focusArea).replace(/-/g, ' ') : null
  const mono = monogram(project.name)

  return (
    <div className="sds-page sds-project">
      {/* Identity */}
      <section className="sds-container rd-phead">
        <nav className="rd-crumb" aria-label="Breadcrumb">
          <Link href="/#projects">← Projects</Link>
          <span className="rd-crumb__sep">/</span>
          <Link href={`/?region=${region}#projects`}>{REGION_NAME[region]}</Link>
          {parent && (
            <>
              <span className="rd-crumb__sep">/</span>
              <Link href={`/projects/${parent.id}`}>{parent.name}</Link>
            </>
          )}
          <span className="rd-crumb__sep">/</span>
          <span className="rd-crumb__here">{project.name}</span>
        </nav>

        <div className="rd-phead__grid">
          <div className="rd-phead__left">
            <div className="rd-phead__ident">
              <Mono text={mono} size={56} site={project.site} />
              <span className={`sds-badge sds-badge--${statusBadge[project.status] || 'declared'}`}>
                {project.status === 'active' && <span className="dot" />}
                {project.status}
              </span>
              {focus && <span className="sds-tag">{focus}</span>}
            </div>
            <h1 className="rd-phead__title">{project.name}</h1>
            {project.summary && <p className="rd-phead__sum">{project.summary}</p>}

            {(project.projectLeader || project.sarapisRole || parent) && (
              <div className="rd-facts-row">
                {project.projectLeader && (
                  <div>
                    <div className="rd-label">Project leader</div>
                    <div className="rd-facts-row__v">{project.projectLeader}</div>
                  </div>
                )}
                {project.sarapisRole && (
                  <div>
                    <div className="rd-label">Sarapis role</div>
                    <div className="rd-facts-row__v">{project.sarapisRole}</div>
                  </div>
                )}
                {parent && (
                  <div>
                    <div className="rd-label">Part of</div>
                    <div className="rd-facts-row__v">
                      <Link href={`/projects/${parent.id}`} className="rd-plainlink">{parent.name}</Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rd-actions">
              {project.site && (
                <a className="sds-button sds-button--primary sds-button--md" href={siteHref(project.site)} target="_blank" rel="noopener noreferrer">
                  {siteLabel(project.site)} ↗
                </a>
              )}
              {org && (
                <a className="rd-ib rd-ib--lg" href={`https://github.com/${org}`} target="_blank" rel="noopener noreferrer" title="GitHub organisation" aria-label="GitHub organisation">
                  <GitHubIcon size={18} />
                </a>
              )}
              {knowRes.totalDocs > 0 && (
                <a className="rd-ib rd-ib--lg rd-ib--q" href="#knowledge" title="Documentation" aria-label="Documentation">
                  ?
                </a>
              )}
              {lastEvent && (
                <span className="rd-meta rd-meta--sync rd-actions__last">
                  <span className="rd-syncdot" />
                  Last activity {ago(lastEvent.occurredAt)}
                </span>
              )}
            </div>
          </div>

          <div className="rd-glass rd-rise rd-phead__frame">
            <div className="rd-phead__shot">
              <Thumb name={project.name} label={mono} site={project.site} />
              {shot && <CardImg src={shot} />}
            </div>
          </div>
        </div>
      </section>

      {/* Children: subprojects / features / integrations, per the parent's setting */}
      {kids.length > 0 && (
        <section id="inside" className="sds-container rd-sec">
          <div className="rd-head">
            <h2 className="rd-h2">{childLabel(project).title}</h2>
            <span className="rd-meta">
              {kids.length} {kids.length === 1 ? childLabel(project).one : childLabel(project).many}
            </span>
          </div>
          <div className="rd-appgrid">
            {kids.map((c) => (
              <ProjectCard key={c.id} p={cardFor(c, [], meta, { variant: 'app' })} />
            ))}
          </div>
        </section>
      )}

      {/* Pinned */}
      {pinTotal > 0 && (
        <section id="pinned" className="sds-container rd-sec">
          <div className="rd-head">
            <h2 className="rd-h2">Pinned</h2>
            <span className="rd-meta">Start here</span>
          </div>
          <div className="rd-pins">
            {pinSlice.map((p) => (
              <a key={p.key} className="rd-glass rd-lift rd-rise rd-pin" href={p.href} {...(p.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <span className="sds-tag">{p.tag}</span>
                <span className="rd-pin__title">{p.title}</span>
                <span className="rd-pin__meta">{p.meta}</span>
              </a>
            ))}
          </div>
          {pinTotal > PIN_PER && (
            <div className="sds-pager sds-pager--float">
              <span className="sds-pager__info">Showing {(pinCur - 1) * PIN_PER + 1}–{Math.min(pinCur * PIN_PER, pinTotal)} of {pinTotal}</span>
              <div className="sds-pager__btns">
                <Link className="sds-pager__b" aria-disabled={pinCur <= 1 || undefined} href={hrefWith({ pin: pinCur - 1 })} scroll={false}>Prev</Link>
                <span className="sds-pager__page">{pinCur} / {pinPages}</span>
                <Link className="sds-pager__b" aria-disabled={pinCur >= pinPages || undefined} href={hrefWith({ pin: pinCur + 1 })} scroll={false}>Next</Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* In the open: activity, knowledge, repositories */}
      <section id="knowledge" className="sds-container rd-sec">
        <div className="rd-head">
          <h2 className="rd-h2">In the open</h2>
          {lastEvent && (
            <span className="rd-meta rd-meta--sync">
              <span className="rd-syncdot" />
              Synced from GitHub
            </span>
          )}
        </div>
        <div className="rd-stackcol">
          <div className="rd-glass rd-rise rd-act">
            <div className="rd-act__hd">Activity</div>
            {acts.length ? (
              acts.map((e) => (
                <a
                  key={e.id}
                  className="rd-act__row"
                  href={e.url || '#'}
                  {...(e.url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <span className="rd-act__date">{fmtDay(e.occurredAt)}</span>
                  <span className="rd-act__dot" style={{ background: EVENT_COLOR[e.kind] || EVENT_COLOR.commit }} />
                  <span className="rd-act__txt">
                    {e.summary || e.title}
                    {e.note && <span className="rd-act__note">{e.note}</span>}
                  </span>
                  {e.repoFullName && <span className="rd-act__repo">{e.repoFullName} ↗</span>}
                </a>
              ))
            ) : (
              <div className="rd-act__empty">No activity synced for this project yet.</div>
            )}
            {pager({ label: 'events', total: actRes.totalDocs, per: ACT_PER, cur: ap, param: 'ap' })}
          </div>

          <div className="rd-twocol">
            <div className="rd-glass rd-rise rd-act">
              <div className="rd-act__hd">Knowledge</div>
              {knows.length ? (
                knows.map((k) => (
                  <a
                    key={k.id}
                    className="rd-know"
                    href={k.kind === 'link' ? k.url || '#' : `/knowledge/${k.id}`}
                    {...(k.kind === 'link' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    <span className="rd-know__type">{k.kind === 'link' ? 'LINK' : k.fileType ? String(k.fileType).toUpperCase() : 'DOC'}</span>
                    <span className="rd-know__title">{k.title}</span>
                    <span className="rd-know__date">{fmtFull(k.date)}</span>
                  </a>
                ))
              ) : (
                <div className="rd-act__empty">No knowledge items yet.</div>
              )}
              {pager({ label: 'items', total: knowRes.totalDocs, per: KNOW_PER, cur: kp, param: 'kp' })}
            </div>

            <div className="rd-glass rd-rise rd-act">
              <div className="rd-act__hd">Repositories</div>
              {repos.length ? (
                repos.map((r) => (
                  <a key={r.id} className="rd-repo" href={r.url || `https://github.com/${r.fullName}`} target="_blank" rel="noopener noreferrer">
                    <span className="rd-repo__name">
                      <GitHubIcon size={14} />
                      <span>{r.fullName}</span>
                    </span>
                    <span className="rd-repo__push">{r.lastPushedAt ? fmtFull(r.lastPushedAt) : ''}</span>
                  </a>
                ))
              ) : (
                <div className="rd-act__empty">No repositories linked yet.</div>
              )}
              {pager({ label: 'repos', total: repoRes.totalDocs, per: REPO_PER, cur: rp, param: 'rp' })}
            </div>
          </div>
        </div>
      </section>

      <div style={{ height: 72 }} />
    </div>
  )
}
