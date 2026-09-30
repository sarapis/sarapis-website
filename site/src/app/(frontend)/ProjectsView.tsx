import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ProjectCard, type ProjectCardData } from './RdCards'
import { cardFor, loadProjectMeta, type ProjectMeta } from './rdData'
import { cachedQuery } from '@/utilities/cachedQuery'

/**
 * Shared Projects section — region chips + a mosaic of glass project cards (pinned
 * projects get a top row of two large cards, the rest sit three across; integrated
 * apps show as monogram tiles on hover). Used by the home page ("Active projects", active-only, links
 * out to /projects) and the /projects page (every status, with the status
 * filter). Self-contained: fetches its own data.
 */

/**
 * Every published project plus its activity meta, cached (see cachedQuery) and shared by
 * the home page and /projects. The cache stores JSON, so the meta Maps travel as entries.
 */
async function loadAllProjects(): Promise<{ allProjects: any[]; meta: ProjectMeta }> {
  const raw = await cachedQuery('projects-all', async () => {
    const payload = await getPayload({ config: configPromise })
    const res = await payload.find({ collection: 'projects', where: { published: { equals: true } }, sort: 'name', limit: 200, depth: 1 })
    const meta = await loadProjectMeta(payload, (res.docs as any[]).map((p) => p.id))
    return { projects: res.docs as any[], latest: [...meta.latest], repos: [...meta.repos], updated: [...meta.updated] }
  })
  return { allProjects: raw.projects, meta: { latest: new Map(raw.latest), repos: new Map(raw.repos), updated: new Map(raw.updated) } }
}

const REGIONS = [
  { key: 'all', name: 'All' },
  { key: 'nyc', name: 'New York City' },
  { key: 'global', name: 'Global' },
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
  heading,
  metaSlot,
}: {
  basePath: string
  anchor?: string
  region: 'all' | 'nyc' | 'global'
  pstatus?: string | null
  restrictActive?: boolean
  showStatusFilter?: boolean
  heading: string
  metaSlot?: React.ReactNode
}) {
  const { allProjects, meta } = await loadAllProjects()

  const pId = (p: any) => p?.id
  const parentId = (p: any) => (p?.parent && typeof p.parent === 'object' ? p.parent.id : p.parent) ?? null
  const regionOf = (p: any) => (p?.region === 'global' ? 'global' : 'nyc')
  // Home restricts to active projects; the All Projects page shows every status.
  const inScope = (p: any) => (restrictActive ? p.status === 'active' : true)

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
  const kidsOf = (p: any) => childrenOf.get(pId(p)) || []

  // Order: most recently updated first (newest commit, PR, release or knowledge
  // item on the project or any of its apps). Pinned projects (the "pinned" checkbox
  // in the admin) override that and take the top row as up to two large cards.
  const byName = (x: any, y: any) => String(x.name).localeCompare(String(y.name))
  const lastAt = (p: any) => [p, ...kidsOf(p)].map((x) => meta.updated.get(x.id) || '').reduce((m, d) => (d > m ? d : m), '')
  const byRecent = (x: any, y: any) => lastAt(y).localeCompare(lastAt(x)) || byName(x, y)
  const pinned = topLevel.filter((p) => p.pinned).sort(byRecent).slice(0, 2)
  const pinnedIds = new Set(pinned.map(pId))
  const rest = topLevel.filter((p) => !pinnedIds.has(pId(p))).sort(byRecent)

  const cards: ProjectCardData[] = [
    ...pinned.map((p) => ({
      ...cardFor(p, kidsOf(p), meta),
      featured: true,
      span: pinned.length === 1 ? 'rd-span-6' : 'rd-span-3',
      ratio: pinned.length === 1 ? '16 / 10' : '4 / 3',
    })),
    ...rest.map((p) => ({ ...cardFor(p, kidsOf(p), meta), span: 'rd-span-2' })),
  ]

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

  return (
    <section id="projects" className="sds-container rd-sec rd-sec--first">
      <div className="rd-head">
        <h2 className="rd-h2">{heading}</h2>
        <div className="rd-carctl">
          {REGIONS.map((r) => (
            <Link key={r.key} className={`sds-chip${region === r.key ? ' sds-chip--active' : ''}`} href={regionHref(r.key)} scroll={false}>
              {r.name}
            </Link>
          ))}
          {metaSlot}
        </div>
      </div>

      {/* Status filter (All Projects page only) */}
      {showStatusFilter && (
        <div className="rd-filterrow">
          <span className="rd-label">Status</span>
          {PROJECT_STATUSES.map((s) => (
            <Link key={s.label} className={`sds-chip${(pstatus || null) === s.value ? ' sds-chip--active' : ''}`} href={chipHref(s.value)} scroll={false}>
              {s.label}
            </Link>
          ))}
        </div>
      )}

      {cards.length ? (
        <div className="rd-pgrid">
          {cards.map((c) => (
            <ProjectCard key={c.id} p={c} />
          ))}
        </div>
      ) : (
        <div className="sds-empty" style={{ marginTop: 28 }}>
          No projects in this region{pstatus ? ` with status “${pstatus}”` : ''} yet.
        </div>
      )}
    </section>
  )
}
