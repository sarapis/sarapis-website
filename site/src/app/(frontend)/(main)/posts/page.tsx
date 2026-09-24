import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import '../../home.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Posts · Sarapis',
  description:
    'Everything we publish, in one place — perspectives, project news, knowledge items, and a live feed of our open-source work.',
}

const PER = 20

// Display order + labels for the type filter. Only types with content show a chip.
const TYPES: { key: string; label: string }[] = [
  { key: 'perspective', label: 'Perspective' },
  { key: 'news', label: 'News & Updates' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'commit', label: 'Commit Summary' },
  { key: 'pr', label: 'Pull Request' },
  { key: 'release', label: 'Release' },
  { key: 'repo', label: 'New Repository' },
]
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.key, t.label]))
const dotClass: Record<string, string> = {
  perspective: 'release', news: 'release', knowledge: 'repo', commit: 'code', pr: 'code', release: 'release', repo: 'repo',
}

const fmtFull = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''

type Item = {
  key: string
  type: string
  title: string
  date: string | null
  href: string | null
  external: boolean
  meta: string
  tags?: string[]
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string; tag?: string }>
}) {
  const sp = await searchParams
  const activeType = sp.type && TYPE_LABEL[sp.type] ? sp.type : null
  const activeTag = sp.tag ? String(sp.tag).toLowerCase() : null
  const page = Math.max(1, Number(sp.page) || 1)
  let activeTagLabel = activeTag

  const payload = await getPayload({ config: configPromise })

  const [postsRes, knowledgeRes, eventsRes] = await Promise.all([
    payload.find({ collection: 'posts', where: { _status: { equals: 'published' } }, sort: '-publishedAt', limit: 300, depth: 1 }),
    payload.find({ collection: 'knowledge-items', where: { published: { equals: true } }, sort: '-date', limit: 300, depth: 1 }),
    payload.find({ collection: 'activity-events', where: { published: { equals: true } } as Where, sort: '-occurredAt', limit: 500, depth: 1 }),
  ])

  const items: Item[] = []

  for (const p of postsRes.docs as any[]) {
    const cats = Array.isArray(p.categories) ? p.categories.filter((c: any) => c && typeof c === 'object') : []
    const isPerspective = cats.some((c: any) => String(c.title).toLowerCase() === 'perspective')
    const catLabel = cats[0]?.title || 'Sarapis'
    const tags = Array.isArray(p.tags) ? p.tags.filter((t: any) => t && typeof t === 'object') : []
    if (activeTag) {
      const hit = tags.find((t: any) => String(t.slug).toLowerCase() === activeTag)
      if (hit?.title) activeTagLabel = hit.title
    }
    items.push({
      key: `post-${p.id}`,
      type: isPerspective ? 'perspective' : 'news',
      title: p.title,
      date: p.publishedAt || p.createdAt || null,
      href: `/posts/${p.slug}`,
      external: false,
      meta: catLabel,
      tags: tags.map((t: any) => String(t.slug).toLowerCase()),
    })
  }

  for (const k of knowledgeRes.docs as any[]) {
    const isLink = k.kind === 'link'
    const artifactUrl = k.artifact && typeof k.artifact === 'object' ? k.artifact.url : null
    items.push({
      key: `kb-${k.id}`,
      type: 'knowledge',
      title: k.title,
      date: k.date || k.createdAt || null,
      href: isLink ? k.url || null : `/knowledge/${k.id}`,
      external: isLink,
      meta: isLink ? 'Link' : `.${k.fileType || 'doc'}`,
    })
  }

  for (const e of eventsRes.docs as any[]) {
    if (!TYPE_LABEL[e.kind]) continue
    const url = typeof e.url === 'string' && /^https?:\/\//.test(e.url)
      ? e.url
      : e.repoFullName
        ? `https://github.com/${e.repoFullName}`
        : null
    items.push({
      key: `ev-${e.id}`,
      type: e.kind,
      title: e.title,
      date: e.occurredAt || null,
      href: url,
      external: true,
      meta: e.repoFullName || '',
    })
  }

  // Which type chips to show — only those with at least one item.
  const present = new Set(items.map((i) => i.type))
  const availableTypes = TYPES.filter((t) => present.has(t.key))

  const filtered = items
    .filter((i) => (activeType ? i.type === activeType : true))
    .filter((i) => (activeTag ? i.tags?.includes(activeTag) : true))
    .sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0))

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PER))
  const cur = Math.min(page, totalPages)
  const pageItems = filtered.slice((cur - 1) * PER, cur * PER)

  const chipHref = (t: string | null) => {
    const u = new URLSearchParams()
    if (t) u.set('type', t)
    if (activeTag) u.set('tag', activeTag)
    const s = u.toString()
    return s ? `/posts?${s}` : '/posts'
  }
  const pageHref = (n: number) => {
    const u = new URLSearchParams()
    if (activeType) u.set('type', activeType)
    if (activeTag) u.set('tag', activeTag)
    if (n > 1) u.set('page', String(n))
    const s = u.toString()
    return s ? `/posts?${s}` : '/posts'
  }

  return (
    <div className="sds-page sds-project">
      {/* Header */}
      <section className="sds-container sds-projhead">
        <nav className="sds-crumb" aria-label="Breadcrumb">
          <Link href="/">← Home</Link>
          <span className="sds-crumb__sep">/</span>
          <span className="sds-crumb__here">Posts</span>
        </nav>
        <div className="sds-projhead__row">
          <h1 className="sds-projhead__title">Posts</h1>
        </div>
        <p className="sds-projhead__sum" style={{ maxWidth: '52rem' }}>
          Everything we publish, in one place — perspectives and project news, knowledge items, and a
          live feed of our open-source work.
        </p>
      </section>

      <section className="sds-container sds-band sds-band--first">
        {/* Type filter */}
        <div className="sds-toolbar" style={{ marginBottom: 'var(--sds-space-6)' }}>
          <div style={{ display: 'flex', gap: 'var(--sds-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="sds-seclead__meta">Type</span>
            <Link className={`sds-chip${!activeType ? ' sds-chip--active' : ''}`} href={chipHref(null)} scroll={false}>
              All
            </Link>
            {availableTypes.map((t) => (
              <Link key={t.key} className={`sds-chip${activeType === t.key ? ' sds-chip--active' : ''}`} href={chipHref(t.key)} scroll={false}>
                {t.label}
              </Link>
            ))}
            {activeTag && (
              <Link className="sds-chip sds-chip--active" href={activeType ? `/posts?type=${activeType}` : '/posts'} scroll={false} title="Clear tag">
                #{activeTagLabel} ✕
              </Link>
            )}
          </div>
        </div>

        {/* List */}
        <div className="sds-postlist">
          {pageItems.length ? (
            pageItems.map((it) => {
              const inner = (
                <>
                  <span className="sds-postrow__date">{fmtFull(it.date)}</span>
                  <span className={`sds-tdot sds-tdot--${dotClass[it.type] || 'code'}`} />
                  <span className="sds-postrow__tag">{TYPE_LABEL[it.type]}</span>
                  <span className="sds-postrow__title">{it.title}</span>
                  {it.meta && <span className="sds-postrow__meta">{it.meta}</span>}
                  {it.href && <span className="sds-postrow__arr">{it.external ? '↗' : '→'}</span>}
                </>
              )
              return it.href ? (
                <a
                  key={it.key}
                  className="sds-postrow"
                  href={it.href}
                  {...(it.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {inner}
                </a>
              ) : (
                <div key={it.key} className="sds-postrow sds-postrow--static">{inner}</div>
              )
            })
          ) : (
            <div className="sds-empty">Nothing here yet{activeType ? ` under “${TYPE_LABEL[activeType]}”` : ''}.</div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="sds-pager sds-pager--float" style={{ marginTop: 'var(--sds-space-6)' }}>
            {cur > 1 ? (
              <Link className="sds-pager__b" href={pageHref(cur - 1)} scroll={false}>← Prev</Link>
            ) : (
              <span className="sds-pager__b" aria-disabled="true">← Prev</span>
            )}
            <span className="sds-pager__info">
              {(cur - 1) * PER + 1}–{Math.min(cur * PER, total)} of {total}
            </span>
            {cur < totalPages ? (
              <Link className="sds-pager__b" href={pageHref(cur + 1)} scroll={false}>Next →</Link>
            ) : (
              <span className="sds-pager__b" aria-disabled="true">Next →</span>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
