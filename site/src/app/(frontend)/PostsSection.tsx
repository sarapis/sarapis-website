'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Carousel } from './Carousel'
import { HoverCard, IconLink, Mono, Thumb } from './RdCards'
import { monogram } from './rd'

export type PostCard = { id: number; slug: string; title: string; cat: string; date: string; img: string | null }

/** Home "Recent posts": category filter chips over a three-up carousel of hover-reveal cards. */
export function PostsSection({ posts, cats }: { posts: PostCard[]; cats: string[] }) {
  const [filter, setFilter] = useState('all')
  const visible = posts.filter((p) => filter === 'all' || p.cat === filter)

  return (
    <section id="posts" className="sds-container rd-sec">
      <Carousel
        key={filter}
        head={<h2 className="rd-h2">Recent posts</h2>}
        extra={
          <Link className="rd-meta rd-meta--link" href="/posts">
            All posts →
          </Link>
        }
        arrows={visible.length > 3}
        below={
          cats.length > 0 ? (
            <div className="rd-filterrow">
              <span className="rd-label">Filter by topic</span>
              {['all', ...cats].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`sds-chip${filter === c ? ' sds-chip--active' : ''}`}
                  aria-pressed={filter === c}
                  onClick={() => setFilter(c)}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          ) : null
        }
      >
        {visible.map((p) => (
          <HoverCard
            key={p.id}
            href={`/posts/${p.slug}`}
            label={p.title}
            img={p.img}
            alt={p.title}
            thumb={<Thumb name={p.title} label={monogram(p.cat)} />}
            gap={10}
            reveal={
              <div className="rd-postfoot">
                <span className="rd-postfoot__date">{p.date}</span>
                <IconLink href={`/posts/${p.slug}`} title="Read the post" fill>
                  →
                </IconLink>
              </div>
            }
          >
            <div className="rd-idrow rd-idrow--tight">
              <Mono text={monogram(p.cat)} size={18} />
              <span className="sds-tag">{p.cat}</span>
            </div>
            <h3 className="rd-cardtitle rd-cardtitle--post">{p.title}</h3>
          </HoverCard>
        ))}
        {visible.length === 0 && <div className="sds-empty">No posts in this topic yet.</div>}
      </Carousel>
    </section>
  )
}
