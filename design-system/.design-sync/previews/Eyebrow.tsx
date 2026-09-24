import { Eyebrow, SectionHeading } from '@sarapis/design-system'

export const Default = () => <Eyebrow>Free, libre &amp; open source · 501(c)(3) nonprofit</Eyebrow>

export const AboveHeading = () => (
  <div>
    <Eyebrow>Our work</Eyebrow>
    <SectionHeading as="h2" title="Open technology for the public good" />
  </div>
)
