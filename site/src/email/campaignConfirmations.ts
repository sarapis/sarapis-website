/**
 * The confirmation emails a campaign site's visitors get after submitting a
 * form (sendCampaignConfirmation). One entry per campaign key; a campaign
 * with no entry, or with no `endorsement` / `signup` message, sends nothing.
 *
 * ⚠ These words go to whoever was typed into a public form, so they are FIXED
 * TEXT. Never put a submitted value (name, organization, message) in them: a
 * form that echoes what it's given lets anyone send their own text, in our
 * name, to any address. Values the visitor only chose (a checkbox) are fine.
 *
 * Plain text. Edit freely; keep the "didn't do this" line, which is how
 * someone signed up by somebody else gets out.
 */

export type ConfirmationMessage = { subject: string; text: string }

export type CampaignConfirmations = {
  /** For a new `campaign-endorsements` entry. `wantsUpdates` is the visitor's checkbox. */
  endorsement?: (entry: { wantsUpdates: boolean; isOrganization: boolean }) => ConfirmationMessage
  /** For a new `campaign-signups` entry. */
  signup?: () => ConfirmationMessage
  /**
   * Sign-up `source`s that get no sign-up email, because the visitor already
   * gets another one: the endorsement form also signs up those who tick
   * "send me updates", and its own confirmation says so.
   */
  signupSkipSources?: string[]
}

const OSPO_URL = 'https://ospo.opensource.nyc'

export const CONFIRMATIONS: Record<string, CampaignConfirmations> = {
  // ospo.opensource.nyc, the campaign for an NYC Open Source Program Office.
  'nyc-ospo': {
    endorsement: ({ wantsUpdates, isOrganization }) => ({
      subject: 'Thank you for endorsing an Open Source Program Office for NYC',
      text: [
        'Thank you for endorsing the proposal to establish an Open Source Program Office for New York City.',
        '',
        `We check each endorsement before it appears on ${OSPO_URL}/endorse. If you chose to be listed, ${
          isOrganization ? 'your organization' : 'your name'
        } will show there once we have.`,
        '',
        wantsUpdates
          ? "You also asked for updates, so we'll write occasionally with news about the campaign and ways to help."
          : null,
        wantsUpdates ? '' : null,
        `Every endorsement adds weight. If you can, share the page with others who care about public technology: ${OSPO_URL}/endorse`,
        '',
        "If you didn't endorse the proposal, reply to this email and we'll remove it.",
        '',
        'Sarapis',
        OSPO_URL,
      ]
        .filter((l) => l !== null)
        .join('\n'),
    }),
    signup: () => ({
      subject: "You're signed up for updates on an NYC Open Source Program Office",
      text: [
        'Thank you for joining the campaign for a New York City Open Source Program Office.',
        '',
        "We'll write occasionally with news about the campaign and ways to help. We'll use your address for nothing else.",
        '',
        `If you'd like to do more, you can endorse the proposal: ${OSPO_URL}/endorse`,
        '',
        "If you didn't sign up, or want to stop hearing from us, reply to this email and we'll remove your address.",
        '',
        'Sarapis',
        OSPO_URL,
      ].join('\n'),
    }),
    signupSkipSources: ['/endorse'],
  },
}
