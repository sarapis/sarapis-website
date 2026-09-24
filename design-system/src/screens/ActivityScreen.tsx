import * as React from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { SectionHeading } from '../components/SectionHeading'

const SUMMARY = [
  { n: '247', delta: '+18', l: 'Commits · YTD' },
  { n: '6', l: 'Active repos' },
  { n: '14', l: 'Knowledge artifacts' },
  { n: '9', l: 'News & posts' },
]

const FEED = [
  { kind: 'News', src: 'Gotham Gazette', title: "WeGovNYC's Databook Featured in Local News", date: 'Sep 14, 2021' },
  { kind: 'Blog', src: 'Sarapis', title: 'A Web App for Health Center Disaster Status Reporting', date: 'Mar 13, 2023' },
  { kind: 'Release', src: 'ORServices', title: 'ORServices Update #4 ships a directory builder', date: 'Nov 20, 2021' },
]

type Ev = { date: string; kind: 'code' | 'repo' | 'release' | 'artifact'; repo?: string; title: string; ftype?: 'md' | 'html'; diff?: [string, string]; meta?: string }
const TIMELINE: Ev[] = [
  { date: 'Jun 26', kind: 'code', repo: 'databook_interface', title: '12 commits to main', diff: ['+480', '−96'] },
  { date: 'Jun 24', kind: 'artifact', ftype: 'md', title: 'Open Referral HSDS validator — design notes', meta: 'knowledge' },
  { date: 'Jun 20', kind: 'release', repo: 'nyc_civil_title_viewer', title: 'v1.2.0 released', meta: 'release' },
  { date: 'Jun 18', kind: 'repo', repo: 'BPMN_experiments', title: 'New repository created', meta: 'repo' },
  { date: 'Jun 12', kind: 'artifact', ftype: 'html', title: 'Databook capital-projects methodology', meta: 'knowledge' },
]

const PINNED = [
  { kind: 'release', tag: 'Release', title: 'ORServices v4', meta: 'nyc_civil · Nov 2021' },
  { kind: 'md', tag: '.MD', title: 'HSDS Validator — design notes', meta: 'knowledge · Jun 2026' },
  { kind: 'code', tag: 'Repo', title: 'databook_interface', meta: '247 commits · active' },
]

const PROJECTS = [
  { repo: 'databook_interface', commits: 38, last: '2 hrs ago', status: 'active' as const },
  { repo: 'nyc_civil_title_viewer', commits: 12, last: '6 days ago', status: 'active' as const },
  { repo: 'BPMN_experiments', commits: 5, last: '3 wks ago', status: 'declared' as const },
]

const FILTERS = ['All projects', 'databook_interface', 'nyc_civil_title_viewer', 'BPMN_experiments']

/**
 * The Sarapis Activity page — a data-dense, "in the open" dashboard of repository
 * activity, released knowledge artifacts, and news/writing, synced from GitHub.
 * Composes the dashboard.css patterns (summary strip, feed cards, merged timeline +
 * pinned rail, projects table) with the shared Header/Footer chrome. Iterate on this
 * to design the real /activity page.
 */
