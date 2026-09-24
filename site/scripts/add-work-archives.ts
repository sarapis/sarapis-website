import { getPayload } from 'payload'
import config from '@payload-config'

// content-views sections from the live WordPress work-area pages
const SPEC: Record<string, { 'Recent Work': string[]; Perspectives: string[] }> = {
  'open-government': {
    'Recent Work': [
      "WeGovNYC's Databook Featured in Local News",
      'Candidate Comparison Tool for the Daily News and Gotham Gazette',
      'Developing & Deploying Community Board Databases (CBDBs) with BetaNYC',
    ],
    Perspectives: [
      '2020 School of Data Presentation: How to build a database "with not for"',
      "SimCity Showed Us Brilliant Civic Technology Interfaces 30 Years Ago. Let's Build Them.",
      'What is "Municipalism"?',
    ],
  },
  'human-services': {
    'Recent Work': [
      'Deploying ORServices for Mutual Aid NYC',
      'ORServices Update #4 Makes it Easy to Build Your Own Social Services Directory',
      'Announcing a new Human Service Data Standard (HSDS) Validator',
    ],
    Perspectives: [
      'NYC Needs a 2–1–1 System',
      'Building an Ecosystem of Open Referral Solutions',
      'Stone Souping Social Service Information with Airtable',
    ],
  },
  'emergency-management': {
    'Recent Work': [
      'A Web App for Health Center Disaster Status Reporting',
      'Helping People Help: Our COVID-19 Response with MutualAid.NYC',
      'Presenting the "Open Aid Movement" at the Open Source Bridge Conference',
    ],
    Perspectives: [
      "Disaster Preparedness Requires a 211 System. New York City Still Doesn't Have One.",
      'What is "Data Preparedness"?',
      'Solutions for VOADs',
    ],
  },
  'collaborative-economy': {
    'Recent Work': [
      'Introducing the Internet of Ownership Project Council',
      'Open Data for the Collaborative Economy',
      'reRoute Panel: FLO & the New Economy',
    ],
    Perspectives: [
      "How to Run Collaborative Projects That Don't Fall Prey to Bureaucracy",
      'When Platform Co-ops are Seen, What Goes Unseen?',
      'FLOing the Nonprofit Sector',
    ],
  },
}

const key = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
const nodeText = (n: any) => (n.children || []).map((c: any) => c.text || '').join('').trim()
const isHeading = (n: any, re: RegExp) => /heading/.test(n.type) && re.test(nodeText(n))
const isFiller = (n: any) =>
  n.type === 'horizontalrule' ||
  (n.type === 'paragraph' && !(n.children || []).some((c: any) => (c.text || '').trim()))
const trimFiller = (nodes: any[]) => {
  let a = 0,
    b = nodes.length
  while (a < b && isFiller(nodes[a])) a++
  while (b > a && isFiller(nodes[b - 1])) b--
  return nodes.slice(a, b)
}

const heading = (text: string) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'heading',
        tag: 'h2',
        version: 1,
        format: '',
        indent: 0,
        direction: 'ltr',
        children: [
          { type: 'text', text, version: 1, format: 0, style: '', mode: 'normal', detail: 0 },
        ],
      },
    ],
  },
})

const payload = await getPayload({ config })

const allPosts = await payload.find({ collection: 'posts', limit: 1000, depth: 0 })
const byKey = new Map<string, any>()
for (const p of allPosts.docs as any[]) byKey.set(key(p.title), p.id)

const missing: string[] = []
const archive = (label: string, titles: string[]) => ({
  blockType: 'archive',
  blockName: label,
  populateBy: 'selection',
  introContent: heading(label),
  selectedDocs: titles
    .map((t) => {
      const id = byKey.get(key(t))
      if (!id) missing.push(t)
      return id ? { relationTo: 'posts', value: id } : null
    })
    .filter(Boolean),
})

for (const [slug, sections] of Object.entries(SPEC)) {
  const res = await payload.find({ collection: 'pages', where: { slug: { equals: slug } }, depth: 0, limit: 1 })
  const page: any = res.docs[0]
  if (!page) {
    console.warn(`page not found: ${slug}`)
    continue
  }
  const layout: any[] = page.layout || []
  // Find the content block whose richText contains the "Recent Work" heading.
  let cbIdx = -1
  let colIdx = -1
  for (let i = 0; i < layout.length; i++) {
    const b = layout[i]
    if (b.blockType !== 'content') continue
    const ci = (b.columns || []).findIndex((c: any) =>
      (c.richText?.root?.children || []).some((n: any) => isHeading(n, /^recent work$/i)),
    )
    if (ci >= 0) {
      cbIdx = i
      colIdx = ci
      break
    }
  }
  if (cbIdx < 0) {
    console.warn(`${slug}: no content block with a "Recent Work" heading — already split? skipping`)
    continue
  }

  const cb = layout[cbIdx]
  const col = cb.columns[colIdx]
  const kids: any[] = col.richText.root.children
  const rwIdx = kids.findIndex((n) => isHeading(n, /^recent work$/i))
  const pIdx = kids.findIndex((n) => isHeading(n, /^perspectives$/i))
  const intro = trimFiller(kids.slice(0, rwIdx))
  const mid = pIdx > rwIdx ? trimFiller(kids.slice(rwIdx + 1, pIdx)) : []
  const tail = trimFiller(kids.slice((pIdx > rwIdx ? pIdx : rwIdx) + 1))

  const contentFrom = (children: any[]) => ({
    blockType: 'content',
    columns: [{ size: col.size || 'full', richText: { root: { ...col.richText.root, children } } }],
  })

  const rebuilt: any[] = []
  if (intro.length) rebuilt.push(contentFrom(intro))
  rebuilt.push(archive('Recent Work', sections['Recent Work']))
  if (mid.length) rebuilt.push(contentFrom(mid))
  rebuilt.push(archive('Perspectives', sections['Perspectives']))
  if (tail.length) rebuilt.push(contentFrom(tail))

  // New layout: everything except the original content block and any prior archive blocks,
  // with the rebuilt sequence spliced in where the content block was.
  const newLayout: any[] = []
  for (let i = 0; i < layout.length; i++) {
    if (i === cbIdx) {
      newLayout.push(...rebuilt)
    } else if (layout[i].blockType === 'archive') {
      continue // drop archives from a previous run
    } else {
      newLayout.push(layout[i])
    }
  }

  await payload.update({
    collection: 'pages',
    id: page.id,
    data: { layout: newLayout, _status: 'published' } as any,
    context: { disableRevalidate: true },
  })
  console.log(`${slug}: intro(${intro.length}) + Recent Work + mid(${mid.length}) + Perspectives + tail(${tail.length})`)
}

console.log(missing.length ? `\nUNMATCHED: ${missing.join(' | ')}` : '\nall titles matched ✓')
