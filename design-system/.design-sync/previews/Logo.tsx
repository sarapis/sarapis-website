import { Logo } from '@sarapis/design-system'

export const Full = () => <Logo />

export const MarkOnly = () => <Logo showWordmark={false} />

export const InHeader = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderBottom: '1px solid var(--sds-border)',
    }}
  >
    <Logo />
    <span style={{ fontSize: 14, color: 'var(--sds-muted-foreground)' }}>
      Work · Services · Blog · About
    </span>
  </div>
)
