import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Artifacts are admin-authored today, but sanitize anyway — a leaked or weak
// admin credential must not become stored XSS on the public site. Allows the
// document vocabulary (headings, tables, images) and strips everything active.
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'details', 'summary']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'width', 'height'],
    a: ['href', 'name', 'target', 'rel'],
    '*': ['id'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
}

export const dynamic = 'force-dynamic'

const mediaDir = () => process.env.MEDIA_DIR || path.resolve(process.cwd(), 'public/media')

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null

async function getItem(id: string): Promise<any | null> {
  const payload = await getPayload({ config: configPromise })
  try {
    const doc = await payload.findByID({ collection: 'knowledge-items', id, depth: 1 })
    // Public page: only show published items.
    return doc && (doc as any).published ? doc : null
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const item = await getItem(id)
  return { title: item ? `${item.title} · Sarapis` : 'Knowledge · Sarapis' }
}

export default async function KnowledgeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await getItem(id)
  if (!item) notFound()

  // Links just bounce to their destination — but only http(s) or a local path,
  // so this page can't be used as an open redirector (or a javascript: vector).
  if (item.kind === 'link' && item.url) {
    const url: string = item.url
    let safe = url.startsWith('/') && !url.startsWith('//')
    if (!safe) {
      try {
        safe = ['http:', 'https:'].includes(new URL(url).protocol)
      } catch {
        safe = false
      }
    }
    if (!safe) notFound()
    redirect(url)
  }

  const artifact = item.artifact && typeof item.artifact === 'object' ? item.artifact : null
  const fileType: string | undefined = item.fileType || undefined
  const rawHref = artifact?.url as string | undefined

  // Load + render the artifact body.
  let bodyHtml: string | null = null
  let renderError = false
  if (artifact?.filename) {
    try {
      // Containment: never read outside the media dir, even if a filename were
      // ever written through the API with path segments in it.
      const base = path.resolve(mediaDir())
      const filePath = path.resolve(base, artifact.filename)
      if (!filePath.startsWith(base + path.sep)) throw new Error('artifact path escapes media dir')
      const text = await readFile(filePath, 'utf8')
      if (fileType === 'html' || /\.html?$/i.test(artifact.filename)) {
        bodyHtml = sanitizeHtml(text, SANITIZE)
      } else {
        // Drop a leading H1 — the page header already shows the title.
        const md = text.replace(/^﻿?\s*#\s+[^\n]*\r?\n+/, '')
        bodyHtml = sanitizeHtml(await marked.parse(md, { gfm: true }), SANITIZE)
      }
    } catch {
      renderError = true
    }
  }

  const projectName = item.project && typeof item.project === 'object' ? item.project.name : null
  const date = fmtDate(item.date)

  return (
    <article className="container py-14 md:py-20">
      <div className="mx-auto max-w-3xl">
        {/* Editorial header */}
        <p className="inline-flex items-center gap-[0.55rem] font-meta text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary mb-5 before:content-[''] before:inline-block before:w-[18px] before:h-[3px] before:bg-gold">
          Knowledge{fileType ? ` · .${fileType}` : ''}
        </p>
        <h1 className="font-serif text-3xl md:text-5xl font-medium leading-[1.1] mb-6">{item.title}</h1>

        {item.summary && (
          <p className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-2xl">{item.summary}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-meta text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground border-t border-b border-border py-3">
          {date && <span>{date}</span>}
          {projectName && <span>{projectName}</span>}
          {rawHref && (
            <a href={rawHref} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
              View source file ↗
            </a>
          )}
        </div>
      </div>

      {/* Rendered body */}
      <div className="mx-auto max-w-3xl mt-10">
        {bodyHtml ? (
          <div
            className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:font-medium"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p className="text-muted-foreground">
            {renderError ? 'This artifact could not be rendered. ' : 'No preview available for this file. '}
            {rawHref && (
              <a href={rawHref} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                Download the source file
              </a>
            )}
          </p>
        )}
      </div>

      <div className="mx-auto max-w-3xl mt-16 pt-8 border-t border-border">
        <Link href="/activity" className="font-meta text-[0.72rem] font-bold uppercase tracking-[0.11em] text-primary hover:opacity-80">
          ← Back to Activity
        </Link>
      </div>
    </article>
  )
}
