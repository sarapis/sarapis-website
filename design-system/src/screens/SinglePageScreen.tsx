import * as React from 'react'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Callout } from '../components/Callout'
import { Footer } from '../components/Footer'
import { IMG } from './content'

/* ---- sample content (inline so the screen renders standalone in Claude Design) ---- */

const NAV = [
  { label: 'Projects', href: '#projects' },
  { label: 'Perspectives', href: '#perspectives' },
  { label: 'Services', href: '#services' },
  { label: 'About', href: '#about' },
  { label: 'Let’s talk', href: '#contact' },
]

const RECENT = [
  { cat: 'Open Government', title: 'WeGovNYC’s Databook Featured in Local News', date: 'FEB 2026 · Gotham Gazette', img: IMG.databook },
  { cat: 'Human Services', title: 'Deploying ORServices for Mutual Aid NYC', date: 'NOV 2025 · Field note', img: IMG.orservices },
  { cat: 'Open Government', title: 'Candidate Comparison Tool for the Daily News & Gotham Gazette', date: 'OCT 2025 · Launch', img: IMG.candidates },
]

const REGIONS = [
  { key: 'nyc', name: 'New York City', tag: 'Local civic tech', count: 4, text: 'Open tools and shared data built with NYC agencies and community groups to make city government legible and accountable.' },
  { key: 'global', name: 'Global', tag: 'Open source at large', count: 3, text: 'Platforms, standards and infrastructure we maintain for communities and institutions worldwide.' },
]

type Glyph = 'human' | 'hybrid' | 'ai'
const GLYPH: Record<Glyph, string> = { human: '●', hybrid: '◐', ai: '◑' }
const GLYPH_T: Record<Glyph, string> = { human: 'Human', hybrid: 'Human + AI', ai: 'AI' }
type Feed = { date: string; kind: 'code' | 'release' | 'repo'; title: string; repo?: string; diff?: [string, string]; glyph: Glyph }

type Proj = {
  name: string
  status: 'active' | 'declared' | 'reached'
  role: 'flagship' | 'standalone'
  blurb: string
  site?: string
  lastActive: string
  feed: Feed[]
  children?: { name: string; lineage: string; parent: string; lastActive: string }[]
}

// The active region's projects (NYC shown). Region switching is presentational here.
const PROJECTS: Proj[] = [
  {
    name: 'WeGov Databook',
    status: 'active',
    role: 'flagship',
    blurb: 'Our NYC flagship — a unified open-data platform that folds in tools we build with agencies and community groups into one explorable surface.',
    site: 'databook.nyc',
    lastActive: '2 min ago',
    feed: [
      { date: 'Today', kind: 'code', title: 'Pushed 6 commits to', repo: 'databook_interface', diff: ['+212', '−48'], glyph: 'hybrid' },
      { date: 'Jun 26', kind: 'release', title: 'v0.4.0 — spending-explorer filters', repo: 'databook_interface', glyph: 'human' },
      { date: 'Jun 20', kind: 'code', title: 'Merged PR #42 — classifier scoring', repo: 'databook_api', glyph: 'hybrid' },
    ],
    children: [
      { name: 'NYC Open Contracting Explorer', lineage: 'Experiment → App → Integrated', parent: 'WeGov Databook', lastActive: '5 days ago' },
      { name: 'NYC Civil Title Viewer', lineage: 'Experiment → App → Integrated', parent: 'WeGov Databook', lastActive: '3 wks ago' },
    ],
  },
  {
    name: 'NYC Open Data Pipeline',
    status: 'declared',
    role: 'standalone',
    blurb: 'A shared ingestion and normalization pipeline that keeps municipal open-data sources in sync for the tools above.',
    lastActive: 'Mar 13',
    feed: [
      { date: 'Mar 13', kind: 'repo', title: 'Created repository', repo: 'nyc_open_data_pipeline', glyph: 'human' },
    ],
  },
]

const STATUS = ['All', 'Active', 'Exploring', 'New']

