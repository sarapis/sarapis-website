import type { CollectionAfterChangeHook } from 'payload'

/**
 * Emails a note for each NEW campaign endorsement, so whoever approves them
 * knows one is waiting (nothing else tells them). Sent through Resend's HTTP
 * API with fetch: the CMS has no email adapter, and this needs no package.
 *
 * Off until all three are set (it logs a line instead):
 *   RESEND_API_KEY              a Resend API key with send access
 *   ENDORSEMENT_NOTIFY_FROM     a sender on a domain verified in Resend,
 *                               e.g. "Sarapis CMS <cms@sarapis.org>"
 *   ENDORSEMENT_NOTIFY_TO       one address, or several comma-separated
 *
 * Never fails the submission: the email is sent after the entry is saved, and
 * a send error is logged, not thrown.
 */
export const notifyNewEndorsement: CollectionAfterChangeHook = ({ data, doc, operation, req }) => {
  if (operation !== 'create') return doc

  const key = process.env.RESEND_API_KEY
  const from = process.env.ENDORSEMENT_NOTIFY_FROM
  const to = process.env.ENDORSEMENT_NOTIFY_TO?.split(',').map((s) => s.trim()).filter(Boolean)
  if (!key || !from || !to?.length) {
    req.payload.logger.info(`New campaign endorsement ${doc.id}; notification email not configured.`)
    return doc
  }

  // `doc` has been through field read access, so for an anonymous submission
  // the private fields (email, contactName, logoUrl, …) are already gone from
  // it. The submitted `data` still has them; `doc` wins where both do.
  const email = endorsementEmail({ ...data, ...doc })
  void fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: email.subject, text: email.text }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
    })
    .catch((err) => req.payload.logger.error(`Endorsement ${doc.id}: notification email failed: ${err}`))

  return doc
}

/** The subject and plain-text body, from the saved entry. Exported for tests. */
export function endorsementEmail(doc: Record<string, any>): { subject: string; text: string } {
  const isOrg = doc.kind === 'organization'
  const base = (process.env.NEXT_PUBLIC_SERVER_URL || 'https://next.sarapis.org').replace(/\/$/, '')
  const line = (label: string, value: unknown) =>
    value === undefined || value === null || value === '' ? null : `${label}: ${value}`
  const yesNo = (v: unknown) => (v === true ? 'yes' : v === false ? 'no' : 'not asked')

  const text = [
    `A new ${isOrg ? 'organization' : 'individual'} endorsement is waiting for review${doc.campaign ? ` (campaign ${doc.campaign})` : ''}.`,
    '',
    line('Name', doc.name),
    isOrg ? line('Website', doc.website) : line('Title', doc.title),
    isOrg ? line('Contact', doc.contactName) : line('Affiliation', doc.organization),
    line('Email', doc.email),
    line('Show publicly', yesNo(doc.displayPublicly)),
    isOrg ? line('Logo link', doc.logoUrl) : null,
    line('Message of support', doc.quote),
    line('Wants updates', yesNo(doc.wantsUpdates)),
    '',
    'Review and approve it (read the message; for an organization that agreed to be shown, upload its logo from the link; then tick "published"):',
    `${base}/admin/collections/campaign-endorsements/${doc.id}`,
  ]
    .filter((l) => l !== null)
    .join('\n')

  return { subject: `New endorsement: ${doc.name}${isOrg ? ' (organization)' : ''}`, text }
}
