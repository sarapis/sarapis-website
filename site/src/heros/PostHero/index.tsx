import { formatDateTime } from 'src/utilities/formatDateTime'
import React from 'react'

import type { Post } from '@/payload-types'

import { Media } from '@/components/Media'
import { formatAuthors } from '@/utilities/formatAuthors'

export const PostHero: React.FC<{
  post: Post
}> = ({ post }) => {
  const { categories, heroImage, populatedAuthors, publishedAt, title } = post

  const hasAuthors =
    populatedAuthors && populatedAuthors.length > 0 && formatAuthors(populatedAuthors) !== ''

  const categoryTitles = (categories || [])
    .map((c) => (typeof c === 'object' && c ? c.title : null))
    .filter(Boolean)

  return (
    <header className="container">
      <div className="mx-auto max-w-3xl">
        {categoryTitles.length > 0 && (
          <p className="text-sm font-medium text-primary mb-4">{categoryTitles.join(', ')}</p>
        )}
        <h1 className="font-serif text-3xl md:text-5xl leading-[1.1] mb-6">{title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {hasAuthors && (
            <>
              <span>{formatAuthors(populatedAuthors)}</span>
              {publishedAt && <span aria-hidden>·</span>}
            </>
          )}
          {publishedAt && <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>}
        </div>
      </div>

      {heroImage && typeof heroImage !== 'string' && (
        <div className="mx-auto max-w-4xl mt-10 relative aspect-[16/9] overflow-hidden rounded-xl border border-border">
          <Media fill priority imgClassName="object-cover" resource={heroImage} />
        </div>
      )}
    </header>
  )
}
