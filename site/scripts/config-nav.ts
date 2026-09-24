import { getPayload } from 'payload'
import config from '@payload-config'
const payload = await getPayload({ config })

async function pageId(slug: string) {
  const r = await payload.find({ collection: 'pages', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  if (!r.docs.length) { console.warn('  no page for slug', slug); return null }
  return (r.docs[0] as any).id
}
function refItem(label: string, id: number) {
  return { link: { type: 'reference', label, reference: { relationTo: 'pages', value: id }, url: null, newTab: false } }
}
function customItem(label: string, url: string) {
  return { link: { type: 'custom', label, url, reference: null, newTab: false } }
}

// Header: 6 primary items (Work mega-menu deferred to redesign)
const headerSpec: [string, string][] = [
  ['Services', 'services'],
  ['Blog', 'blog'],
  ['About', 'about'],
  ['Let’s Talk', 'contact'],
  ['Donate', 'donate'],
]
const headerItems: any[] = []
for (const [label, slug] of headerSpec) { const id = await pageId(slug); if (id) headerItems.push(refItem(label, id)) }
await payload.updateGlobal({ slug: 'header', data: { navItems: headerItems } as any, context: { disableRevalidate: true } })
console.log('header navItems:', headerItems.length)

// Footer: key links + contact
// Mirror the header's top-level links (the "Work" group is rendered separately in the footer).
const footerSpec: [string, string][] = [
  ['Services', 'services'], ['Blog', 'blog'], ['About', 'about'],
  ['Let’s Talk', 'contact'], ['Donate', 'donate'],
]
const footerItems: any[] = []
for (const [label, slug] of footerSpec) { const id = await pageId(slug); if (id) footerItems.push(refItem(label, id)) }
await payload.updateGlobal({ slug: 'footer', data: { navItems: footerItems } as any, context: { disableRevalidate: true } })
console.log('footer navItems:', footerItems.length)
console.log('DONE')
