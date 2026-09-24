import { Callout, Button } from '@sarapis/design-system'

export const Default = () => (
  <Callout
    title="Building something for the public good?"
    text="We partner with mission-driven organizations to design, build, and maintain open solutions."
    action={
      <Button href="#" variant="outline" size="lg" style={{ background: 'var(--sds-background)' }}>
        Work with Sarapis
      </Button>
    }
  />
)

export const TitleOnly = () => (
  <Callout title="Technology should belong to the people it serves." />
)
