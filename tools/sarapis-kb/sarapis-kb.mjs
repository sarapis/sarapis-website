#!/usr/bin/env node
/**
 * sarapis-kb — quick-capture Knowledge Items into the Sarapis site.
 *
 *   sarapis-kb add <url>            # creates a "link" knowledge item
 *   sarapis-kb add ./notes.md       # uploads the file, creates an "artifact" item
 *   sarapis-kb list [--limit 20]    # show recent items
 *
 * Talks to the site's Payload REST API (no server component needed). Items are
 * created UNPUBLISHED by default — curate what's public in /admin (or pass
 * --published). Auth + URL come from flags, then env, then ~/.sarapis-kb.json:
 *
 *   { "url": "https://next.sarapis.org", "email": "you@example.org", "password": "…" }
 *
 * Env equivalents: SARAPIS_URL, SARAPIS_EMAIL, SARAPIS_PASSWORD.
 */
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_URL = 'https://next.sarapis.org'

// ---- tiny arg parser: positionals + --key value + --flag ----
function parseArgs(argv) {
  const out = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) out.flags[key] = true
      else {
        out.flags[key] = next
        i++
      }
    } else out._.push(a)
  }
  return out
}

function loadConfig(flags) {
  let file = {}
  const path = join(homedir(), '.sarapis-kb.json')
  if (existsSync(path)) {
    try {
      file = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      /* ignore malformed config */
    }
  }
  return {
    url: (flags.url || process.env.SARAPIS_URL || file.url || DEFAULT_URL).replace(/\/$/, ''),
    email: flags.email || process.env.SARAPIS_EMAIL || file.email,
    password: flags.password || process.env.SARAPIS_PASSWORD || file.password,
  }
}

function die(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

async function login({ url, email, password }) {
  if (!email || !password) die('missing credentials — set email/password via flags, env, or ~/.sarapis-kb.json')
  const res = await fetch(`${url}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) die(`login failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const { token } = await res.json()
  if (!token) die('login returned no token')
  return token
}

async function resolveProject(url, token, project) {
  if (!project) return undefined
  if (/^\d+$/.test(project)) return Number(project)
  const q = new URLSearchParams({ 'where[name][equals]': project, limit: '1', depth: '0' })
  const res = await fetch(`${url}/api/projects?${q}`, { headers: { Authorization: `JWT ${token}` } })
  if (!res.ok) die(`project lookup failed (${res.status})`)
  const { docs } = await res.json()
  if (!docs?.length) die(`no project named "${project}" (use the exact name, or a numeric id)`)
  return docs[0].id
}

function inferFileType(path) {
  const ext = extname(path).toLowerCase()
  if (ext === '.md' || ext === '.markdown') return 'md'
  if (ext === '.html' || ext === '.htm') return 'html'
  return 'doc'
}

async function createKnowledgeItem(url, token, data) {
  const res = await fetch(`${url}/api/knowledge-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) die(`create failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  return (await res.json()).doc
}

async function uploadMedia(url, token, path, alt) {
  const buf = await readFile(path)
  const fd = new FormData()
  fd.append('file', new Blob([buf]), basename(path))
  if (alt) fd.append('alt', alt)
  const res = await fetch(`${url}/api/media`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}` }, // no Content-Type — fetch sets the multipart boundary
    body: fd,
  })
  if (!res.ok) die(`media upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  return (await res.json()).doc
}

async function cmdAdd(cfg, args) {
  const target = args._[1]
  if (!target) die('usage: sarapis-kb add <url|file> [--title … --summary … --project … --published]')
  const f = args.flags
  const isUrl = f.kind === 'link' || (f.kind !== 'artifact' && /^https?:\/\//i.test(target))

  const token = await login(cfg)
  const project = await resolveProject(cfg.url, token, f.project)
  const base = {
    summary: f.summary || undefined,
    date: f.date || undefined, // else collection defaults to now
    project,
    published: !!f.published,
    pinned: !!f.pinned,
  }

  let doc
  if (isUrl) {
    doc = await createKnowledgeItem(cfg.url, token, {
      title: f.title || target,
      kind: 'link',
      url: target,
      ...base,
    })
  } else {
    if (!existsSync(target)) die(`file not found: ${target}`)
    const title = f.title || basename(target, extname(target))
    const media = await uploadMedia(cfg.url, token, target, title)
    doc = await createKnowledgeItem(cfg.url, token, {
      title,
      kind: 'artifact',
      artifact: media.id,
      fileType: f['file-type'] || inferFileType(target),
      ...base,
    })
  }

  console.log(`✓ ${doc.kind} "${doc.title}" created (id ${doc.id})${doc.published ? '' : ' — unpublished'}`)
  console.log(`  ${cfg.url}/admin/collections/knowledge-items/${doc.id}`)
}

async function cmdList(cfg, args) {
  const token = await login(cfg)
  const limit = args.flags.limit || 20
  const q = new URLSearchParams({ limit: String(limit), sort: '-createdAt', depth: '0' })
  const res = await fetch(`${cfg.url}/api/knowledge-items?${q}`, { headers: { Authorization: `JWT ${token}` } })
  if (!res.ok) die(`list failed (${res.status})`)
  const { docs, totalDocs } = await res.json()
  console.log(`${docs.length} of ${totalDocs} knowledge items:`)
  for (const d of docs) {
    const flag = d.published ? '●' : '○'
    console.log(`  ${flag} [${d.kind}] ${d.title}  (id ${d.id})`)
  }
}

const HELP = `sarapis-kb — quick-capture Knowledge Items into the Sarapis site

Usage:
  sarapis-kb add <url>                 create a link item
  sarapis-kb add <file>                upload a file, create an artifact item
  sarapis-kb list [--limit N]          show recent items

Options for "add":
  --title <t>        item title (default: the URL, or the filename)
  --summary <s>      short description
  --date <iso>       date (default: now)
  --project <name>   link to a project (exact name, or numeric id)
  --file-type <t>    md | html | doc  (artifacts; inferred from extension)
  --kind <k>         force link | artifact  (default: auto-detect)
  --published        publish immediately (default: unpublished)
  --pinned           pin in the feed

Config (flags > env > ~/.sarapis-kb.json):
  --url / SARAPIS_URL         (default ${DEFAULT_URL})
  --email / SARAPIS_EMAIL
  --password / SARAPIS_PASSWORD`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cmd = args._[0]
  if (!cmd || cmd === 'help' || args.flags.help) {
    console.log(HELP)
    return
  }
  const cfg = loadConfig(args.flags)
  if (cmd === 'add') return cmdAdd(cfg, args)
  if (cmd === 'list') return cmdList(cfg, args)
  die(`unknown command "${cmd}" — try: add, list, help`)
}

main().catch((e) => die(e?.message || String(e)))
