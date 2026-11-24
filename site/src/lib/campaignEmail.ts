import type { Payload } from 'payload'

/**
 * Campaign email: the mailing list and the automatic emails for a campaign's
 * forms (campaign-signups, campaign-endorsements), through Resend's HTTP API
 * with fetch, like notifyNewEndorsement (no email adapter, no package).
 *
 * A campaign takes part only when BOTH hold:
 *   - it has words in MESSAGES below (today only `nyc-ospo`,
 *     ospo.opensource.nyc), and
 *   - the server has RESEND_API_KEY and CAMPAIGN_EMAIL_<KEY>_FROM, where <KEY>
 *     is the campaign key upper-cased with non-alphanumerics as "_"
 *     (nyc-ospo → NYC_OSPO).
 * Any other campaign, or a missing setting, sends nothing and logs a line, so
 * WeGov's and Databook's forms are untouched.
 *
 * Per-campaign settings (env, so addresses and ids stay out of this public repo):
 *   CAMPAIGN_EMAIL_<KEY>_FROM        sender on a Resend-verified domain,
 *                                    e.g. "NYC OSPO campaign <ospo@updates.opensource.nyc>"
 *   CAMPAIGN_EMAIL_<KEY>_REPLY_TO    where replies go (one address, or comma-separated)
 *   CAMPAIGN_EMAIL_<KEY>_SEGMENT_ID  Resend segment (the list) for opted-in people
 *   CAMPAIGN_EMAIL_<KEY>_TOPIC_ID    Resend topic, so a broadcast's unsubscribe
 *                                    leaves this campaign only
 *   CAMPAIGN_EMAIL_<KEY>_USE_TEMPLATES  1 to send with the Resend templates named
 *                                    in MESSAGES (falls back to the built-in words)
 *
 * Who gets what (the forms' promises: the endorse form says the email is used
 * "only to contact you about your endorsement and, if you ask, to send updates"):
 *   - the LIST gets only people who asked for updates: every campaign-signup
 *     (the homepage form, and an endorser who ticked "Send me updates");
 *   - an endorser gets a thank-you, and a note when the endorsement is
 *     published: both about their own endorsement, so they go to everyone;
 *   - a new homepage sign-up gets a welcome. One from the endorse form doesn't
 *     (its thank-you already says updates will follow), nor does a repeat
 *     sign-up for the same campaign.
 *
 * Nothing here ever fails a submission: callers fire and forget, and every
 * Resend error is logged, not thrown.
 */

const API = 'https://api.resend.com'

/**
 * An email's built-in words, and optionally the Resend template that replaces
 * them: its alias and the values for its {{{VARIABLES}}}. Templates are edited
 * and published in Resend's dashboard (Templates), so the words change without
 * a deploy. They are used only while CAMPAIGN_EMAIL_<KEY>_USE_TEMPLATES is set;
 * if Resend refuses a template (missing, unpublished, a bad variable), the
 * built-in subject and text go instead, so nobody misses the email.
 */
type Message = { subject: string; text: string; template?: { alias: string; variables: Record<string, string> } }

export type CampaignConfig = {
  campaign: string
  key: string
  from: string
  replyTo?: string[]
  segmentId?: string
  topicId?: string
  useTemplates: boolean
  messages: CampaignMessages
}

type Endorsement = Record<string, any>

type CampaignMessages = {
  welcome: () => Message
  endorsementThanks: (e: Endorsement) => Message
  endorsementLive: (e: Endorsement) => Message
}

export function envKey(campaign: string): string {
  return campaign.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
}

/** The campaign's settings, or null when it doesn't send email. */
export function campaignConfig(campaign: unknown): CampaignConfig | null {
  if (typeof campaign !== 'string' || !campaign) return null
  const messages = MESSAGES[campaign]
  const key = envKey(campaign)
  const env = (name: string) => process.env[`CAMPAIGN_EMAIL_${key}_${name}`]?.trim() || undefined
  const from = env('FROM')
  if (!messages || !from || !process.env.RESEND_API_KEY) return null
  const replyTo = env('REPLY_TO')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    campaign,
    key,
    from,
    replyTo: replyTo?.length ? replyTo : undefined,
    segmentId: env('SEGMENT_ID'),
    topicId: env('TOPIC_ID'),
    useTemplates: ['1', 'true', 'yes', 'on'].includes((env('USE_TEMPLATES') ?? '').toLowerCase()),
    messages,
  }
}

