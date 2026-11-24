import type { CollectionAfterChangeHook } from 'payload'
import { CONFIRMATIONS } from '../email/campaignConfirmations'
import { sendResendEmail } from '../lib/resend'

/**
 * Emails the visitor a confirmation after a NEW campaign submission, in the
 * words of src/email/campaignConfirmations.ts for its `campaign`. Wired into
 * `campaign-endorsements` ('endorsement') and `campaign-signups` ('signup').
 *
 * Sends nothing when:
 *  - the campaign has no message of that kind (e.g. UNNYC's campaigns);
 *  - it's a sign-up from a `signupSkipSources` source (the endorsement form's
 *    "send me updates": that visitor gets the endorsement email instead);
 *  - the same address already has an entry for this campaign in this
 *    collection, so a resubmission, or a stranger submitting someone's address
 *    repeatedly, sends one email at most;
 *  - it isn't configured. Off until both are set (it logs a line instead):
 *      RESEND_API_KEY        a Resend API key with send access
 *      CAMPAIGN_EMAIL_FROM   a sender on a domain verified in Resend,
 *                            e.g. "OSPO for NYC <ospo@opensource.nyc>"
 *    and optionally CAMPAIGN_EMAIL_REPLY_TO, where replies go.
 *
 * Never fails the submission: the email goes after the entry is saved, and a
 * send error is logged, not thrown. The honeypot rejects bots before this.
 */
export function sendCampaignConfirmation(kind: 'endorsement' | 'signup'): CollectionAfterChangeHook {
  return async ({ collection, data, doc, operation, req }) => {
    if (operation !== 'create') return doc

    // `doc` has been through field read access, so for an anonymous submission
    // its private fields (email among them) are gone; the submitted `data`
    // still has them. `doc` wins where both do.
    const entry = { ...data, ...doc } as Record<string, any>
    const config = entry.campaign ? CONFIRMATIONS[entry.campaign] : undefined
    const message =
      kind === 'endorsement'
        ? config?.endorsement?.({ wantsUpdates: entry.wantsUpdates === true, isOrganization: entry.kind === 'organization' })
        : config?.signup?.()
    if (!message || !entry.email) return doc
    if (kind === 'signup' && entry.source && config?.signupSkipSources?.includes(entry.source)) return doc

    const label = `${collection.slug} ${doc.id} confirmation`
    const key = process.env.RESEND_API_KEY
    const from = process.env.CAMPAIGN_EMAIL_FROM
    if (!key || !from) {
      req.payload.logger.info(`${label}: not sent, confirmation email not configured.`)
      return doc
    }

    const earlier = await req.payload.count({
      collection: collection.slug as 'campaign-endorsements' | 'campaign-signups',
      where: {
        and: [
          { email: { equals: entry.email } },
          { campaign: { equals: entry.campaign } },
          { id: { not_equals: doc.id } },
        ],
      },
      overrideAccess: true,
      req,
    })
    if (earlier.totalDocs > 0) {
      req.payload.logger.info(`${label}: not sent, this address already has an entry for ${entry.campaign}.`)
      return doc
    }

    sendResendEmail(
      key,
      { from, to: entry.email, replyTo: process.env.CAMPAIGN_EMAIL_REPLY_TO || undefined, ...message },
      req.payload.logger,
      label,
    )
    return doc
  }
}
