import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import '../../../home.css'

export const dynamic = 'force-dynamic'

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
const fmtFull = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

const eventDot: Record<string, string> = { commit: 'code', pr: 'code', release: 'release', repo: 'repo' }
const eventTagLabel: Record<string, string> = { commit: 'Commits', pr: 'PR', release: 'Release', repo: 'Repo' }
const statusBadge: Record<string, string> = { active: 'active', reached: 'reached', declared: 'declared' }
const REGION_NAME: Record<string, string> = { nyc: 'New York City', global: 'Global' }

// Project leader / Sarapis role render as a label+value strip that REUSES
// `.sds-kin` (already a wrapping flex row with a mono uppercase label). The two
// value styles are inline on purpose so this ships without touching
// design-system/src/styles.css and regenerating home.css — same tactic as r39,
// and it keeps the Claude Design sync untouched. `.sds-kin a` only styles
// anchors, so these spans don't pick up the pill treatment.
const factValue: React.CSSProperties = { fontSize: 13.5, color: 'var(--sds-foreground)' }
const factGap: React.CSSProperties = { marginLeft: 14 }

const PIN_PER = 3
const ACT_PER = 6
const KNOW_PER = 6
const REPO_PER = 8

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  try {
    const payload = await getPayload({ config: configPromise })
    const p = await payload.findByID({ collection: 'projects', id, depth: 0 })
    return { title: `${(p as any)?.name || 'Project'} · Sarapis`, description: (p as any)?.summary || undefined }
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

  let project: any
  try {
    project = await payload.findByID({ collection: 'projects', id, depth: 1 })
  } catch {
    notFound()
  }
  if (!project || project.published === false) notFound()
  const pid = project.id
  const region = project.region === 'global' ? 'global' : 'nyc'

  const projWhere: Where = { project: { equals: pid } }
  const [children, pinKnow, pinEvents, pinTasks, actRes, knowRes, repoRes] = await Promise.all([
    payload.find({ collection: 'projects', where: { published: { equals: true }, parent: { equals: pid } }, sort: 'name', limit: 50, depth: 0 }),
    payload.find({ collection: 'knowledge-items', where: { published: { equals: true }, pinned: { equals: true }, ...projWhere }, sort: '-date', limit: 50, depth: 0 }),
    payload.find({ collection: 'activity-events', where: { published: { equals: true }, pinned: { equals: true }, ...projWhere }, sort: '-occurredAt', limit: 50, depth: 0 }),
    payload.find({ collection: 'tasks', where: { publishToActivity: { equals: true }, pinned: { equals: true }, ...projWhere }, sort: '-updatedAt', limit: 50, depth: 0 }),
    payload.find({ collection: 'activity-events', where: { published: { equals: true }, ...projWhere }, sort: '-occurredAt', page: ap, limit: ACT_PER, depth: 0 }),
    payload.find({ collection: 'knowledge-items', where: { published: { equals: true }, ...projWhere }, sort: '-date', page: kp, limit: KNOW_PER, depth: 0 }),
    payload.find({ collection: 'repos', where: { published: { equals: true }, ...projWhere }, sort: '-lastPushedAt', page: rp, limit: REPO_PER, depth: 0 }),
  ])

  // ---- unified pinned deck ----
  type Pin = { key: string; tagCls: string; tag: string; title: string; meta: string; href: string; external?: boolean }
  const pins: Pin[] = []
  for (const k of pinKnow.docs as any[])
    pins.push({ key: `k${k.id}`, tagCls: k.kind === 'link' ? 'html' : k.fileType === 'html' ? 'html' : 'md', tag: k.kind === 'link' ? 'Link' : `.${k.fileType || 'doc'}`, title: k.title, meta: fmtFull(k.date), href: k.kind === 'link' ? k.url || '#' : `/knowledge/${k.id}`, external: k.kind === 'link' })
  for (const e of pinEvents.docs as any[])
    pins.push({ key: `e${e.id}`, tagCls: eventDot[e.kind] || 'code', tag: eventTagLabel[e.kind] || 'Event', title: e.title, meta: [e.repoFullName, fmtFull(e.occurredAt)].filter(Boolean).join(' · '), href: e.url || '#', external: !!e.url })
  for (const t of pinTasks.docs as any[])
    pins.push({ key: `t${t.id}`, tagCls: 'code', tag: 'Task', title: t.title, meta: t.status, href: '#' })
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

  const Pager = ({ label, total, per, cur, param }: { label: string; total: number; per: number; cur: number; param: string }) => {
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

  const parent = project.parent && typeof project.parent === 'object' ? project.parent : null
  const kids = children.docs as any[]

  // secondary links: derive a GitHub org from the first repo (all repos owned in one org)
  const firstRepoOrg = (repos[0]?.fullName || '').split('/')[0] || null

  return (
    <div className="sds-page sds-project">
      {/* Identity */}
      <section className="sds-container sds-projhead">
        <nav className="sds-crumb" aria-label="Breadcrumb">
          <Link href="/#projects">← Projects</Link>
          <span className="sds-crumb__sep">/</span>
          <Link href={`/?region=${region}#projects`}>{REGION_NAME[region]}</Link>
          <span className="sds-crumb__sep">/</span>
          <span className="sds-crumb__here">{project.name}</span>
        </nav>

        <div className="sds-projhead__row">
          <h1 className="sds-projhead__title">{project.name}</h1>
          <span className={`sds-badge sds-badge--${statusBadge[project.status] || 'declared'}`}>
            {project.status === 'active' && <span className="dot" />}
            {project.status}
          </span>
          {project.focusArea && <span className="sds-tag">{project.focusArea.replace(/-/g, ' ')}</span>}
        </div>
        {project.summary && <p className="sds-projhead__sum">{project.summary}</p>}

        {/* Who leads it, and what Sarapis does on it */}
        {(project.projectLeader || project.sarapisRole) && (
          <div className="sds-kin">
            {project.projectLeader && (
              <>
                <span className="sds-kin__label">Project leader</span>
                <span style={factValue}>{project.projectLeader}</span>
              </>
            )}
            {project.sarapisRole && (
              <>
                <span className="sds-kin__label" style={project.projectLeader ? factGap : undefined}>
                  Sarapis role
                </span>
                <span style={factValue}>{project.sarapisRole}</span>
              </>
            )}
          </div>
        )}

        {/* Links */}
        {(project.site || firstRepoOrg) && (
          <div className="sds-links">
            {project.site && (
              <a className="sds-links__main" href={/^https?:\/\//.test(project.site) ? project.site : `https://${project.site}`} target="_blank" rel="noopener noreferrer">
                ↗ {project.site.replace(/^https?:\/\//, '')} <small>Project home</small>
              </a>
            )}
            {firstRepoOrg && (
              <div className="sds-links__more">
                <a href={`https://github.com/${firstRepoOrg}`} target="_blank" rel="noopener noreferrer">↗ GitHub org</a>
              </div>
            )}
          </div>
        )}

        {/* Kin strip */}
        {(parent || kids.length > 0) && (
          <div className="sds-kin">
            {parent && (
              <>
                <span className="sds-kin__label">Part of</span>
                <Link href={`/projects/${parent.id}`}>⌂ {parent.name}</Link>
              </>
            )}
            {kids.length > 0 && (
              <>
                {parent && <span className="sds-kin__gap" />}
                <span className="sds-kin__label">Integrates</span>
                {kids.map((c) => (
                  <Link key={c.id} href={`/projects/${c.id}`}>{c.name}</Link>
                ))}
              </>
            )}
          </div>
        )}
      </section>

      {/* Pinned deck */}
      <section className="sds-container sds-band sds-band--first">
        <div className="sds-pinstrip">
          <div className="sds-pinstrip__hd">
            <span className="sds-panel__t">★ Pinned</span>
          </div>
          {pinTotal ? (
            <>
              <div className="sds-pincards">
                {pinSlice.map((p) => (
                  <a key={p.key} className="sds-pincard" href={p.href} {...(p.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    <span className={`sds-ptag sds-ptag--${p.tagCls}`}>{p.tag}</span>
                    <span className="sds-pincard__title">{p.title}</span>
                    <span className="sds-pincard__meta">{p.meta}</span>
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
            </>
          ) : (
            <div className="sds-empty">Nothing pinned yet — set <em>pinned</em> on an event, knowledge item, or task in the admin.</div>
          )}
        </div>

        {/* Activity */}
        <div className="sds-panel" style={{ marginBottom: 22 }}>
          <div className="sds-panel__hd">
            <span className="sds-panel__t">Activity</span>
          </div>
          {acts.length ? (
            acts.map((e) => (
              <div className="sds-trow" key={e.id}>
                <div className="sds-trow__date">{fmtDate(e.occurredAt)}</div>
                <div className={`sds-tdot sds-tdot--${eventDot[e.kind] || 'code'}`} />
                <div>
                  <a className="sds-tlink" href={e.url || '#'} {...(e.url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    <span className="sds-lrow__title" style={{ fontSize: 13.5 }}>
                      {e.title}{' '}
                      {e.repoFullName && <span className="repo" style={{ fontFamily: 'var(--sds-font-mono)', fontWeight: 700, color: 'var(--sds-primary)' }}>{e.repoFullName}</span>}
                      {e.url && <span className="sds-ext"> ↗</span>}
                    </span>
                  </a>
                  {e.summary && <p className="sds-tnote">{e.summary}</p>}
                  {e.note && <p className="sds-tnote" style={{ opacity: 0.8 }}>{e.note}</p>}
                  {e.actor && (
                    <div className="sds-lrow__meta" style={{ marginTop: 3 }}>
                      <span className="sds-actor">@{e.actor}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="sds-empty" style={{ margin: 14, border: 'none', background: 'transparent' }}>No activity synced for this project yet.</div>
          )}
          <Pager label="events" total={actRes.totalDocs} per={ACT_PER} cur={ap} param="ap" />
        </div>

        {/* Knowledge + Repositories */}
        <div className="sds-timeline-grid">
          <div className="sds-panel">
            <div className="sds-panel__hd"><span className="sds-panel__t">Knowledge</span></div>
            {knows.length ? (
              knows.map((k) => (
                <a key={k.id} className="sds-arow" href={k.kind === 'link' ? k.url || '#' : `/knowledge/${k.id}`} {...(k.kind === 'link' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  {k.fileType ? <span className={`sds-ftype sds-ftype--${k.fileType}`}>.{k.fileType}</span> : <span className="sds-ftype sds-ftype--doc">{k.kind === 'link' ? 'LINK' : 'DOC'}</span>}
                  <span>
                    <span className="sds-arow__title">{k.title}</span>
                    {k.summary && <span className="sds-arow__sum" style={{ display: 'block' }}>{k.summary}</span>}
                  </span>
                  <span className="sds-arow__meta">{fmtFull(k.date)}</span>
                  <span className="sds-ext">↗</span>
                </a>
              ))
            ) : (
              <div className="sds-empty" style={{ margin: 14, border: 'none', background: 'transparent' }}>No knowledge items yet.</div>
            )}
            <Pager label="items" total={knowRes.totalDocs} per={KNOW_PER} cur={kp} param="kp" />
          </div>

          <div className="sds-panel">
            <div className="sds-panel__hd"><span className="sds-panel__t">Repositories</span></div>
            {repos.length ? (
              repos.map((r) => (
                <a key={r.id} className="sds-rrow" href={r.url || `https://github.com/${r.fullName}`} target="_blank" rel="noopener noreferrer">
                  <span className="sds-rrow__name">{r.fullName}</span>
                  <span className="sds-rrow__push">{r.lastPushedAt ? fmtFull(r.lastPushedAt) : ''}</span>
                </a>
              ))
            ) : (
              <div className="sds-empty" style={{ margin: 14, border: 'none', background: 'transparent' }}>No repositories linked yet.</div>
            )}
            <Pager label="repos" total={repoRes.totalDocs} per={REPO_PER} cur={rp} param="rp" />
          </div>
        </div>
      </section>
    </div>
  )
}
