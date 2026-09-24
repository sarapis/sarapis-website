import { Button } from '@sarapis/design-system'

export const Variants = () => (
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
    <Button variant="primary">Let&rsquo;s talk</Button>
    <Button variant="outline">Read our story</Button>
    <Button variant="ghost">Learn more</Button>
  </div>
)

export const Sizes = () => (
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>
)

export const AsLink = () => (
  <Button href="#" variant="primary" size="lg">
    Donate
  </Button>
)

export const Disabled = () => (
  <Button variant="primary" disabled>
    Unavailable
  </Button>
)
