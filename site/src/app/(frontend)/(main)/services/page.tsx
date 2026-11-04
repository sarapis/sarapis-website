import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import '../../home.css'
import RichText from '@/components/RichText'
import { caseStudySlug } from '../../RdCards'
import { CaseStudyRow } from '../../CaseStudyRow'
import { WikiNav, type WikiItem } from '../../WikiNav'
import { mediaUrl } from '../../rd'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Services · Sarapis',
  description: 'How Sarapis works with nonprofits and the public sector — solution delivery, project facilitation, and open-source software development.',
}

const slugify = (s: string) =>
  String(s || '').toLowerCase().trim().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '')

export default async function ServicesPage() {
  const payload = await getPayload({ config: configPromise })
  const hp = (await payload.findGlobal({ slug: 'homepage' })) as any

  const services: any[] = Array.isArray(hp?.services) ? hp.services : []
  const caseStudies: any[] = Array.isArray(hp?.caseStudies) ? hp.caseStudies : []
  const serviceSlug = (s: any) => s.slug || slugify(s.title)
  const csId = (c: any) => `cs-${caseStudySlug(c) || slugify(c.title)}`

  // the post each case study links to: its image, and the full report shown when the row is expanded
  const slugs = caseStudies.map(caseStudySlug).filter(Boolean) as string[]
  const postRes = slugs.length
    ? await payload.find({ collection: 'posts', where: { slug: { in: slugs }, _status: { equals: 'published' } }, limit: 50, depth: 2 })
    : { docs: [] as any[] }
  const postBySlug = new Map((postRes.docs as any[]).map((p) => [p.slug, p]))

  const relatedTo = (s: any) => caseStudies.filter((c) => c.service && slugify(c.service) === serviceSlug(s))

  const nav: WikiItem[] = services.map((s, i) => ({
    id: serviceSlug(s),
    num: s.number || String(i + 1).padStart(2, '0'),
    label: s.title,
    children: relatedTo(s).map((c) => ({ id: csId(c), label: c.title })),
  }))

  return (
    <div className="sds-page sds-project">
      {/* Header */}
      <section className="sds-container sds-projhead">
        <nav className="sds-crumb" aria-label="Breadcrumb">
          <Link href="/">← Home</Link>
          <span className="sds-crumb__sep">/</span>
          <span className="sds-crumb__here">Services</span>
        </nav>
        <div className="sds-projhead__row">
          <h1 className="sds-projhead__title">Services</h1>
        </div>
        <p className="sds-projhead__sum">
          We work alongside your team — scoping, building, facilitating, and maintaining the open
          tools your mission depends on. Every engagement is scoped to the client.
        </p>
      </section>

      <div className="sds-container rd-wiki">
        {/* Wiki-style contents: services, with their case studies nested beneath */}
        <aside className="rd-wiki__side">
          <WikiNav items={nav} title="Services" />
        </aside>

        <div className="rd-wiki__main">
          {services.map((s, i) => {
            const slug = serviceSlug(s)
            const related = relatedTo(s)
            return (
              <section key={slug} id={slug} className="rd-wiki__sec">
                <div className="rd-head">
                  <h2 className="rd-h2">
                    <span className="rd-wiki__num">{s.number || String(i + 1).padStart(2, '0')}</span>
                    {s.title}
                  </h2>
                  <Link className="rd-meta rd-meta--link" href="/#contact">
                    Start a project →
                  </Link>
                </div>

                <p className="rd-wiki__lede">{s.description || s.blurb || ''}</p>

                {related.length > 0 && (
                  <div className="rd-wiki__cases">
                    <div className="rd-label">Case studies · {related.length}</div>
                    {related.map((c, j) => {
                      const ps = caseStudySlug(c)
                      const post = ps ? postBySlug.get(ps) : null
                      const href = c.href && c.href !== '#' ? c.href : undefined
                      return (
                        <CaseStudyRow
                          key={c.id || j}
                          id={csId(c)}
                          type={c.type}
                          title={c.title}
                          source={c.source}
                          image={post ? mediaUrl(post.heroImage) || mediaUrl(post.meta?.image) : null}
                          href={href}
                          pageHref={post ? `/posts/${post.slug}` : undefined}
                        >
                          {post?.content ? <RichText data={post.content} enableGutter={false} /> : undefined}
                        </CaseStudyRow>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <div style={{ height: 56 }} />
    </div>
  )
}