const PERSPECTIVES = [
  { type: 'Essay', source: 'Devin Balkind', title: 'Why civic data needs a card catalog', date: 'MAY 2025' },
  { type: 'In the news', source: 'Gotham Gazette', title: 'WeGovNYC’s Databook featured in local news', date: 'FEB 2026' },
  { type: 'Essay', source: 'with AI assistance', title: 'What is “Municipalism,” and why does it matter?', date: 'AUG 2022' },
]

const SERVICES = [
  { n: '01', title: 'Solution Delivery', blurb: 'We scope, build, and deploy open-source tools end-to-end for nonprofits and agencies.' },
  { n: '02', title: 'Project Facilitation', blurb: 'We coordinate multi-stakeholder civic-tech projects and keep them shipping.' },
  { n: '03', title: 'Open Source Software Development', blurb: 'We extend and maintain FLOSS platforms the public sector can run itself.' },
]
const CASES = [
  { type: 'Emergency Management', source: 'FACHC', title: 'Health-center disaster status reporting' },
  { type: 'Human Services', source: 'Mutual Aid NYC', title: 'ORServices — an open service directory' },
  { type: 'Open Government', source: 'BetaNYC', title: 'Community Board Databases (CBDBs)' },
]
const FACTS = [
  { k: 'Founded', v: '2011 · New York City' },
  { k: 'Structure', v: '501(c)(3) nonprofit' },
  { k: 'Practice', v: 'Free, libre & open source' },
  { k: 'Focus areas', v: 'Four — see Services' },
]

/**
 * The Sarapis **single-page site** (handoff 7) — one scrolling page with a sticky
 * jump-nav. Order: Hero → Recent News → **Projects** → Perspectives → Services →
 * About → Let’s talk → Footer. "Activities" was retired; per-project activity now
 * lives inside the Projects centerpiece: region tabs (New York City / Global),
 * a lineage hierarchy (flagship → nested integrated apps → standalone), and
 * two-column project cards whose right rail is a "Last activity" feed.
 *
 * Presentational only — anchor jump-nav + CSS smooth scroll; region tabs, status
 * chips, and child expand/collapse show one active state rather than running
 * client JS (the production page drives them from URL params). Collapses ≤820px.
 */