async function resend(
  payload: Payload,
  what: string,
  path: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Response | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) payload.logger.error(`Campaign email: ${what} failed: Resend ${res.status}: ${await res.text()}`)
    return res
  } catch (err) {
    payload.logger.error(`Campaign email: ${what} failed: ${err}`)
    return null
  }
}

/**
 * Puts an opted-in address on the campaign's list: a new Resend contact in its
 * segment, subscribed to its topic; or, when the contact already exists (they
 * follow another Sarapis list), the same two things added to it.
 */
export async function addToList(payload: Payload, cfg: CampaignConfig, email: string): Promise<void> {
  if (!cfg.segmentId) return
  const topics = cfg.topicId ? [{ id: cfg.topicId, subscription: 'opt_in' }] : undefined
  const res = await resend(payload, `list ${cfg.campaign}`, '/contacts', 'POST', {
    email,
    unsubscribed: false,
    segments: [{ id: cfg.segmentId }],
    ...(topics ? { topics } : {}),
  })
  if (res?.ok) return
  // Already a contact (or the create was refused): add them to the segment
  // and topic directly. Both calls are safe to repeat.
  const who = encodeURIComponent(email)
  await resend(payload, `segment ${cfg.campaign}`, `/contacts/${who}/segments/${cfg.segmentId}`, 'POST')
  if (topics) await resend(payload, `topic ${cfg.campaign}`, `/contacts/${who}/topics`, 'PATCH', topics)
}

/** HTML-escapes a value going into a template: names come from public forms. */
export function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/**
 * One email to one person: the Resend template when it's switched on, else (or
 * if Resend refuses it) the built-in words. `idempotencyKey` stops a retried
 * hook sending twice.
 */
export async function sendCampaignEmail(
  payload: Payload,
  cfg: CampaignConfig,
  to: string,
  message: Message,
  idempotencyKey: string,
): Promise<void> {
  const unsubscribe = cfg.replyTo?.[0]
  const common = {
    from: cfg.from,
    to: [to],
    ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
    ...(unsubscribe ? { headers: { 'List-Unsubscribe': `<mailto:${unsubscribe}?subject=unsubscribe>` } } : {}),
    tags: [{ name: 'campaign', value: cfg.key.toLowerCase() }],
  }

  if (cfg.useTemplates && message.template) {
    const variables = Object.fromEntries(
      Object.entries(message.template.variables).map(([k, v]) => [k, escapeHtml(v)]),
    )
    const res = await resend(
      payload,
      `template ${message.template.alias}`,
      '/emails',
      'POST',
      { ...common, template: { id: message.template.alias, variables } },
      { 'Idempotency-Key': `${idempotencyKey}-tpl`.slice(0, 256) },
    )
    if (res?.ok) return
    payload.logger.warn(`Campaign email: template ${message.template.alias} refused; sending the built-in words instead.`)
  }

  await resend(
    payload,
    `"${message.subject}"`,
    '/emails',
    'POST',
    { ...common, subject: message.subject, text: message.text },
    { 'Idempotency-Key': idempotencyKey.slice(0, 256) },
  )
}

/** "Pat" from "Pat Doe"; the contact's name for an organization. */
export function firstName(e: Endorsement): string | null {
  const full = e.kind === 'organization' ? e.contactName : e.name
  const first = typeof full === 'string' ? full.trim().split(/\s+/)[0] : ''
  return first || null
}

// ---- Words (the built-in versions; with USE_TEMPLATES on, the Resend
// templates named here are sent instead, and these are the fallback) --------
// One entry per campaign that sends email. Plain text: these read as notes
// from the team, not newsletters. To change what people get, edit the
// templates in Resend; change these only for the fallback (needs a deploy).

