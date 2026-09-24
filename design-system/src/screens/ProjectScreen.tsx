import * as React from 'react'

/* ---- sample content: the Databook project profile (handoff 7) ----
   Inline so the screen renders standalone in Claude Design. Route in
   production: /projects/[id], inside the site's global Header/Footer chrome. */

const PROJECT = {
  name: 'Databook',
  status: 'active' as const,
  focus: 'Open Government',
  summary: 'databook.nyc — a public explorer of NYC contract spending, with AI-assisted contract analysis.',
  site: 'databook.nyc',
  region: 'New York City',
  parent: 'WeGovNYC',
  children: ['NYC Open Contracting Explorer', 'NYC Civil Title Viewer'],
  links: [
    { label: 'GitHub org', href: '#' },
    { label: 'Methodology', href: '#' },
    { label: 'About the data', href: '#' },
  ],
}

type Glyph = 'human' | 'hybrid' | 'ai'
const GLYPH: Record<Glyph, string> = { human: '●', hybrid: '◐', ai: '◑' }
const GLYPH_T: Record<Glyph, string> = { human: 'Human', hybrid: 'Human + AI', ai: 'AI' }

const PINNED = [
  { tag: '.MD', cls: 'md', title: 'AI Contract Classifier — prompt, inputs & assumptions', meta: 'Jun 24, 2026' },
  { tag: 'RELEASE', cls: 'release', title: 'v1.2.0 — classifier in production', meta: 'databook_interface · Jun 20' },
  { tag: 'In the news', cls: 'html', title: 'Databook featured in Gotham Gazette', meta: 'Gotham Gazette · Feb 2026' },
]
const PIN_TOTAL = 5

type Ev = { date: string; kind: 'code' | 'release' | 'repo'; title: string; repo?: string; diff?: [string, string]; actor: string; glyph: Glyph; note?: string }
const ACTIVITY: Ev[] = [
  { date: 'Jul 3', kind: 'code', title: '9 commits to main', repo: 'databook_interface', diff: ['+512', '−88'], actor: '@devinbalkind', glyph: 'human' },
  { date: 'Jun 28', kind: 'code', title: 'Merged PR #42 — classifier scoring endpoint', repo: 'databook_api', actor: '@devinbalkind', glyph: 'hybrid', note: 'Prompt + endpoint tests drafted with Claude, reviewed by hand.' },
  { date: 'Jun 21', kind: 'release', title: 'v0.4.0 — spending-explorer filters', repo: 'databook_interface', actor: '@devinbalkind', glyph: 'human' },
  { date: 'Jun 14', kind: 'code', title: '6 commits to main', repo: 'databook', diff: ['+140', '−140'], actor: '@devinbalkind', glyph: 'ai', note: 'Automated dependency bumps.' },
  { date: 'Jun 2', kind: 'repo', title: 'New repository created', repo: 'databook_api', actor: '@devinbalkind', glyph: 'human' },
  { date: 'May 30', kind: 'code', title: '4 commits to main', repo: 'databook_interface', diff: ['+88', '−12'], actor: '@devinbalkind', glyph: 'human' },
]
const ACT_TOTAL = 23

const KNOWLEDGE = [
  { ftype: 'md', title: 'AI Contract Classifier — prompt, inputs & assumptions', sum: 'The system prompt, input fields, and stated assumptions behind Databook’s classifier.', date: 'Jun 24, 2026' },
  { ftype: 'html', title: 'Databook capital-projects methodology', sum: 'How capital-project spending is grouped and normalized.', date: 'Jun 12, 2026' },
]
const REPOS = [
  { fullName: 'wegovnyc/databook_interface', push: 'Jul 3, 2026' },
  { fullName: 'wegovnyc/databook_api', push: 'Jun 28, 2026' },
  { fullName: 'wegovnyc/databook', push: 'Jun 14, 2026' },
]

/**
 * The Sarapis **Project profile** page (handoff 7) — route `/projects/[id]`,
 * rendered inside the site's global Header/Footer. Breadcrumb up the region tree,
 * identity head, a featured project-home link + secondary link pills, a kin strip
 * (parent + integrated children), a unified **Pinned** deck (3/page pager), then
 * **Activity / Knowledge / Repositories** panels — each with a pagination footer.
 * Presentational: pagers show one page; production drives them from URL params.
 */
