import { FocusCard } from '@sarapis/design-system'

export const Single = () => (
  <FocusCard
    href="#"
    title="Open Government"
    blurb="Transparency tools and open data that make public institutions accountable."
  />
)

export const Grid = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
    <FocusCard
      href="#"
      title="Human Services"
      blurb="Open Referral data standards and directories that connect people to help."
    />
    <FocusCard
      href="#"
      title="Emergency Management"
      blurb="Disaster-preparedness and mutual-aid systems communities can run themselves."
    />
  </div>
)
