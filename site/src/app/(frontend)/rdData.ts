import type { Payload, Where } from 'payload'
import { repoOrg, repoShort, mediaUrl, ago, childLabel } from './rd'
import type { ProjectCardData } from './RdCards'

const idOf = (r: any) => (r && typeof r === 'object' ? r.id : r)

const REGION_LABEL: Record<string, string> = { nyc: 'New York City', global: 'Global movement' }

export type ProjectMeta = {
  latest: Map<number, any>
  repos: Map<number, any[]>
  /** Most recent activity per project: newest activity event or knowledge item, ISO string. */
  updated: Map<number, string>
}

/**
 * Where-clause for a project's activity events: those assigned to it directly, plus
 * any whose repo belongs to the project (synced events often arrive with no project set).
 */
export function projectEventsWhere(pid: number, repoNames: string[]): Where {
  return {
    published: { equals: true },
    or: [{ project: { equals: pid } }, ...(repoNames.length ? [{ repoFullName: { in: repoNames } }] : [])],
  }
}

/** Latest published activity event and repos per project, for the given project ids. */
export async function loadProjectMeta(payload: Payload, ids: number[]): Promise<ProjectMeta> {
  const latest = new Map<number, any>()
  const repos = new Map<number, any[]>()
  const updated = new Map<number, string>()
  if (!ids.length) return { latest, repos, updated }

  const rp = await payload.find({
    collection: 'repos',
    where: { published: { equals: true }, project: { in: ids } },
    sort: '-lastPushedAt',
    limit: 1000,
    depth: 0,
  })
  const projectOfRepo = new Map<string, number>()
  for (const r of rp.docs as any[]) {
    const pid = idOf(r.project)
    if (pid == null) continue
    if (!repos.has(pid)) repos.set(pid, [])
    repos.get(pid)!.push(r)
    projectOfRepo.set(r.fullName, pid)
  }

  const [ev, kn] = await Promise.all([
    payload.find({
      collection: 'activity-events',
      where: {
        published: { equals: true },
        or: [{ project: { in: ids } }, ...(projectOfRepo.size ? [{ repoFullName: { in: [...projectOfRepo.keys()] } }] : [])],
      },
      sort: '-occurredAt',
      limit: 1000,
      depth: 0,
    }),
    payload.find({
      collection: 'knowledge-items',
      where: { published: { equals: true }, project: { in: ids } },
      sort: '-date',
      limit: 1000,
      depth: 0,
    }),
  ])
  const bump = (pid: any, d?: string | null) => {
    if (pid == null || !d) return
    const cur = updated.get(pid)
    if (!cur || d > cur) updated.set(pid, d)
  }
  for (const k of kn.docs as any[]) bump(idOf(k.project), k.date)
  for (const e of ev.docs as any[]) {
    // an event assigned to a project wins; otherwise it belongs to whichever project owns its repo
    const pid = idOf(e.project) ?? projectOfRepo.get(e.repoFullName)
    if (pid == null) continue
    if (!latest.has(pid)) latest.set(pid, e)
    bump(pid, e.occurredAt)
  }
  return { latest, repos, updated }
}

/** Card view-model for a project (or app) and its integrated children. */
export function cardFor(p: any, kids: any[], meta: ProjectMeta, opts: { variant?: 'project' | 'app' } = {}): ProjectCardData {
  const own = meta.repos.get(p.id) || []
  const kidRepos = kids.flatMap((k) => meta.repos.get(k.id) || [])
  const allRepos = [...own, ...kidRepos]
  const events = [meta.latest.get(p.id), ...kids.map((k) => meta.latest.get(k.id))].filter(Boolean) as any[]
  events.sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
  const ev = events[0]
  const stats: ProjectCardData['stats'] = []
  if (kids.length) stats.push({ n: kids.length, l: kids.length === 1 ? childLabel(p).one : childLabel(p).many })
  if (allRepos.length) stats.push({ n: allRepos.length, l: allRepos.length === 1 ? 'repo' : 'repos' })
  const org = repoOrg(allRepos[0]?.fullName)
  const shot = mediaUrl(p.screenshot) || mediaUrl(p.heroImage)
  return {
    id: p.id,
    name: p.name,
    region: REGION_LABEL[p.region] || REGION_LABEL.nyc,
    status: p.status,
    summary: p.summary,
    site: p.site,
    // an uploaded screenshot wins; otherwise the card shows the site's logo (see Thumb)
    img: shot,
    stats,
    apps: kids.map((k) => ({ id: k.id, name: k.name, site: k.site })),
    activity: ev ? [repoShort(ev.repoFullName), ev.title, ago(ev.occurredAt)].filter(Boolean).join(' · ') : null,
    gh: org ? `https://github.com/${org}` : null,
    variant: opts.variant,
  }
}
