import { SectionHeading } from '@sarapis/design-system'

export const WithAside = () => (
  <SectionHeading as="h2" title="Our work" aside="Four focus areas" />
)

export const Plain = () => <SectionHeading as="h2" title="Recent writing" />

export const Large = () => (
  <SectionHeading as="h1" title="Technology should belong to the people it serves." />
)
