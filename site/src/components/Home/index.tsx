import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Post } from '@/payload-types'
import { Card } from '@/components/Card'

const WORK_AREAS: { slug: string; title: string; blurb: string }[] = [
  {
    slug: 'open-government',
    title: 'Open Government',
    blurb: 'Transparency tools and open data that make public institutions accountable.',
  },
  {
    slug: 'human-services',
    title: 'Human Services',
    blurb: 'Open Referral data standards and directories that connect people to help.',
  },
  {
    slug: 'emergency-management',
    title: 'Emergency Management',
    blurb: 'Disaster-preparedness and mutual-aid systems communities can run themselves.',
  },
  {
    slug: 'collaborative-economy',
    title: 'Collaborative Economy',
    blurb: 'Platform cooperatives and shared digital infrastructure owned in common.',
  },
]

export const Home: React.FC = async () => {
  const payload = await getPayload({ config: configPromise })

  const postsRes = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 3,
    sort: '-publishedAt',
    where: { _status: { equals: 'published' } },
    overrideAccess: false,
  })
  const posts = postsRes.docs as Post[]

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sarapis-mark.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none hidden md:block absolute -right-16 top-1/2 -translate-y-1/2 w-[34rem] max-w-[55%] opacity-[0.07]"
        />
        <div className="container relative z-10 pt-14 pb-16 md:pt-20 md:pb-24">
          <p className="inline-flex items-center gap-[0.55rem] font-meta text-[0.78rem] font-bold uppercase tracking-[0.16em] text-primary mb-5 before:content-[''] before:inline-block before:w-[18px] before:h-[3px] before:bg-gold">
            Free, libre &amp; open source · 501(c)(3) nonprofit
          </p>
          <h1 className="font-serif text-4xl md:text-6xl leading-[1.08] max-w-4xl">
            Technology should belong to the people it serves.
          </h1>
          <p className="mt-7 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            For over a decade, Sarapis has built free, libre &amp; open source solutions
            <span className="italic"> with</span> — not for — nonprofits and the public sector.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Let&rsquo;s talk
            </Link>
            <Link
              href="/about"
              className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              Read our story
            </Link>
          </div>
        </div>
      </section>

      {/* Work areas */}
      <section className="container py-14 border-t border-border">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="font-serif text-2xl md:text-3xl">Our work</h2>
          <span className="text-sm text-muted-foreground">Four focus areas</span>
        </div>
        <div className="grid gap-px bg-border md:grid-cols-2 lg:grid-cols-4 border border-border">
          {WORK_AREAS.map((w) => (
            <Link
              key={w.slug}
              href={`/${w.slug}`}
              className="group bg-background p-7 hover:bg-accent transition-colors"
            >
              <h3 className="font-serif text-xl text-primary mb-3 group-hover:underline underline-offset-4">
                {w.title}
              </h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{w.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent writing */}
      {posts.length > 0 && (
        <section className="container py-14 border-t border-border">
          <div className="flex items-baseline justify-between mb-10">
            <h2 className="font-serif text-2xl md:text-3xl">Recent writing</h2>
            <Link href="/posts" className="text-sm text-primary hover:underline underline-offset-4">
              View all →
            </Link>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {posts.map((p) => (
              <Card key={p.id} doc={p} relationTo="posts" showCategories />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container py-20 border-t border-border">
        <div className="rounded-2xl bg-primary px-8 py-14 md:px-14 text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-primary-foreground max-w-2xl mx-auto leading-tight">
            Building something for the public good?
          </h2>
          <p className="mt-4 text-primary-foreground/85 max-w-xl mx-auto">
            We partner with mission-driven organizations to design, build, and maintain open
            solutions.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-block rounded-full bg-background px-7 py-3 text-sm font-medium text-foreground hover:opacity-90 transition-opacity"
          >
            Work with Sarapis
          </Link>
        </div>
      </section>
    </div>
  )
}
