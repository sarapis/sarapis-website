import { Card } from '@sarapis/design-system'

const IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#2b2622"/><circle cx="160" cy="100" r="54" fill="none" stroke="#e0a23a" stroke-width="3"/><path d="M160 52 L176 100 L160 148 L144 100 Z" fill="#d8542f"/><path d="M112 100 L160 84 L208 100 L160 116 Z" fill="#e8b23a"/></svg>`,
  )

export const WithImage = () => (
  <Card
    href="#"
    imageUrl={IMG}
    imageAlt="Project thumbnail"
    categories={['Open Government', 'Work']}
    title="WeGovNYC's Databook featured in local news"
    description="A searchable directory of every NYC capital project, built on open data."
  />
)

export const Placeholder = () => (
  <Card
    href="#"
    categories={['Human Services']}
    title="Deploying ORServices for Mutual Aid NYC"
    description="An open-referral directory connecting New Yorkers to community resources."
  />
)