const OSPO = 'https://ospo.opensource.nyc'
const OSPO_SIGNOFF = ['', 'The NYC OSPO campaign team at Sarapis', OSPO]
const OSPO_FOOTER = (why: string) => ['', '—', why, 'To stop these emails, reply with "unsubscribe".']

const MESSAGES: Record<string, CampaignMessages> = {
  'nyc-ospo': {
    welcome: () => ({
      template: { alias: 'nyc-ospo-welcome', variables: {} },
      subject: 'Thanks for following the campaign for an NYC OSPO',
      text: [
        'Thanks for signing up for updates on the campaign for an Open Source Program Office for New York City.',
        '',
        'We are asking the City to set up a small, permanent office within its Office of Technology and Innovation (OTI) that helps City teams build excellent digital services with open source.',
        '',
        'Two ways to help now:',
        `- Endorse the proposal, and share it with your network: ${OSPO}/endorse`,
        `- Read the executive summary: ${OSPO}/research`,
        '',
        'We will write occasionally, when there is news or a way to help. Reply any time if you have a question or want to get involved.',
        ...OSPO_SIGNOFF,
        ...OSPO_FOOTER(`You are getting this because you signed up for updates at ${OSPO}.`),
      ].join('\n'),
    }),

    endorsementThanks: (e) => {
      const hi = firstName(e)
      const onBehalf = e.kind === 'organization' && e.name ? ` on behalf of ${e.name}` : ''
      return {
        template: {
          alias: 'nyc-ospo-endorsement-thanks',
          variables: {
            GREETING_NAME: hi ?? 'there',
            ON_BEHALF: onBehalf,
            NAME_NOTE:
              e.displayPublicly === false
                ? ' You asked not to be listed by name, so your endorsement will be counted without your name.'
                : '',
            UPDATES_NOTE: e.wantsUpdates
              ? ' You also asked for campaign updates, so we will write occasionally when there is news.'
              : '',
          },
        },
        subject: 'Thank you for endorsing an NYC OSPO',
        text: [
          hi ? `Hi ${hi},` : 'Hello,',
          '',
          `Thank you for endorsing the proposal for an Open Source Program Office for New York City${onBehalf}.`,
          '',
          'What happens next: we read every endorsement before it appears on the page, and we will email you when yours is live.',
          e.displayPublicly === false
            ? 'You asked not to be listed by name, so your endorsement will be counted without your name.'
            : null,
          '',
          `Every endorsement makes the case stronger, and so does every person who hears about it. Please share the proposal with your network: ${OSPO}/endorse`,
          e.wantsUpdates ? '' : null,
          e.wantsUpdates ? 'You also asked for campaign updates, so we will write occasionally when there is news.' : null,
          '',
          'Reply any time if you have a question or want to get involved.',
          ...OSPO_SIGNOFF,
          ...OSPO_FOOTER(`You are getting this because you endorsed the proposal at ${OSPO}/endorse.`),
        ]
          .filter((l) => l !== null)
          .join('\n'),
      }
    },

    endorsementLive: (e) => {
      const hi = firstName(e)
      const shown = e.displayPublicly !== false
      return {
        template: {
          alias: 'nyc-ospo-endorsement-live',
          variables: {
            GREETING_NAME: hi ?? 'there',
            LIVE_LINE: shown
              ? `Your endorsement is now on the page: ${OSPO}/endorse#endorsers`
              : 'Your endorsement has been approved. As you asked, it is counted without your name.',
          },
        },
        subject: 'Your endorsement of an NYC OSPO is live',
        text: [
          hi ? `Hi ${hi},` : 'Hello,',
          '',
          shown
            ? `Your endorsement is now on the page: ${OSPO}/endorse#endorsers`
            : 'Your endorsement has been approved. As you asked, it is counted without your name.',
          '',
          `Thank you again. The most useful next step is to share the proposal with people who care about how New York City builds its digital services: ${OSPO}/endorse`,
          ...OSPO_SIGNOFF,
          ...OSPO_FOOTER(`You are getting this because you endorsed the proposal at ${OSPO}/endorse.`),
        ].join('\n'),
      }
    },
  },
}
