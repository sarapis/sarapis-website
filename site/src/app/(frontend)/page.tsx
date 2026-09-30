import React from 'react'
import { getPayload } from 'payload'
import { cachedQuery } from '@/utilities/cachedQuery'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { RdShell } from './RdShell'
import { ProjectsView } from './ProjectsView'
import { PostsSection, type PostCard } from './PostsSection'
import { Carousel } from './Carousel'
import { CountUp } from './CountUp'
import { HoverCard, IconLink, Thumb } from './RdCards'
import { EVENT_COLOR, ago, daysAgoISO, fmtDay, fmtMonthYear, mediaUrl, monogram, repoShort } from './rd'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sarapis — free, libre & open source for the public sector',
  description:
    'Sarapis builds open solutions with — not for — nonprofits and the public sector. A live view of our projects, in the open.',
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>
}) {
  const sp = await searchParams
  const region = sp.region === 'global' ? 'global' : sp.region === 'nyc' ? 'nyc' : 'all'

  const payload = await getPayload({ config: configPromise })
  const since = daysAgoISO
  const published = { published: { equals: true } }

  // Cached (see cachedQuery): every anonymous request used to re-run all of these.
  const { homepage, postsRes, casePosts, events, eventTotal, lastSynced, events30, reposActive, releases, postTotal } = await cachedQuery('home', async () => {
    const homepage = (await payload.findGlobal({ slug: 'homepage' })) as any
    const caseStudies: any[] = Array.isArray(homepage?.caseStudies) ? homepage.caseStudies : []
    const caseSlugs = caseStudies.map((c) => String(c.href || '').match(/^\/posts\/([^/?#]+)/)?.[1]).filter(Boolean) as string[]

    const [postsRes, casePosts, events, eventTotal, lastSynced, events30, reposActive, releases, postTotal] = await Promise.all([
      payload.find({ collection: 'posts', where: { _status: { equals: 'published' } }, sort: '-publishedAt', limit: 12, depth: 1 }),
      caseSlugs.length
        ? payload.find({ collection: 'posts', where: { slug: { in: caseSlugs }, _status: { equals: 'published' } }, limit: 12, depth: 1 })
        : Promise.resolve({ docs: [] as any[] }),
      payload.find({ collection: 'activity-events', where: published, sort: '-occurredAt', limit: 5, depth: 0 }),
      payload.count({ collection: 'activity-events', where: published }),
      payload.find({ collection: 'activity-events', where: published, sort: '-updatedAt', limit: 1, depth: 0 }),
      payload.count({ collection: 'activity-events', where: { ...published, occurredAt: { greater_than: since(30) } } }),
      payload.count({ collection: 'repos', where: { ...published, lastPushedAt: { greater_than: since(30) } } }),
      payload.count({ collection: 'activity-events', where: { ...published, kind: { equals: 'release' }, occurredAt: { greater_than: since(365) } } }),
      payload.count({ collection: 'posts', where: { _status: { equals: 'published' } } }),
    ])
    return { homepage, postsRes, casePosts, events, eventTotal, lastSynced, events30, reposActive, releases, postTotal }
  })
  const caseStudies: any[] = Array.isArray(homepage?.caseStudies) ? homepage.caseStudies : []

  const hero = homepage?.hero || {}
  const services: any[] = Array.isArray(homepage?.services) ? homepage.services : []
  const facts: any[] = Array.isArray(homepage?.about?.facts) ? homepage.about.facts : []
  const aboutParas: any[] = Array.isArray(homepage?.about?.paragraphs) ? homepage.about.paragraphs : []
  const board: any[] = Array.isArray(homepage?.board) ? homepage.board : []

  // ---- Recent posts (carousel + topic filter) ----
  const catOf = (p: any) =>
    Array.isArray(p.categories) && p.categories[0] && typeof p.categories[0] === 'object' ? p.categories[0].title : 'Sarapis'
  const postCards: PostCard[] = (postsRes.docs as any[]).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    cat: catOf(p),
    date: fmtMonthYear(p.publishedAt),
    img: mediaUrl(p.heroImage) || mediaUrl(p.meta?.image),
  }))
  const cats = [...new Set(postCards.map((p) => p.cat))].slice(0, 6)

  // ---- In the open ----
  const stats = [
    { n: events30.totalDocs, l: 'updates · 30 days' },
    { n: reposActive.totalDocs, l: 'repos pushed · 30 days' },
    { n: releases.totalDocs, l: 'releases · 12 months' },
    { n: postTotal.totalDocs, l: 'posts' },
  ]
  const syncedAt = (lastSynced.docs[0] as any)?.updatedAt as string | undefined
  const eventUrl = (e: any) => e.url || (e.repoFullName ? `https://github.com/${e.repoFullName}` : '#')

  // ---- Case studies: link, image (from the post they point to) and service ----
  const postBySlug = new Map((casePosts.docs as any[]).map((p) => [p.slug, p]))
  const serviceTitle = new Map(services.map((s) => [s.slug, s.title]))
  const partners = [...new Set(caseStudies.map((c) => c.source).filter(Boolean))] as string[]

  const initials = (name: string) => {
    const w = name.split(/\s+/).filter(Boolean)
    return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase()
  }

  return (
    <RdShell home>
      {/* Hero: a sticky statement that shrinks away as the project mosaic slides over it */}
      <div className="rd-herowrap">
        <section className="rd-hero" aria-labelledby="rd-hero-title">
          <div className="rd-hero__inner">
            {hero.eyebrow && <p className="sds-eyebrow">{hero.eyebrow}</p>}
            <h1 id="rd-hero-title" className="rd-hero__title">
              {hero.title || 'Open Source Good'}
            </h1>
            <div className="rd-hero__body">
              {hero.lead && <p className="rd-hero__lead">{hero.lead}</p>}
              <div className="rd-hero__actions">
                <a className="sds-button sds-button--primary sds-button--md" href={hero.primaryCtaHref || '#contact'}>
                  {hero.primaryCtaLabel || 'Let’s talk'}
                </a>
                <a className="sds-button sds-button--outline sds-button--md" href={hero.secondaryCtaHref || '/about'}>
                  {hero.secondaryCtaLabel || 'About Us'}
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="rd-lift-wrap">
        {/* Projects mosaic */}
        <ProjectsView
          basePath="/"
          anchor="#projects"
          region={region}
          restrictActive
          heading="Active projects"
          metaSlot={
            <Link className="rd-meta rd-meta--link rd-chipmeta" href="/projects">
              All projects →
            </Link>
          }
        />

        {/* In the open */}
        <section id="open" className="sds-container rd-sec">
          <div className="rd-head">
            <h2 className="rd-h2">In the open</h2>
            {syncedAt && (
              <span className="rd-meta rd-meta--sync">
                <span className="rd-syncdot" />
                Synced from GitHub {ago(syncedAt)}
              </span>
            )}
          </div>
          <div className="rd-glass rd-rise rd-statbar">
            {stats.map((s) => (
              <div key={s.l} className="rd-statbar__cell">
                <div className="rd-statbar__n">
                  <CountUp value={s.n} />
                </div>
                <div className="rd-statbar__l">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="rd-glass rd-rise rd-act">
            <div className="rd-act__hd">Activity</div>
            {events.docs.length === 0 && <div className="rd-act__empty">No activity synced yet.</div>}
            {(events.docs as any[]).map((e) => (
              <a key={e.id} className="rd-act__row" href={eventUrl(e)} target="_blank" rel="noopener noreferrer">
                <span className="rd-act__date">{fmtDay(e.occurredAt)}</span>
                <span className="rd-act__dot" style={{ background: EVENT_COLOR[e.kind] || EVENT_COLOR.commit }} />
                <span className="rd-act__txt">{e.summary || e.title}</span>
                {e.repoFullName && <span className="rd-act__repo">{repoShort(e.repoFullName)} ↗</span>}
              </a>
            ))}
            {/* /posts is the unified feed and includes activity events; /activity only redirects home */}
            <Link className="rd-act__more" href="/posts">
              All {eventTotal.totalDocs} events →
            </Link>
          </div>
        </section>

        {/* Recent posts */}
        {postCards.length > 0 && <PostsSection posts={postCards} cats={cats} />}

        {/* Services + case studies */}
        {services.length > 0 && (
          <section id="services" className="sds-container rd-sec">
            <div className="rd-head">
              <h2 className="rd-h2">Services</h2>
              <Link className="rd-meta rd-meta--link" href="/services">
                All services →
              </Link>
            </div>
            <div className="rd-services">
              {services.map((s, i) => (
                <div key={s.id || i} className="rd-services__row">
                  <span className="rd-services__num">{s.number || String(i + 1).padStart(2, '0')}</span>
                  <span className="rd-services__title">{s.title}</span>
                  <span className="rd-services__blurb">{s.blurb}</span>
                </div>
              ))}
            </div>
            {caseStudies.length > 0 && (
              <div className="rd-cases">
                <Carousel
                  headClassName="rd-subhead"
                  head={<div className="rd-label">Case studies · {caseStudies.length}</div>}
                  arrows={caseStudies.length > 3}
                >
                  {caseStudies.map((c, i) => {
                    const slug = String(c.href || '').match(/^\/posts\/([^/?#]+)/)?.[1]
                    const post = slug ? postBySlug.get(slug) : null
                    const svc = c.service ? serviceTitle.get(c.service) : null
                    const href = c.href && c.href !== '#' ? c.href : undefined
                    return (
                      <HoverCard
                        key={c.id || i}
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
                              {c.source && svc && <br />}
                              {svc && (
                                <>
                                  <b>Service:</b> {svc}
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
                  })}
                </Carousel>
              </div>
            )}
          </section>
        )}

        {/* About + board */}
        {(homepage?.about?.lede || aboutParas.length > 0) && (
          <section id="about" className="sds-container rd-sec">
            <div className="rd-head">
              <h2 className="rd-h2">About</h2>
              <Link className="rd-meta rd-meta--link" href="/about">
                Full story &amp; board →
              </Link>
            </div>
            <div className="rd-about">
              <div>
                {homepage?.about?.lede && <p className="rd-about__lede rd-rise">{homepage.about.lede}</p>}
                {aboutParas.map((para, i) => (
                  <p key={i} className="rd-about__body">
                    {para.text}
                  </p>
                ))}
                {partners.length > 0 && (
                  <div className="rd-partners">
                    <div className="rd-label">Built with</div>
                    <div className="rd-partners__row">
                      {partners.map((n) => (
                        <div key={n} className="rd-partner">
                          {n}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="rd-glass rd-lift rd-facts">
                <div className="rd-facts__photo">
                  <Thumb name="Sarapis" label="" />
                </div>
                {facts.length > 0 && (
                  <div className="rd-facts__rows">
                    {facts.map((f, i) => (
                      <div key={i} className="rd-facts__row">
                        <span className="rd-facts__k">{f.key}</span>
                        <span className="rd-facts__v">{f.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {board.length > 0 && (
              <div className="rd-board">
                <Carousel
                  headClassName="rd-head rd-head--thin"
                  head={<h3 className="rd-h3">Board of Directors</h3>}
                  extra={<span className="rd-meta">{board.length} members</span>}
                  arrows={board.length > 3}
                >
                  {board.map((m, i) => (
                    <HoverCard
                      key={m.id || i}
                      label={m.name}
                      ratio="auto"
                      thumb={<Thumb name={m.name} label={initials(m.name)} />}
                      className="rd-boardcard"
                      gap={6}
                      reveal={
                        (m.bio || m.link) && (
                          <div className="rd-stack" style={{ gap: 10, paddingTop: 6 }}>
                            {m.bio && <p className="rd-bio">{m.bio}</p>}
                            {m.link && (
                              <a
                                className="rd-sitelink rd-sitelink--rule"
                                href={/^https?:\/\//.test(m.link) ? m.link : `https://${m.link}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {String(m.link).replace(/^https?:\/\//, '')} ↗
                              </a>
                            )}
                          </div>
                        )
                      }
                    >
                      <h4 className="rd-cardtitle rd-cardtitle--board">{m.name}</h4>
                      {m.role && <div className="rd-role-tag">{m.role}</div>}
                    </HoverCard>
                  ))}
                </Carousel>
              </div>
            )}
          </section>
        )}

        <div style={{ height: 64 }} />
      </div>
    </RdShell>
  )
}
