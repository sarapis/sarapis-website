import type { CollectionAfterChangeHook } from 'payload'

import { addToList, campaignConfig, sendCampaignEmail } from '../lib/campaignEmail'

/**
 * The campaign list and automatic emails (see src/lib/campaignEmail.ts for who
 * gets what, and the settings). Both hooks return at once and do their Resend
 * work in the background: a slow or failing Resend never delays or fails the
 * form. `doc` has been through field read access, so on an anonymous create
 * the private fields (email, contactName, …) are missing from it; the
 * submitted `data` still has them.
 */

/** campaign-signups: onto the list; a welcome for a first homepage sign-up. */
export const campaignSignupEmails: CollectionAfterChangeHook = ({ data, doc, operation, req }) => {
  if (operation !== 'create') return doc
  const entry = { ...data, ...doc }
  const cfg = campaignConfig(entry.campaign)
  const email = typeof entry.email === 'string' ? entry.email.trim() : ''
  if (!cfg || !email) {
    if (entry.campaign) req.payload.logger.info(`Campaign signup ${doc.id} (${entry.campaign}): campaign email not configured.`)
    return doc
  }
  const { payload } = req

  void (async () => {
    await addToList(payload, cfg, email)
    // The endorse form's own thank-you already covers the welcome.
    if (typeof entry.source === 'string' && entry.source.startsWith('/endorse')) return
    const earlier = await payload
      .count({
        collection: 'campaign-signups',
        where: { and: [{ email: { equals: email } }, { campaign: { equals: cfg.campaign } }, { id: { not_equals: doc.id } }] },
        overrideAccess: true,
      })
      .then((r) => r.totalDocs)
      .catch(() => 0)
    if (earlier > 0) return
    await sendCampaignEmail(payload, cfg, email, cfg.messages.welcome(), `signup-${doc.id}-welcome`)
  })()

  return doc
}

/**
 * campaign-endorsements: a thank-you when one arrives, and a note when it is
 * published (the `published` box going from unticked to ticked in the admin).
 */
export const campaignEndorsementEmails: CollectionAfterChangeHook = ({ data, doc, previousDoc, operation, req }) => {
  const entry = { ...data, ...doc }
  const justPublished = operation === 'update' && doc.published === true && previousDoc?.published !== true
  if (operation !== 'create' && !justPublished) return doc
  const cfg = campaignConfig(entry.campaign)
  if (!cfg) return doc
  const { payload } = req

  void (async () => {
    // An admin update can read every field; fall back to a full read if not.
    let full = entry
    if (!full.email && doc.id) {
      full = await payload
        .findByID({ collection: 'campaign-endorsements', id: doc.id, overrideAccess: true })
        .then((d) => ({ ...d, ...entry, email: d.email }))
        .catch(() => entry)
    }
    const email = typeof full.email === 'string' ? full.email.trim() : ''
    if (!email) return
    if (operation === 'create') {
      await sendCampaignEmail(payload, cfg, email, cfg.messages.endorsementThanks(full), `endorsement-${doc.id}-thanks`)
    } else {
      await sendCampaignEmail(payload, cfg, email, cfg.messages.endorsementLive(full), `endorsement-${doc.id}-live`)
    }
  })()

  return doc
}
