import type { Payload } from 'payload'

/**
 * Phase 2 github-sync — pulls repos + activity events from GitHub for a fixed
 * set of owners and upserts them into the `repos` and `activity-events`
 * collections. Idempotent: keyed by `repos.fullName` and
 * `activity-events.externalId`. Only SOURCE fields are written — editorial
 * fields (published / pinned / focusArea / project / authorship / note) are
 * never touched, so curators' choices survive every sync.
 *
 * Auth token comes from GITHUB_TOKEN. Owners default to the Sarapis set and can
 * be overridden with SYNC_OWNERS (comma-separated).
 */

const GITHUB_API = 'https://api.github.com'
const DEFAULT_OWNERS = ['sarapis', 'wegovnyc', 'MutualAidNYC', 'sahana', 'openreferral']

// Skip the expensive per-repo calls (commits/PRs) for repos with no push in this window.
const ACTIVE_WINDOW_DAYS = 400

type Summary = {
  owners: string[]
  repos: { seen: number; created: number; updated: number }
  events: { created: number; updated: number; byKind: Record<string, number> }
  // Events whose every commit/PR subject was internal engineering process, so
  // they were created unpublished. Reported so a run that quietly filters a lot
  // is visible in the cron log rather than looking like the sync found nothing.
  filtered: { commitDays: number; pulls: number }
  errors: string[]
}

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'sarapis-activity-sync',
  }
}

async function gh<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(path.startsWith('http') ? path : `${GITHUB_API}${path}`, {
    headers: ghHeaders(token),
    cache: 'no-store',
    // `maxDuration` is a Vercel-ism (no-op self-hosted) — without a timeout a
    // stalled GitHub connection would hang the sync request indefinitely.
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}: ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

/** Paginate a list endpoint (Link header) up to a page cap. */
async function ghList<T>(path: string, token: string, maxPages = 5): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?'
    const batch = await gh<T[]>(`${path}${sep}per_page=100&page=${page}`, token)
    if (!batch || batch.length === 0) break
    out.push(...batch)
    if (batch.length < 100) break
  }
  return out
}

type GhRepo = {
  full_name: string
  html_url: string
  description: string | null
  pushed_at: string | null
  created_at: string | null
  default_branch: string
  archived: boolean
  owner: { login: string }
}
type GhCommit = {
  sha: string
  author: { login: string } | null // linked GitHub account (null if email unmatched)
  commit: { message: string; author?: { name?: string; date?: string }; committer?: { date?: string } }
}
type GhRelease = { id: number; name: string | null; tag_name: string; published_at: string | null; created_at: string; html_url: string; author: { login: string } | null }
type GhPull = { number: number; title: string; body: string | null; created_at: string; html_url: string; user: { login: string } | null }

// Commit messages carry an AI co-author trailer in the Antigravity workflow.
const AI_TRAILER = /co-authored-by:[^\n]*(claude|anthropic)/i

/**
 * Internal-work filter for the PUBLIC feed.
 *
 * Commit events are aggregated per calendar day, so a single event's summary
 * can mix genuine product work with deploy/CI/process churn — e.g. one real
 * day read "Reorganized the admin navigation, hid collections from curators …
 * Added a Caddy SSL certificate installation script and forwarded Resend API
 * keys … Updated deployment compose files". Filtering at the EVENT level would
 * throw away the curator-facing work to lose the SSL script, so we filter at
 * the MESSAGE level instead: only substantive lines are fed to the summarizer.
 * An event whose every message is internal gets no summary and is never
 * auto-published — it still lands in the DB for /admin, just not on the site.
 *
 * Deliberately conservative about docs: public-facing documentation (API
 * references, developer guides) is real published work, so a `docs:` prefix
 * alone does NOT mark a line internal — only docs naming an internal artifact
 * (runbook, checklist, cutover, handoff…) do.
 *
 * This is the first of two layers. The summarizer prompt is the second, and it
 * can return NOTHING_PUBLIC for nuance a regex can't reach. Over-filtering is
 * cheap here (the event is unpublished, not deleted — recoverable in /admin);
 * under-filtering puts internal process on a public page, which is the thing
 * Devin asked us to stop.
 */
