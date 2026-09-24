import { CatalogIndex } from '@sarapis/design-system'

export const FocusAreas = () => (
  <CatalogIndex
    label="Focus Areas"
    meta="Four areas"
    entries={[
      {
        title: 'Open Government',
        blurb: 'Transparency tools and open data that make public institutions accountable.',
        href: '#',
      },
      {
        title: 'Human Services',
        blurb: 'Open Referral data standards and directories that connect people to help.',
        href: '#',
      },
      {
        title: 'Emergency Management',
        blurb: 'Disaster-preparedness and mutual-aid systems communities can run themselves.',
        href: '#',
      },
      {
        title: 'Collaborative Economy',
        blurb: 'Platform cooperatives and shared digital infrastructure owned in common.',
        href: '#',
      },
    ]}
  />
)

export const Archive = () => (
  <CatalogIndex
    label="Recent writing"
    meta="2021–2024"
    entries={[
      { title: "WeGovNYC's Databook Featured in Local News", href: '#' },
      { title: 'A Web App for Health Center Disaster Status Reporting', href: '#' },
      { title: 'Deploying ORServices for Mutual Aid NYC', href: '#' },
    ]}
  />
)