export function ActivityScreen() {
  return (
    <div className="sds-page">
      <Header />

      {/* Hero */}
      <section className="sds-hero">
        <div className="sds-container sds-hero__inner">
          <h1 className="sds-hero__title">What we&rsquo;re making, in the open.</h1>
          <p className="sds-hero__lead">
            A live view of Sarapis&rsquo; repositories, releases, and published knowledge —
            synced from GitHub.
          </p>
        </div>
      </section>

      {/* Activity in 2026 — summary strip */}
      <section className="sds-container sds-section">
        <div className="sds-section__head">
          <SectionHeading title="Activity in 2026" />
          <span className="sds-chip sds-chip--active">Year to date</span>
        </div>
        <div className="sds-summary">
          {SUMMARY.map((s) => (
            <div key={s.l} className="sds-summary__cell">
              <div className="sds-summary__n">
                {s.n}
                {s.delta ? <span className="delta">{s.delta}</span> : null}
              </div>
              <div className="sds-summary__l">{s.l}</div>
            </div>
          ))}
          <div className="sds-summary__cell">
            <span className="sds-summary__l" style={{ marginTop: 0 }}>
              ↻ synced from GitHub · 2 hrs ago
            </span>
          </div>
        </div>
      </section>

      {/* In the news & writing */}
      <section className="sds-container sds-section">
        <div className="sds-section__head">
          <SectionHeading title="In the news &amp; writing" />
        </div>
        <div className="sds-feed">
          {FEED.map((f) => (
            <a key={f.title} className="sds-fcard" href="#">
              <span className="sds-fcard__kicker">
                {f.kind} <span className="src">· {f.src}</span>
              </span>
              <span className="sds-fcard__title">{f.title}</span>
              <span className="sds-fcard__date">{f.date}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Repository & knowledge activity */}
      <section className="sds-container sds-section">
        <div className="sds-section__head">
          <SectionHeading title="Repository &amp; knowledge activity" />
        </div>
        <div className="sds-toolbar" style={{ marginBottom: 'var(--sds-space-6)' }}>
          <div style={{ display: 'flex', gap: 'var(--sds-space-2)', flexWrap: 'wrap' }}>
            {FILTERS.map((f, i) => (
              <button key={f} className={`sds-chip${i === 0 ? ' sds-chip--active' : ''}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="sds-timeline-grid">
          {/* Left — merged chronological timeline */}
          <div className="sds-log">
            {TIMELINE.map((e, i) => (
              <div key={i} className="sds-trow">
                <div className="sds-trow__date">{e.date}</div>
                <div className={`sds-tdot sds-tdot--${e.kind}`} />
                <div>
                  <a className="sds-tlink" href="#">
                    {e.repo ? <span className="sds-lrow__title repo" style={{ fontFamily: 'var(--sds-font-mono)', fontWeight: 700, color: 'var(--sds-primary)' }}>{e.repo}</span> : null}
                    <span className="sds-arow__title" style={{ fontSize: '14.5px' }}>{e.title}</span>
                    {e.ftype ? <span className={`sds-ftype sds-ftype--${e.ftype}`}>.{e.ftype}</span> : null}
                    {e.kind === 'artifact' ? <span className="sds-ext">↗</span> : null}
                  </a>
                  <div className="sds-lrow__meta" style={{ marginTop: '4px' }}>
                    {e.diff ? (
                      <span className="sds-diff">
                        <span className="add">{e.diff[0]}</span> <span className="del">{e.diff[1]}</span>
                      </span>
                    ) : null}
                    {e.meta ? <span>{e.meta}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right — pinned rail */}
          <div className="sds-log">
            <div className="sds-dlist__head" style={{ display: 'block' }}>Pinned</div>
            {PINNED.map((p) => (
              <a key={p.title} className="sds-prow" href="#">
                <span className={`sds-ptag sds-ptag--${p.kind}`}>{p.tag}</span>
                <span className="sds-prow__title">{p.title}</span>
                <span className="sds-prow__meta">{p.meta}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Projects table */}
      <section className="sds-container sds-section">
        <div className="sds-section__head">
          <SectionHeading title="Projects" />
          <span style={{ fontSize: '0.875rem', color: 'var(--sds-muted-foreground)' }}>
            Sorted by last active
          </span>
        </div>
        <table className="sds-dtable">
          <thead>
            <tr>
              <th>Repository</th>
              <th className="num">Commits / 30d</th>
              <th>Last activity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {PROJECTS.map((p) => (
              <tr key={p.repo}>
                <td>
                  <span className="repo-nm">{p.repo}</span>
                </td>
                <td className="num">{p.commits}</td>
                <td>{p.last}</td>
                <td>
                  <span className={`sds-badge sds-badge--${p.status}`}>
                    {p.status === 'active' ? <span className="dot" /> : null}
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Footer />
    </div>
  )
}