const INTERNAL_PREFIX = /^\s*(chore|ci|build|release|revert|style|deps?|refactor)\b\s*(\([^)]*\))?\s*!?:/i
const DOC_PREFIX = /^\s*docs?\b\s*(\([^)]*\))?\s*!?:/i
const INTERNAL_DOC = /\b(runbook|checklist|cutover|handoff|contributing|internal|deploy)/i
const INTERNAL_MARKER = new RegExp(
  [
    'deploy(?:ment|ing|ed|s)?\\b',
    'redeploy',
    'rollback',
    'docker(?:file|-compose)?\\b',
    'compose\\.ya?ml',
    'compose file',
    'runbook',
    'checklist',
    'cutover',
    'handoff',
    'contributing',
    '\\bCI\\b',
    'CI/CD',
    'github actions',
    'workflow file',
    '\\.github/',
    'lock(?:file)?\\b',
    'bump(?:ed)?\\s+(?:the\\s+)?(?:version|dep)',
    '\\.gitignore',
    '\\brsync\\b',
    '\\bchmod\\b',
    'uid permission',
    '\\bcaddy\\b',
    '\\bnginx\\b',
    'certbot',
    '\\bTLS\\b',
    '\\bSSL\\b',
    'certificate',
    'secrets?\\b',
    'API key',
    '\\.env\\b',
    'env(?:ironment)? var',
    'smoke test',
    'backup (?:script|pipeline)',
    'cron job',
    'healthcheck',
    // Test / lint / typecheck churn. Matched by named tools, by qualified test
    // nouns, and by "tests" only as the OBJECT of a dev verb — a bare \btests?\b
    // would swallow real features ("users can now test their submission").
    'pytest',
    '\\bplaywright\\b',
    '\\bvitest\\b',
    '\\bjest\\b',
    '\\beslint\\b',
    '\\bprettier\\b',
    '\\blint(?:ing|er)?\\b',
    'typecheck',
    '\\btsc\\b',
    'test(?:s|ing)? suite',
    '(?:unit|integration|e2e|end-to-end|snapshot|regression) tests?\\b',
    'test coverage',
    '(?:add|adds|added|update|updated|fix|fixed|expand|expanded|improve|improved|refactor|refactored|remove|removed)\\w*\\s+(?:the\\s+|a\\s+|some\\s+)?tests?\\b',
    // Hosting/plumbing proper nouns — where something runs is not news to a
    // funder. Deliberately narrow: no bare "database"/"migration", which appear
    // in genuine product work ("import editorial content", "migrate to Postgres").
    'cloudflare',
    'hetzner',
    'lightsail',
    '\\bvercel\\b',
    '\\bminio\\b',
    '\\bDNS\\b',
    '\\bD1\\b',
  ].join('|'),
  'i',
)

/** True when a commit/PR subject line is internal engineering process. */
export function isInternalLine(line: string): boolean {
  if (!line.trim()) return true
  if (INTERNAL_PREFIX.test(line)) return true
  if (DOC_PREFIX.test(line)) return INTERNAL_DOC.test(line)
  return INTERNAL_MARKER.test(line)
}

/** Sentinel the summarizer returns when nothing in its input is publishable. */
const NOTHING_PUBLIC = 'NOTHING_PUBLIC'

async function listOwnerRepos(owner: string, token: string): Promise<GhRepo[]> {
  // Try org first, fall back to user account.
  const org = await ghList<GhRepo>(`/orgs/${owner}/repos?type=all&sort=pushed`, token)
  if (org.length) return org
  return ghList<GhRepo>(`/users/${owner}/repos?type=all&sort=pushed`, token)
}

function daysAgo(iso: string | null): number {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / 86400000
}

