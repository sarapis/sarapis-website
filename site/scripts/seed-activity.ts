import { getPayload } from 'payload'
import config from '@payload-config'
const payload = await getPayload({ config })

const proj = await payload.create({ collection: 'projects', data: {
  name: "WeGovNYC Databook", status: 'active', focusArea: 'open-government',
  summary: 'A searchable directory of every NYC capital project, built on open data.',
  workspaceTags: ['Databook2'], published: true, pinned: true } as any })

await payload.create({ collection: 'repos', data: {
  fullName: 'wegovnyc/databook_interface', description: 'Databook front-end', url: 'https://github.com/wegovnyc/databook_interface',
  language: 'TypeScript', stars: 4, commits30d: 37, lastPushedAt: new Date('2026-06-20').toISOString(),
  project: proj.id, focusArea: 'open-government', published: true } as any })

await payload.create({ collection: 'activity-events', data: {
  title: 'Added council discretionary data to Databook', kind: 'commit', repoFullName: 'wegovnyc/databook_interface',
  url: 'https://github.com/wegovnyc/databook_interface', occurredAt: new Date('2026-06-20').toISOString(),
  additions: 412, deletions: 88, authorship: 'human-ai', externalId: 'seed-evt-1', project: proj.id, published: true } as any })

await payload.create({ collection: 'knowledge-items', data: {
  title: 'Databook service map', kind: 'link', url: 'https://example.org/databook-service-map',
  summary: 'Architecture + deploy topology for the Databook stack.', date: new Date('2026-06-12').toISOString(),
  project: proj.id, published: true } as any })

await payload.create({ collection: 'tasks', data: {
  title: 'Consolidate Databook infrastructure onto Hetzner CPX41', status: 'Done', list: 'active', scope: 'Sarapis',
  body: 'Migrate all Databook services to a single Hetzner CPX41 (Ashburn).', source: 'LLM', createdBy: 'Claude',
  project: proj.id, publishToActivity: true } as any })

const counts = {}
for (const c of ['projects','repos','activity-events','knowledge-items','tasks'] as const) {
  counts[c] = (await payload.count({ collection: c })).totalDocs
}
console.log('SEED_OK ' + JSON.stringify(counts))
