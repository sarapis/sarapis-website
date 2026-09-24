#!/usr/bin/env node
// sarapis-kb — add Knowledge Items to the Sarapis site from the terminal.
//
// A knowledge item is either an external LINK or an uploaded ARTIFACT (.md/.html
// rendered on-site at /knowledge/<id>). This is a zero-dependency Node script
// (Node 18+ built-ins only) that talks to the Payload REST API — so it runs
// against local dev OR staging/prod via --host, and never imports Payload (no
// `push:true` race with a running dev server).
//
// Usage:
//   node scripts/sarapis-kb.mjs add <url | file.md | file.html> [options]
//   node scripts/sarapis-kb.mjs list [--limit 10]
//   node scripts/sarapis-kb.mjs help
//
// Options for `add`:
//   --project <name|id>   link to a project (name is resolved to its id)
//   --title <text>        item title (default: page <title> for links, filename for files)
//   --summary <text>      one-line summary shown in the feed
//   --date <iso>          override the date (default: now)
//   --file-type <md|html|doc>  artifact type (default: inferred from extension)
//   --publish             mark published (else it's a draft — invisible on the public site)
//   --pin                 pin it
//   --host <url>          API host (default: $SARAPIS_KB_HOST or http://localhost:3009)
//   --email / --password  admin creds (default: env, or local dev creds for localhost)
//
// Auth resolves in order: --email/--password → $SARAPIS_KB_EMAIL/$SARAPIS_KB_PASSWORD.
// There is deliberately no built-in default login.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, extname } from 'node:path'

// ---- tiny arg parser (no deps) ----------------------------------------------
function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1)
      } else {
        const key = a.slice(2)
        const next = argv[i + 1]
        if (next === undefined || next.startsWith('--')) flags[key] = true
        else { flags[key] = next; i++ }
      }
    } else positional.push(a)
  }
  return { positional, flags }
}

const isUrl = (s) => /^https?:\/\//i.test(s)
const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1) }

function inferFileType(file) {
  const ext = extname(file).toLowerCase()
  if (ext === '.md' || ext === '.markdown') return 'md'
  if (ext === '.html' || ext === '.htm') return 'html'
  return 'doc'
}
const MIME = { md: 'text/markdown', html: 'text/html', doc: 'application/octet-stream' }
const titleFromFile = (file) =>
  basename(file, extname(file)).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

async function api(host, path, { method = 'GET', token, json, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `JWT ${token}`
  let body
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json) }
  else if (form !== undefined) body = form
  const res = await fetch(`${host}${path}`, { method, headers, body })
  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!res.ok) {
    const detail = data?.errors?.[0]?.message || data?.message || data?.raw || res.statusText
    throw new Error(`${method} ${path} → ${res.status}: ${detail}`)
  }
  return data
}

async function login(host, email, password) {
  const data = await api(host, '/api/users/login', { method: 'POST', json: { email, password } })
  if (!data.token) throw new Error('login succeeded but no token returned')
  return data.token
}

async function resolveProject(host, token, ref) {
  if (/^\d+$/.test(String(ref))) return Number(ref)
  const q = encodeURIComponent(String(ref))
  const data = await api(host, `/api/projects?where[name][equals]=${q}&limit=1&depth=0`, { token })
  const doc = data?.docs?.[0]
  if (!doc) throw new Error(`no project named "${ref}" (use its id, or check the name)`)
  return doc.id
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED_ENTITIES[n] ?? m)
}
async function fetchPageTitle(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), redirect: 'follow' })
    const html = await res.text()
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (!m) return null
    let t = decodeEntities(m[1]).trim().replace(/\s+/g, ' ')
    // Prefer the first segment of "Title – Site" / "Title | Site" style titles, then cap length.
    const seg = t.split(/\s+[|–—·]\s+/)[0]
    if (seg.length >= 12) t = seg
    return t.length > 100 ? t.slice(0, 99).trimEnd() + '…' : t
  } catch { return null }
}

async function uploadArtifact(host, token, file, alt) {
  const buf = await readFile(file)
  const ftype = inferFileType(file)
  const form = new FormData()
  form.append('alt', alt)
  form.append('file', new Blob([buf], { type: MIME[ftype] }), basename(file))
  const data = await api(host, '/api/media', { method: 'POST', token, form })
  const id = data?.doc?.id ?? data?.id
  if (!id) throw new Error('media upload returned no id')
  return id
}

