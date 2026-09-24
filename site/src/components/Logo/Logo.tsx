import clsx from 'clsx'
import React from 'react'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { loading: loadingFromProps, priority: priorityFromProps, className } = props
  const loading = loadingFromProps || 'lazy'
  const priority = priorityFromProps || 'low'

  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Sarapis"
        width={36}
        height={36}
        loading={loading}
        fetchPriority={priority}
        decoding="async"
        className="h-9 w-9"
        src="/sarapis-mark.png"
      />
      <span className="font-logo text-2xl font-normal uppercase tracking-[0.05em] text-current leading-none">
        Sarapis
      </span>
    </span>
  )
}
