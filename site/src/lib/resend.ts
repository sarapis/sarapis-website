import type { Payload } from 'payload'

/**
 * Sends one plain-text email through Resend's HTTP API with fetch: the CMS has
 * no Payload email adapter, and this needs no package. Used by the campaign
 * hooks (notifyNewEndorsement, sendCampaignConfirmation).
 *
 * Fire-and-forget: it never throws and never delays the request that triggered
 * it. A failed send is logged with `label`.
 */
export type ResendEmail = {
  from: string
  to: string | string[]
  subject: string
  text: string
  replyTo?: string
}

export function sendResendEmail(key: string, email: ResendEmail, logger: Payload['logger'], label: string): void {
  void fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
    })
    .catch((err) => logger.error(`${label}: email failed: ${err}`))
}