// ---- commands ----------------------------------------------------------------
async function cmdAdd(target, flags) {
  if (!target) die('add: give a URL or a file path. See `sarapis-kb help`.')
  const host = (flags.host || process.env.SARAPIS_KB_HOST || 'http://localhost:3009').replace(/\/$/, '')
  const email = flags.email || process.env.SARAPIS_KB_EMAIL || null
  const password = flags.password || process.env.SARAPIS_KB_PASSWORD || null
  if (!email || !password) die(`no credentials for ${host} — pass --email/--password or set SARAPIS_KB_EMAIL/PASSWORD.`)

  const link = isUrl(target)
  if (!link && !existsSync(target)) die(`file not found: ${target}`)

  const token = await login(host, email, password)

  const data = {
    kind: link ? 'link' : 'artifact',
    summary: flags.summary || undefined,
    date: flags.date || new Date().toISOString(),
    published: !!flags.publish,
    pinned: !!flags.pin,
  }
  if (flags.project) data.project = await resolveProject(host, token, flags.project)

  if (link) {
    data.url = target
    data.title = flags.title || (await fetchPageTitle(target)) || new URL(target).hostname
  } else {
    const ftype = flags['file-type'] || inferFileType(target)
    data.title = flags.title || titleFromFile(target)
    data.fileType = ftype
    process.stdout.write(`  uploading ${basename(target)} … `)
    data.artifact = await uploadArtifact(host, token, target, data.title)
    console.log('done')
  }

  const res = await api(host, '/api/knowledge-items', { method: 'POST', token, json: data })
  const doc = res?.doc ?? res
  console.log(`✓ knowledge item #${doc.id} — ${data.kind.toUpperCase()}: ${data.title}`)
  console.log(`  admin:  ${host}/admin/collections/knowledge-items/${doc.id}`)
  if (link) console.log(`  link:   ${data.url}`)
  else console.log(`  public: ${host}/knowledge/${doc.id}${data.published ? '' : '  (draft — not public until published)'}`)
  if (!data.published) console.log('  note:   created as a DRAFT. Re-run with --publish, or toggle Published in the admin.')
}

async function cmdList(flags) {
  const host = (flags.host || process.env.SARAPIS_KB_HOST || 'http://localhost:3009').replace(/\/$/, '')
  const limit = Number(flags.limit || 10)
  const email = flags.email || process.env.SARAPIS_KB_EMAIL || null
  const password = flags.password || process.env.SARAPIS_KB_PASSWORD || null
  const token = email && password ? await login(host, email, password) : undefined // read is public for published
  const data = await api(host, `/api/knowledge-items?limit=${limit}&sort=-date&depth=0`, { token })
  console.log(`${data.totalDocs} knowledge items (showing ${data.docs.length}):`)
  for (const k of data.docs) {
    const flag = `${k.published ? 'P' : '·'}${k.pinned ? '★' : ' '}`
    const when = k.date ? new Date(k.date).toISOString().slice(0, 10) : '—'
    console.log(`  ${flag} #${k.id}  ${when}  [${(k.kind || '').toUpperCase()}]  ${k.title}`)
  }
}

function help() {
  console.log(`sarapis-kb — add Knowledge Items to the Sarapis site.

  add <url | file.md | file.html> [--project <name|id>] [--title T] [--summary S]
                                  [--date ISO] [--file-type md|html|doc]
                                  [--publish] [--pin] [--host URL]
  list [--limit N] [--host URL]
  help

Examples:
  # external link, attached to a project, published:
  node scripts/sarapis-kb.mjs add https://example.com/writeup --project Databook --publish

  # on-site .md artifact (draft):
  node scripts/sarapis-kb.mjs add ./notes/ai-classifier.md --project Databook --summary "Prompt & assumptions"

  # against staging:
  node scripts/sarapis-kb.mjs add https://... --host https://next.sarapis.org \\
    --email you@sarapis.org --password "\$PW" --publish

Auth defaults to local dev creds on localhost; set SARAPIS_KB_EMAIL / SARAPIS_KB_PASSWORD
(and optionally SARAPIS_KB_HOST) for other hosts.`)
}

// ---- main --------------------------------------------------------------------
const { positional, flags } = parseArgs(process.argv.slice(2))
const cmd = positional[0]
try {
  if (cmd === 'add') await cmdAdd(positional[1], flags)
  else if (cmd === 'list') await cmdList(flags)
  else if (cmd === 'help' || !cmd) help()
  else die(`unknown command "${cmd}". See \`sarapis-kb help\`.`)
} catch (e) {
  die(e.message)
}