export function ProjectScreen() {
  const p = PROJECT
  return (
    <div className="sds-page sds-project">
      {/* Identity */}
      <section className="sds-container sds-projhead">
        <nav className="sds-crumb" aria-label="Breadcrumb">
          <a href="#">← Projects</a>
          <span className="sds-crumb__sep">/</span>
          <a href="#">{p.region}</a>
          <span className="sds-crumb__sep">/</span>
          <span className="sds-crumb__here">{p.name}</span>
        </nav>

        <div className="sds-projhead__row">
          <h1 className="sds-projhead__title">{p.name}</h1>
          <span className="sds-badge sds-badge--active"><span className="dot" />{p.status}</span>
          <span className="sds-tag">{p.focus}</span>
        </div>
        <p className="sds-projhead__sum">{p.summary}</p>

        <div className="sds-links">
          <a className="sds-links__main" href="#">↗ {p.site} <small>Project home</small></a>
          <div className="sds-links__more">
            {p.links.map((l) => (
              <a key={l.label} href={l.href}>↗ {l.label}</a>
            ))}
          </div>
        </div>

        <div className="sds-kin">
          <span className="sds-kin__label">Part of</span>
          <a href="#">⌂ {p.parent}</a>
          <span className="sds-kin__gap" />
          <span className="sds-kin__label">Integrates</span>
          {p.children.map((c) => (
            <a key={c} href="#">{c}</a>
          ))}
        </div>
      </section>

      <section className="sds-container sds-band sds-band--first">
        {/* Pinned deck */}
        <div className="sds-pinstrip">
          <div className="sds-pinstrip__hd"><span className="sds-panel__t">★ Pinned</span></div>
          <div className="sds-pincards">
            {PINNED.map((c) => (
              <a key={c.title} className="sds-pincard" href="#">
                <span className={`sds-ptag sds-ptag--${c.cls}`}>{c.tag}</span>
                <span className="sds-pincard__title">{c.title}</span>
                <span className="sds-pincard__meta">{c.meta}</span>
              </a>
            ))}
          </div>
          <div className="sds-pager sds-pager--float">
            <span className="sds-pager__info">Showing 1–3 of {PIN_TOTAL}</span>
            <div className="sds-pager__btns">
              <a className="sds-pager__b" aria-disabled="true" href="#">Prev</a>
              <span className="sds-pager__page">1 / 2</span>
              <a className="sds-pager__b" href="#">Next</a>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="sds-panel" style={{ marginBottom: '22px' }}>
          <div className="sds-panel__hd"><span className="sds-panel__t">Activity</span></div>
          {ACTIVITY.map((e, i) => (
            <div className="sds-trow" key={i}>
              <div className="sds-trow__date">{e.date}</div>
              <div className={`sds-tdot sds-tdot--${e.kind}`} />
              <div>
                <a className="sds-tlink" href="#">
                  <span className="sds-lrow__title" style={{ fontSize: '13.5px' }}>
                    {e.title}{' '}
                    {e.repo && <span className="repo" style={{ fontFamily: 'var(--sds-font-mono)', fontWeight: 700, color: 'var(--sds-primary)' }}>{e.repo}</span>}
                    <span className="sds-ext"> ↗</span>
                  </span>
                </a>
                {e.note && <p className="sds-tnote">{e.note}</p>}
                <div className="sds-lrow__meta" style={{ marginTop: '3px' }}>
                  {e.diff && <span className="sds-diff"><span className="add">{e.diff[0]}</span> <span className="del">{e.diff[1]}</span></span>}
                  <span className={`sds-glyph sds-glyph--${e.glyph}`} title={GLYPH_T[e.glyph]}>{GLYPH[e.glyph]} {GLYPH_T[e.glyph]}</span>
                  <span className="sds-actor">{e.actor}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="sds-pager">
            <span className="sds-pager__info">Showing 1–6 of {ACT_TOTAL} events</span>
            <div className="sds-pager__btns">
              <a className="sds-pager__b" aria-disabled="true" href="#">Prev</a>
              <span className="sds-pager__page">1 / 4</span>
              <a className="sds-pager__b" href="#">Next</a>
            </div>
          </div>
        </div>

        {/* Knowledge + Repositories */}
        <div className="sds-timeline-grid">
          <div className="sds-panel">
            <div className="sds-panel__hd"><span className="sds-panel__t">Knowledge</span></div>
            {KNOWLEDGE.map((k) => (
              <a key={k.title} className="sds-arow" href="#">
                <span className={`sds-ftype sds-ftype--${k.ftype}`}>.{k.ftype}</span>
                <span>
                  <span className="sds-arow__title">{k.title}</span>
                  <span className="sds-arow__sum" style={{ display: 'block' }}>{k.sum}</span>
                </span>
                <span className="sds-arow__meta">{k.date}</span>
                <span className="sds-ext">↗</span>
              </a>
            ))}
          </div>
          <div className="sds-panel">
            <div className="sds-panel__hd"><span className="sds-panel__t">Repositories</span></div>
            {REPOS.map((r) => (
              <a key={r.fullName} className="sds-rrow" href="#">
                <span className="sds-rrow__name">{r.fullName}</span>
                <span className="sds-rrow__push">{r.push}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