export function SinglePageScreen() {
  return (
    <div className="sds-page sds-single">
      {/* Sticky jump nav */}
      <header className="sds-spnav">
        <div className="sds-container sds-spnav__bar">
          <a href="#top" aria-label="Sarapis — top" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Logo />
          </a>
          {/* JS-free mobile toggle (checkbox hack). The site uses a client button instead. */}
          <input type="checkbox" id="sds-spnav-cbx" className="sds-spnav__cbx" aria-hidden="true" />
          <label htmlFor="sds-spnav-cbx" className="sds-spnav__toggle" aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h16M3 11h16M3 16h16" />
            </svg>
          </label>
          <nav className="sds-spnav__nav">
            {NAV.map((n) => (
              <a key={n.label} className="sds-spnav__link" href={n.href}>{n.label}</a>
            ))}
            <Button href="#contact" size="sm">Donate</Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="sds-container">
        <div className="sds-onehero">
          <div>
            <p className="sds-eyebrow">Free, libre &amp; open source</p>
            <h1 className="sds-onehero__title">Technology should belong to the people it serves.</h1>
          </div>
          <div>
            <p className="sds-onehero__lead">
              For over a decade, Sarapis has built open solutions <em>with</em> — not for — nonprofits and the public sector.
            </p>
            <div className="sds-onehero__actions">
              <Button href="#contact" variant="primary">Let’s talk</Button>
              <Button href="#about" variant="outline">Read our story</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Recent News */}
      <section className="sds-container sds-band sds-band--first">
        <div className="sds-catalog__head">
          <span>Recent News</span>
          <a className="meta" href="#perspectives" style={{ color: 'var(--sds-primary)', textDecoration: 'none' }}>All perspectives →</a>
        </div>
        <div className="sds-grid sds-grid-3" style={{ marginTop: '22px' }}>
          {RECENT.map((r) => (
            <Card key={r.title} href="#" title={r.title} imageUrl={r.img} categories={[r.cat]} date={r.date} />
          ))}
        </div>
      </section>

      {/* Projects — the centerpiece */}
      <section id="projects" className="sds-container sds-band">
        <div className="sds-seclead">
          <h2 className="sds-seclead__title">Projects</h2>
          <span className="sds-seclead__meta">● Synced 2 min ago</span>
        </div>

        {/* Region tabs */}
        <div className="sds-rtabs">
          {REGIONS.map((r, i) => (
            <a key={r.key} className={`sds-rtab${i === 0 ? ' is-on' : ''}`} href="#projects">
              <div className="sds-rtab__top">
                <span className="sds-rtab__name">{r.name}</span>
                <span className="sds-rtab__tag">{r.tag}</span>
                <span className="sds-rtab__count">{r.count} projects</span>
              </div>
              <div className="sds-rtab__text">{r.text}</div>
            </a>
          ))}
        </div>

        {/* Status filter */}
        <div className="sds-toolbar" style={{ marginBottom: 'var(--sds-space-6)' }}>
          <div style={{ display: 'flex', gap: 'var(--sds-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="sds-seclead__meta">Status</span>
            {STATUS.map((s, i) => (
              <button key={s} className={`sds-chip${i === 0 ? ' sds-chip--active' : ''}`}>{s}</button>
            ))}
          </div>
          <span className="sds-seclead__meta">Hierarchy shows project lineage</span>
        </div>

        {/* Lineage hierarchy */}
        <div className="sds-pcol">
          {PROJECTS.map((p) => (
            <React.Fragment key={p.name}>
              <div className="sds-pcardwrap">
                <div className="sds-pcard">
                  <div className="sds-pcard__main">
                    <div className="sds-pcard__head">
                      <h3 className="sds-pcard__title">{p.name}</h3>
                      <span className={`sds-badge sds-badge--${p.status === 'active' ? 'active' : p.status === 'reached' ? 'reached' : 'declared'}`}>
                        {p.status === 'active' ? <span className="dot" /> : null}{p.status}
                      </span>
                    </div>
                    {(p.role === 'flagship') && (
                      <div className="sds-lstrip">
                        <span className="sds-lchip">★ Flagship platform</span>
                        <span className="sds-lnote">Integrates <strong>{p.children?.length ?? 0}</strong> apps that began as experiments</span>
                      </div>
                    )}
                    <p className="sds-pcard__blurb">{p.blurb}</p>
                    {p.site && <a className="sds-psite" href="#">↗ {p.site}</a>}
                    <a className="sds-pfoot" href="#">Full profile &amp; activity <span className="sds-arr">→</span></a>
                  </div>
                  <div className="sds-pcard__side">
                    <div className="sds-sidehd">Last activity · {p.lastActive}</div>
                    {p.feed.map((e, i) => (
                      <div className="sds-trow" key={i}>
                        <div className="sds-trow__date">{e.date}</div>
                        <div className={`sds-tdot sds-tdot--${e.kind}`} />
                        <div>
                          <span className="sds-lrow__title" style={{ fontSize: '13.5px' }}>
                            {e.title}{' '}
                            {e.repo && <span className="repo" style={{ fontFamily: 'var(--sds-font-mono)', fontWeight: 700, color: 'var(--sds-primary)' }}>{e.repo}</span>}
                          </span>
                          <div className="sds-lrow__meta" style={{ marginTop: '3px' }}>
                            {e.diff && <span className="sds-diff"><span className="add">{e.diff[0]}</span> <span className="del">{e.diff[1]}</span></span>}
                            <span className={`sds-glyph sds-glyph--${e.glyph}`} title={GLYPH_T[e.glyph]}>{GLYPH[e.glyph]} {GLYPH_T[e.glyph]}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {p.children && p.children.length > 0 && (
                <>
                  <div className="sds-subhead">Integrated apps ↓</div>
                  {p.children.map((c) => (
                    <a key={c.name} className="sds-childrow" href="#">
                      <span className="sds-cm-name">{c.name}</span>
                      <span className="sds-lchip">{c.lineage}</span>
                      <span className="sds-cm-note">↳ in <span className="repo">{c.parent}</span></span>
                      <span className="sds-cm-date">{c.lastActive}</span>
                      <span className="sds-cm-open">Open full card →</span>
                    </a>
                  ))}
                </>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Perspectives */}
      <section id="perspectives" className="sds-container sds-band">
        <div className="sds-seclead">
          <h2 className="sds-seclead__title">Perspectives</h2>
          <span className="sds-seclead__meta">Essays &amp; press</span>
        </div>
        <div className="sds-feed">
          {PERSPECTIVES.map((f) => (
            <a key={f.title} className="sds-fcard" href="#">
              <span className="sds-fcard__kicker">{f.type} <span className="src">· {f.source}</span></span>
              <span className="sds-fcard__title">{f.title}</span>
              <span className="sds-fcard__date">{f.date}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Services + Case Studies */}
      <section id="services" className="sds-container sds-band">
        <div className="sds-seclead">
          <h2 className="sds-seclead__title">Services</h2>
          <span className="sds-seclead__meta">Custom services, per client</span>
        </div>
        <div>
          {SERVICES.map((s) => (
            <a key={s.n} className="sds-catalog__row" href="#contact">
              <span className="sds-catalog__num">{s.n}</span>
              <span className="sds-catalog__title">{s.title}</span>
              <span className="sds-catalog__blurb">{s.blurb}</span>
              <span className="sds-catalog__arrow">→</span>
            </a>
          ))}
        </div>
        <div className="sds-catalog__head" style={{ marginTop: 'var(--sds-space-8)' }}>
          <span>Case Studies</span>
          <span className="meta">Example work</span>
        </div>
        <div className="sds-feed" style={{ marginTop: '22px' }}>
          {CASES.map((f) => (
            <a key={f.title} className="sds-fcard" href="#">
              <span className="sds-fcard__kicker">{f.type} <span className="src">· {f.source}</span></span>
              <span className="sds-fcard__title">{f.title}</span>
              <span className="sds-fcard__date">Example work</span>
            </a>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="sds-container sds-band">
        <div className="sds-seclead">
          <h2 className="sds-seclead__title">About</h2>
          <span className="sds-seclead__meta">Who we are</span>
        </div>
        <div className="sds-about">
          <div>
            <p className="sds-about__lede">
              We help nonprofits and government agencies leverage open source software and open data to work transparently and democratically.
            </p>
            <p className="sds-about__body">
              Sarapis is a 501(c)(3) nonprofit founded in 2011 in New York City. We believe technology built for the public should be owned by the public — free to run, study, share, and improve.
            </p>
            <p className="sds-about__body">
              Our practice spans four focus areas: Open Government, Human Services, Emergency Management, and the Collaborative Economy.
            </p>
          </div>
          <div className="sds-about-facts">
            {FACTS.map((f) => (
              <div key={f.k} className="sds-fact">
                <span className="sds-fact__k">{f.k}</span>
                <span className="sds-fact__v">{f.v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Let’s talk */}
      <section id="contact" className="sds-container sds-band" style={{ paddingBottom: '56px' }}>
        <Callout
          title="Building something for the public good?"
          text="Tell us what you’re working on. We’ll help you scope, build, and run it in the open."
          action={
            <span style={{ ['--sds-primary' as string]: 'var(--sds-gold)', ['--sds-primary-foreground' as string]: 'var(--sds-ink)' }}>
              <Button variant="primary" size="lg" href="#">Let’s Talk</Button>
            </span>
          }
        />
      </section>

      <Footer />
    </div>
  )
}
