import { Resend } from 'resend'
import { escapeHtml, escapeHtmlWithBreaks } from '@/lib/escape-html'

// Lazy initialization to avoid build errors when env var not set
let resend: Resend | null = null

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM || 'Placemaker.ai <onboarding@resend.dev>'
}

/**
 * Send an account email with a set-password link. Used both when a user is
 * first invited (mode 'invite') and for self-service password resets
 * (mode 'reset'). Always sent from the platform address, never a project's.
 */
export async function sendSetPasswordEmail({
  to,
  name,
  url,
  mode,
}: {
  to: string
  name?: string | null
  url: string
  mode: 'invite' | 'reset'
}) {
  const client = getResend()
  if (!client) {
    console.log('RESEND_API_KEY not configured, skipping set-password email')
    return null
  }

  const isInvite = mode === 'invite'
  const subject = isInvite
    ? 'You have been invited to Placemaker.ai'
    : 'Reset your Placemaker.ai password'
  const intro = isInvite
    ? 'An account has been created for you on Placemaker.ai. Click the button below to choose a password and sign in.'
    : 'We received a request to reset your Placemaker.ai password. Click the button below to choose a new one.'
  const expiryNote = isInvite
    ? 'This link expires in 7 days.'
    : 'This link expires in 2 hours. If you did not request a reset, you can safely ignore this email.'

  try {
    const { data, error } = await client.emails.send({
      from: getFromAddress(),
      to: [to],
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b; margin-bottom: 20px;">${isInvite ? 'Welcome to Placemaker.ai' : 'Password Reset'}</h2>

          <p style="color: #475569;">Hi ${escapeHtml(name || 'there')},</p>

          <p style="color: #475569;">${intro}</p>

          <a href="${url}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 20px 0;">
            ${isInvite ? 'Set Your Password' : 'Reset Password'}
          </a>

          <p style="color: #94a3b8; font-size: 14px;">${expiryNote}</p>

          <p style="color: #94a3b8; font-size: 14px; margin-top: 30px;">
            If the button doesn't work, copy this link into your browser:<br>
            <span style="word-break: break-all;">${url}</span>
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send set-password email:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Set-password email send error:', err)
    return null
  }
}

/**
 * Send a staff reply to a public enquirer. Sent from the platform's verified
 * domain for deliverability; Reply-To is set to the responding admin so the
 * enquirer's reply lands straight in that person's inbox. Returns the delivery
 * outcome so the caller can record it on the EnquiryMessage.
 */
export async function sendEnquiryReply({
  to,
  toName,
  subject,
  body,
  replyTo,
  projectName,
}: {
  to: string
  toName?: string | null
  subject: string
  body: string
  replyTo?: string | null
  projectName?: string | null
}): Promise<{ status: 'sent' | 'skipped' | 'failed'; id?: string | null }> {
  const client = getResend()
  if (!client) {
    console.log('RESEND_API_KEY not configured, skipping enquiry reply')
    return { status: 'skipped' }
  }

  try {
    const { data, error } = await client.emails.send({
      from: getFromAddress(),
      to: [to],
      replyTo: replyTo || undefined,
      subject,
      text: body,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="color: #475569;">Hi ${escapeHtml(toName || 'there')},</p>
          <p style="color: #1e293b; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(body)}</p>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            This is a reply to your enquiry${projectName ? ` about ${escapeHtml(projectName)}` : ''}. You can reply to this email to continue the conversation.
          </p>
        </div>
      `,
    })
    if (error) {
      console.error('Failed to send enquiry reply:', error)
      return { status: 'failed' }
    }
    return { status: 'sent', id: data?.id }
  } catch (err) {
    console.error('Enquiry reply send error:', err)
    return { status: 'failed' }
  }
}

/**
 * Notify the team that a Start a Project enquiry landed. Reply-To is the
 * submitter, so replying to the notification answers the lead directly.
 * Skips silently when RESEND_API_KEY or CONTACT_NOTIFY_EMAIL is unset —
 * /admin/messages remains the source of truth either way.
 */
export async function sendContactNotification({
  name,
  email,
  organization,
  projectType,
  message,
}: {
  name: string
  email: string
  organization?: string | null
  projectType?: string | null
  message: string
}) {
  const client = getResend()
  const to = process.env.CONTACT_NOTIFY_EMAIL
  if (!client || !to) {
    if (!to) console.log('CONTACT_NOTIFY_EMAIL not configured, skipping contact notification')
    return null
  }

  try {
    const { data, error } = await client.emails.send({
      from: getFromAddress(),
      to: [to],
      replyTo: email,
      subject: `New enquiry from ${name}${organization ? ` (${organization})` : ''}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b;">New Start a Project enquiry</h2>
          <p style="color: #475569;"><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;${organization ? ` — ${escapeHtml(organization)}` : ''}</p>
          ${projectType ? `<p style="color: #475569;">Project type: ${escapeHtml(projectType)}</p>` : ''}
          <p style="color: #475569; white-space: pre-wrap; border-left: 3px solid #16a34a; padding-left: 12px;">${escapeHtml(message)}</p>
          <p style="color: #94a3b8; font-size: 14px;">Reply to this email to answer directly, or view all messages in the admin inbox.</p>
        </div>
      `,
    })
    if (error) {
      console.error('Failed to send contact notification:', error)
      return null
    }
    return data
  } catch (err) {
    console.error('Contact notification send error:', err)
    return null
  }
}

/**
 * Substitute {{name}} / {{project}} / {{subject}} placeholders in
 * admin-authored campaign subject lines and bodies.
 */
export function personalizeTemplate(
  template: string,
  vars: { name?: string | null; subject?: string; project?: string }
): string {
  return template
    .replace(/\{\{name\}\}/gi, vars.name || 'there')
    .replace(/\{\{subject\}\}/gi, vars.subject ?? '')
    .replace(/\{\{project\}\}/gi, vars.project ?? '')
}

export interface CampaignRecipient {
  email: string
  name?: string | null
  unsubscribeToken: string
}

/**
 * Send a campaign to a project's mailing list. One message per recipient so
 * addresses are never exposed to each other and {{name}} personalises
 * correctly; batched 100 per Resend batch call. Every message carries the
 * recipient's unsubscribe link in the footer and in List-Unsubscribe headers
 * (with one-click POST per RFC 8058). Sent from the platform address —
 * per-client sending domains are future work. Reply-To goes to the sending
 * admin so responses land in a human inbox.
 */
export async function sendCampaignEmail({
  to,
  subject,
  body,
  projectName,
  replyTo,
  baseUrl,
}: {
  to: CampaignRecipient[]
  subject: string
  body: string
  projectName: string
  replyTo?: string | null
  baseUrl: string
}): Promise<{ sent: number; failed: number }> {
  const client = getResend()
  if (!client) {
    console.log('RESEND_API_KEY not configured, skipping campaign send')
    return { sent: 0, failed: to.length }
  }

  // Footer link goes to the confirm page (safe against link scanners); the
  // List-Unsubscribe header must be a POST-capable URL for RFC 8058 one-click,
  // so it targets the API route directly.
  const pageUrl = (token: string) => `${baseUrl}/unsubscribe?token=${token}`
  const oneClickUrl = (token: string) => `${baseUrl}/api/unsubscribe?token=${token}`

  const buildHtml = (recipient: CampaignRecipient) => {
    const personalized = personalizeTemplate(body, {
      name: recipient.name,
      project: projectName,
      subject,
    })
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="white-space: pre-wrap; color: #1e293b; line-height: 1.6;">${escapeHtmlWithBreaks(personalized)}</div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

        <p style="color: #94a3b8; font-size: 12px;">
          You received this email because you're subscribed to updates from ${escapeHtml(projectName)}.
          <a href="${pageUrl(recipient.unsubscribeToken)}" style="color: #94a3b8;">Unsubscribe</a>
        </p>
      </div>
    `
  }

  let sent = 0
  let failed = 0

  const BATCH_SIZE = 100
  for (let i = 0; i < to.length; i += BATCH_SIZE) {
    const chunk = to.slice(i, i + BATCH_SIZE)
    const messages = chunk.map(recipient => ({
      from: getFromAddress(),
      to: [recipient.email],
      replyTo: replyTo || undefined,
      subject: personalizeTemplate(subject, { name: recipient.name, project: projectName }),
      html: buildHtml(recipient),
      headers: {
        'List-Unsubscribe': `<${oneClickUrl(recipient.unsubscribeToken)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }))

    try {
      const { data, error } = await client.batch.send(messages)
      if (error) {
        console.error('Failed to send campaign batch:', error)
        failed += chunk.length
      } else {
        // batch.send returns one result entry per accepted message.
        const succeeded = Array.isArray(data?.data) ? data.data.length : chunk.length
        sent += succeeded
        failed += chunk.length - succeeded
      }
    } catch (err) {
      console.error('Campaign batch send error:', err)
      failed += chunk.length
    }
  }

  return { sent, failed }
}

/**
 * Ops alert from the daily health cron: failed or stuck analysis runs.
 * Same graceful-skip behaviour as everything else in this file.
 */
export async function sendOpsAlert(problems: string[]) {
  const client = getResend()
  const to = process.env.CONTACT_NOTIFY_EMAIL
  if (!client || !to || problems.length === 0) return null

  try {
    const { data, error } = await client.emails.send({
      from: getFromAddress(),
      to: [to],
      subject: `Placemaker ops alert: ${problems.length} issue${problems.length === 1 ? '' : 's'} detected`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #b91c1c;">Ops alert</h2>
          <ul style="color: #475569;">
            ${problems.map(problem => `<li>${escapeHtml(problem)}</li>`).join('')}
          </ul>
          <p style="color: #94a3b8; font-size: 14px;">Details on the admin Audit &amp; usage page (System health card).</p>
        </div>
      `,
    })
    if (error) {
      console.error('Failed to send ops alert:', error)
      return null
    }
    return data
  } catch (err) {
    console.error('Ops alert send error:', err)
    return null
  }
}