export async function syncGithub({ payload }: { payload: Payload }): Promise<Summary> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is not set')
  const owners = (process.env.SYNC_OWNERS || DEFAULT_OWNERS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // Per-owner token override: fine-grained PATs are scoped to a single org, so a
  // private repo in one org needs its own token. GITHUB_TOKEN_<OWNER> (uppercased)
  // is used for that owner's repos; everyone else falls back to GITHUB_TOKEN.
  // e.g. GITHUB_TOKEN_SAHANA reads the private sahana/website.
  const tokenFor = (owner: string): string =>
    process.env[`GITHUB_TOKEN_${owner.toUpperCase()}`] || token

  const summary: Summary = {
    owners,
    repos: { seen: 0, created: 0, updated: 0 },
    events: { created: 0, updated: 0, byKind: {} },
    filtered: { commitDays: 0, pulls: 0 },
    errors: [],
  }

  /**
   * Upsert by a unique field. `source` fields are always written (never
   * editorial). `seedIfEmpty` fields are written on create, and on update only
   * when the stored value is empty — so they backfill existing rows but never
   * clobber a value a curator set by hand.
   */
  async function upsert(
    collection: 'repos' | 'activity-events',
    keyField: string,
    keyValue: string,
    source: Record<string, unknown>,
    seedIfEmpty: Record<string, unknown> = {},
    createOverrides: Record<string, unknown> = {},
  ): Promise<'created' | 'updated'> {
    const existing = await payload.find({
      collection,
      where: { [keyField]: { equals: keyValue } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length) {
      const doc = existing.docs[0] as unknown as Record<string, unknown>
      const data: Record<string, unknown> = { ...source }
      for (const [k, v] of Object.entries(seedIfEmpty)) {
        const cur = doc[k]
        if (cur === null || cur === undefined || cur === '') data[k] = v
      }
      await payload.update({
        collection,
        id: existing.docs[0].id,
        // partial update — editorial fields untouched. Cast: collection is a
        // runtime union so TS can't narrow the per-collection data shape.
        data: data as never,
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
      return 'updated'
    }
    await payload.create({
      collection,
      data: { ...source, ...seedIfEmpty, published: false, pinned: false, ...createOverrides } as never,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    return 'created'
  }

  // Only auto-publish (on create) events whose actor is one of PUBLISH_ACTORS —
  // so the public timeline defaults to our own work; everyone else's activity is
  // created unpublished for manual curation. `published` is never touched on
  // update, so any manual publish/unpublish sticks across syncs.
  const publishActors = (process.env.PUBLISH_ACTORS || 'devinbalkind')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  // ---- AI summaries (Gemini) ----------------------------------------------
  // For each new commit-day / PR event we ask Gemini for a 2–3 line plain-text
  // summary from the commit messages / PR body. Written via seedIfEmpty, so it
  // fills once and never clobbers a hand-edited summary. Bounded per run so the
  // request can't run away; a backfill just takes a few runs. No key → skipped.
  const GEMINI_KEY = process.env.GEMINI_API_KEY
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const SUMMARY_MAX = Number(process.env.SUMMARY_MAX_PER_RUN || 30)
  let summaryCalls = 0

  // Free-tier Gemini caps requests-per-minute, so pace the calls and retry on 429
  // (bursts otherwise trip the limit). Tunable via GEMINI_THROTTLE_MS.
  const GEMINI_THROTTLE_MS = Number(process.env.GEMINI_THROTTLE_MS || 5000)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  async function geminiSummary(prompt: string): Promise<string | null> {
    for (let attempt = 0; attempt < 4; attempt++) {
      await sleep(attempt === 0 ? GEMINI_THROTTLE_MS : 30_000) // pace normally; back off hard on a 429 retry
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              // thinkingBudget:0 — trivial summarization task, and the Gemini 2.5/3.x
              // "flash" models are thinking models that otherwise spend the whole
              // output budget on reasoning and return a truncated fragment.
              generationConfig: { temperature: 0.3, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
            }),
            signal: AbortSignal.timeout(30_000),
          },
        )
        if (res.status === 429) continue // rate limited — wait and retry
        if (!res.ok) {
          summary.errors.push(`gemini ${res.status}: ${(await res.text()).slice(0, 120)}`)
          return null
        }
        const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        const text = j?.candidates?.[0]?.content?.parts?.[0]?.text
        return text ? text.trim() : null
      } catch (e) {
        summary.errors.push(`gemini: ${(e as Error).message}`)
        return null
      }
    }
    summary.errors.push('gemini: gave up after repeated 429s')
    return null
  }

  // Returns a summary to seed IFF the event has none yet and we're under budget.
  // `nothingPublic` is only ever set when the summarizer actively judged the
  // input unpublishable — an empty result (no key, over budget, already
  // summarized, API failure) leaves publish behaviour alone, because "we don't
  // know" must not read as "suppress".
  type SummaryResult = { summary?: string; nothingPublic?: boolean }
  async function maybeSummary(externalId: string, kind: 'commit' | 'pr', content: string): Promise<SummaryResult> {
    if (!GEMINI_KEY || !content.trim() || summaryCalls >= SUMMARY_MAX) return {}
    const ex = await payload.find({
      collection: 'activity-events',
      where: { externalId: { equals: externalId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const cur = ex.docs[0] as unknown as { summary?: string } | undefined
    if (cur?.summary) return {} // already summarized or hand-edited — leave it
    const label = kind === 'pr' ? 'pull request' : "day's code commits"
    const prompt =
      `Write a 2-3 line, plain-text summary of this ${label} for a PUBLIC project activity feed ` +
      `read by funders, partners and non-technical people. ` +
      `Describe ONLY externally meaningful changes: features, content, data, public APIs, ` +
      `and public-facing documentation such as API references or developer guides. ` +
      `OMIT internal engineering process entirely — deployment, hosting, servers, containers, ` +
      `CI, certificates, secrets or API keys, environment config, dependency bumps, backups, ` +
      `cron jobs, runbooks, checklists, tests, linting, and refactors with no visible effect. ` +
      `If nothing in the input is publicly meaningful, reply with exactly ${NOTHING_PUBLIC} and nothing else. ` +
      `No preamble, no markdown, no headings, under 55 words.\n\n` +
      content.slice(0, 4000)
    const s = await geminiSummary(prompt)
    if (!s) return {}
    summaryCalls++
    // Tolerate the model wrapping the sentinel in punctuation/quotes.
    if (s.toUpperCase().replace(/[^A-Z_]/g, '').includes(NOTHING_PUBLIC)) return { nothingPublic: true }
    return { summary: s }
  }

  async function recordEvent(
    source: Record<string, unknown>,
    kind: string,
    seedIfEmpty: Record<string, unknown> = {},
    // RAW author logins for this event — the gate must match exact usernames,
    // not the collapsed display string in `actor` ("a, +2" hides authors, and
    // substring matching would let a lookalike username auto-publish).
    logins: string[] = [],
    // True when every commit/PR subject behind this event was internal
    // engineering process. Withholds auto-publish ONLY at create time; an
    // already-published event's `published` is still never touched, so a
    // curator's decision always wins.
    internalOnly = false,
  ) {
    const autoPublish = !internalOnly && logins.some((l) => publishActors.includes(l.toLowerCase()))
    const createOverrides = autoPublish ? { published: true } : {}
    const res = await upsert('activity-events', 'externalId', source.externalId as string, source, seedIfEmpty, createOverrides)
    if (res === 'created') summary.events.created++
    else summary.events.updated++
    summary.events.byKind[kind] = (summary.events.byKind[kind] || 0) + 1
  }

  for (const owner of owners) {
    const ownerToken = tokenFor(owner)
    let repos: GhRepo[]
    try {
      repos = await listOwnerRepos(owner, ownerToken)
    } catch (e) {
      summary.errors.push(`list ${owner}: ${(e as Error).message}`)
      continue
    }

    for (const repo of repos) {
      summary.repos.seen++
      const fullName = repo.full_name
      try {
        const res = await upsert('repos', 'fullName', fullName, {
          fullName,
          description: repo.description || undefined,
          url: repo.html_url,
          lastPushedAt: repo.pushed_at || undefined,
        })
        if (res === 'created') summary.repos.created++
        else summary.repos.updated++

        // Propagate the repo's editorial project onto its events (via seedIfEmpty):
        // sets it on newly-created events and backfills events with no project yet,
        // but never overrides a project a curator assigned by hand. This is what
        // keeps a project's activity feed populated across syncs once its repos are
        // linked.
        const repoDoc = await payload.find({
          collection: 'repos',
          where: { fullName: { equals: fullName } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const rp = repoDoc.docs[0] as unknown as { project?: unknown } | undefined
        const projId =
          rp && rp.project != null ? (typeof rp.project === 'object' ? (rp.project as { id: unknown }).id : rp.project) : null
        const projectSeed = projId != null ? { project: projId } : {}

        // new-repo event (always). No reliable creator via REST → actor left null.
        if (repo.created_at) {
          await recordEvent(
            {
              externalId: `repo:${fullName}`,
              kind: 'repo',
              title: 'New repository created',
              repoFullName: fullName,
              url: repo.html_url,
              occurredAt: repo.created_at,
            },
            'repo',
            { authorship: 'human', ...projectSeed },
          )
        }

        // Skip the expensive calls for long-dormant repos.
        if (daysAgo(repo.pushed_at) > ACTIVE_WINDOW_DAYS) continue

        const [commits, releases, pulls] = await Promise.all([
          ghList<GhCommit>(`/repos/${fullName}/commits`, ownerToken, 1).catch(() => []),
          ghList<GhRelease>(`/repos/${fullName}/releases`, ownerToken, 1).catch(() => []),
          ghList<GhPull>(`/repos/${fullName}/pulls?state=all&sort=updated&direction=desc`, ownerToken, 1).catch(() => []),
        ])

        // commits → one aggregated event per calendar day, with the distinct
        // author logins for that day and an AI flag from the co-author trailer.
        const byDay = new Map<string, { count: number; logins: Set<string>; ai: boolean; messages: string[] }>()
        for (const c of commits) {
          const date = (c.commit.committer?.date || c.commit.author?.date || '').slice(0, 10)
          if (!date) continue
          const e = byDay.get(date) || { count: 0, logins: new Set<string>(), ai: false, messages: [] }
          e.count++
          const login = c.author?.login || c.commit.author?.name
          if (login) e.logins.add(login)
          if (AI_TRAILER.test(c.commit.message || '')) e.ai = true
          // first line of each message, capped, for the AI summary input
          if (c.commit.message && e.messages.length < 20) e.messages.push(c.commit.message.split('\n')[0].slice(0, 160))
          byDay.set(date, e)
        }
        for (const [date, e] of byDay) {
          const logins = [...e.logins].sort()
          const actor = logins.length <= 2 ? logins.join(', ') : `${logins[0]}, +${logins.length - 1}`
          const externalId = `commits:${fullName}:${date}`
          // Summarize only the substantive commits, so a mixed day still yields
          // a summary of the user-visible work. `title` keeps the TRUE commit
          // count — it's a factual statement about the repo and it has to agree
          // with the GitHub commit list the event links to.
          const publicMessages = e.messages.filter((m) => !isInternalLine(m))
          const allInternal = publicMessages.length === 0
          const res = allInternal
            ? { nothingPublic: true } // don't spend a Gemini call to be told nothing is publishable
            : await maybeSummary(externalId, 'commit', `Commits to ${fullName} on ${date}:\n- ${publicMessages.join('\n- ')}`)
          if (allInternal) summary.filtered.commitDays++
          await recordEvent(
            {
              externalId,
              kind: 'commit',
              title: `${e.count} commit${e.count === 1 ? '' : 's'} to ${repo.default_branch}`,
              repoFullName: fullName,
              url: `${repo.html_url}/commits/${repo.default_branch}`,
              occurredAt: `${date}T12:00:00.000Z`,
              actor: actor || undefined,
            },
            'commit',
            { authorship: e.ai ? 'human-ai' : 'human', ...projectSeed, ...(res.summary ? { summary: res.summary } : {}) },
            logins,
            res.nothingPublic === true,
          )
        }

        for (const r of releases.slice(0, 10)) {
          await recordEvent(
            {
              externalId: `release:${fullName}:${r.id}`,
              kind: 'release',
              title: `${r.name || r.tag_name} released`,
              repoFullName: fullName,
              url: r.html_url,
              occurredAt: r.published_at || r.created_at,
              actor: r.author?.login || undefined,
            },
            'release',
            { authorship: 'human', ...projectSeed },
            r.author?.login ? [r.author.login] : [],
          )
        }

        for (const p of pulls.slice(0, 10)) {
          const prExternalId = `pr:${fullName}:${p.number}`
          // A PR has one subject, so an internal title suppresses the whole event
          // (e.g. "Add migration runbook (move to CTFG Cloudflare account)").
          const prInternal = isInternalLine(p.title)
          const res = prInternal
            ? { nothingPublic: true }
            : await maybeSummary(prExternalId, 'pr', `Pull request in ${fullName}: ${p.title}\n\n${p.body || ''}`)
          if (prInternal) summary.filtered.pulls++
          await recordEvent(
            {
              externalId: prExternalId,
              kind: 'pr',
              title: `PR #${p.number}: ${p.title}`,
              repoFullName: fullName,
              url: p.html_url,
              occurredAt: p.created_at,
              actor: p.user?.login || undefined,
            },
            'pr',
            { authorship: 'human', ...projectSeed, ...(res.summary ? { summary: res.summary } : {}) },
            p.user?.login ? [p.user.login] : [],
            res.nothingPublic === true,
          )
        }
      } catch (e) {
        summary.errors.push(`${fullName}: ${(e as Error).message}`)
      }
    }
  }

  return summary
}
