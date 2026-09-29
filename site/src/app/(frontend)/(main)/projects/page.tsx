import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import '../../home.css'
import { ProjectsView } from '../../ProjectsView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'All Projects · Sarapis',
  description:
    'Every Sarapis project — flagships, the projects inside them, and standalone tools — across New York City and the wider open-source commons, at every stage.',
}

export default async function AllProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; pstatus?: string }>
}) {
  const sp = await searchParams
  const region = sp.region === 'global' ? 'global' : sp.region === 'nyc' ? 'nyc' : 'all'
  const pstatus = sp.pstatus || null

  return (
    <div className="sds-page sds-project">
      {/* Header */}
      <section className="sds-container sds-projhead">
        <nav className="sds-crumb" aria-label="Breadcrumb">
          <Link href="/">← Home</Link>
          <span className="sds-crumb__sep">/</span>
          <span className="sds-crumb__here">All Projects</span>
        </nav>
        <div className="sds-projhead__row">
          <h1 className="sds-projhead__title">All Projects</h1>
        </div>
        <p className="sds-projhead__sum" style={{ maxWidth: '52rem' }}>
          Everything we build and steward — flagship platforms, the subprojects, features and integrations that grew out of
          them, and standalone tools — at every stage, from declared to active to goal-reached.
          Hierarchy shows project lineage.
        </p>
      </section>

      <ProjectsView
        basePath="/projects"
        region={region}
        pstatus={pstatus}
        showStatusFilter
        heading="Projects"
        metaSlot={<span className="rd-meta rd-chipmeta">Tiles on each card link to what’s inside it</span>}
      />
    </div>
  )
}
