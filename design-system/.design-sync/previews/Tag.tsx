import { Tag } from '@sarapis/design-system'

export const Single = () => <Tag>Open Government</Tag>

export const Several = () => (
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
    <Tag>Human Services</Tag>
    <Tag>Emergency Management</Tag>
    <Tag>Collaborative Economy</Tag>
  </div>
)
