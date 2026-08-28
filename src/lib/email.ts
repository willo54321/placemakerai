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

// Get the "from" address - uses project-specific if configured, otherwise falls back to default
function getFromAddress(projectEmailFromName?: string | null, projectEmailFromAddress?: string | null): string {
  if (projectEmailFromAddress) {
    const name = projectEmailFromName || 'Project Team'
    return `${name} <${projectEmailFromAddress}>`
  }
  return process.env.EMAIL_FROM || 'Placemaker.ai <onboarding@resend.dev>'
}

export async function sendQueryEmail({
  to,
  teamMemberName,
  question,
  enquirySubject,
  enquiryMessage,
  submitterName,
  queryUrl,
  projectEmailFromName,
  projectEmailFromAddress,
}: {
  to: string
  teamMemberName: string
  question: string
  enquirySubject: string
  enquiryMessage: string
  submitterName: string
  queryUrl: string
  projectEmailFromName?: string | null
  projectEmailFromAddress?: string | null
}) {
  const client = getResend()
  if (!client) {
    console.log('RESEND_API_KEY not configured, skipping email')
    return null
  }

  try {
    const { data, error } = await client.emails.send({
      from: getFromAddress(projectEmailFromName, projectEmailFromAddress),
      to: [to],
      subject: `Information Request: ${enquirySubject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b; margin-bottom: 20px;">Information Request</h2>

          <p style="color: #475569;">Hi ${escapeHtml(teamMemberName)},</p>

          <p style="color: #475569;">We need your input to help respond to a stakeholder enquiry.</p>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #7c3aed; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase;">Question for You</h3>
            <p style="color: #1e293b; margin: 0; font-weight: 500;">${escapeHtml(question)}</p>
          </div>

          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #64748b; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase;">Original Enquiry Context</h3>
            <p style="color: #475569; margin: 0 0 8px 0;"><strong>From:</strong> ${escapeHtml(submitterName)}</p>
            <p style="color: #475569; margin: 0 0 8px 0;"><strong>Subject:</strong> ${escapeHtml(enquirySubject)}</p>
            <p style="color: #475569; margin: 0; white-space: pre-wrap;">${escapeHtmlWithBreaks(enquiryMessage.substring(0, 500))}${enquiryMessage.length > 500 ? '...' : ''}</p>
          </div>

          <a href="${queryUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 20px 0;">
            Submit Your Response
          </a>

          <p style="color: #94a3b8; font-size: 14px; margin-top: 30px;">
            This is an automated message from the Consultation Platform.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send email:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Email send error:', err)
    return null
  }
}

export async function sendNewEnquiryNotification({
  to,
  projectName,
  submitterName,
  submitterEmail,
  subject,
  message,
  category,
  enquiryUrl,
  projectEmailFromName,
  projectEmailFromAddress,
}: {
  to: string | string[]
  projectName: string
  submitterName: string
  submitterEmail: string
  subject: string
  message: string
  category: string
  enquiryUrl: string
  projectEmailFromName?: string | null
  projectEmailFromAddress?: string | null
}) {
  const client = getResend()
  if (!client) {
    console.log('RESEND_API_KEY not configured, skipping email')
    return null
  }

  try {
    const recipients = Array.isArray(to) ? to : [to]
    const { data, error } = await client.emails.send({
      from: getFromAddress(projectEmailFromName, projectEmailFromAddress),
      to: recipients,
      subject: `New Enquiry: ${subject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b; margin-bottom: 20px;">New Enquiry Received</h2>

          <p style="color: #475569;">A new enquiry has been submitted for <strong>${escapeHtml(projectName)}</strong>.</p>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #475569; margin: 0 0 8px 0;"><strong>From:</strong> ${escapeHtml(submitterName)} (${escapeHtml(submitterEmail)})</p>
            <p style="color: #475569; margin: 0 0 8px 0;"><strong>Category:</strong> ${escapeHtml(category)}</p>
            <p style="color: #475569; margin: 0 0 8px 0;"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
          </div>

          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #64748b; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase;">Message</h3>
            <p style="color: #1e293b; margin: 0; white-space: pre-wrap;">${escapeHtmlWithBreaks(message.substring(0, 1000))}${message.length > 1000 ? '...' : ''}</p>
          </div>

          <a href="${enquiryUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 20px 0;">
            View Enquiry
          </a>

          <p style="color: #94a3b8; font-size: 14px; margin-top: 30px;">
            This is an automated notification from the Consultation Platform.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send new enquiry notification:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Email send error:', err)
    return null
  }
}

/**
 * Substitute the documented template placeholders into admin-authored text.
 * Values are escaped by the caller as appropriate for the target context.
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

export interface MailingRecipient {
  email: string
  name?: string | null
  unsubscribeUrl?: string
}

export async function sendMailingListEmail({
  to,
  subject,
  body,
  projectName,
  projectEmailFromName,
  projectEmailFromAddress,
}: {
  to: MailingRecipient[]
  subject: string
  body: string
  projectName: string
  projectEmailFromName?: string | null
  projectEmailFromAddress?: string | null
}): Promise<{ sent: number; failed: number }> {
  const client = getResend()
  if (!client) {
    console.log('RESEND_API_KEY not configured, skipping email')
    // Treat every recipient as failed to deliver.
    return { sent: 0, failed: to.length }
  }

  const from = getFromAddress(projectEmailFromName, projectEmailFromAddress)

  // Personalize per recipient: substitute {{name}}/{{project}} into the
  // admin-authored body (as plain text, then escape the result for HTML) and
  // append an unsubscribe link when we know the recipient's subscriber record.
  const buildHtml = (recipient: MailingRecipient) => {
    const personalized = personalizeTemplate(body, {
      name: recipient.name,
      project: projectName,
      subject,
    })
    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="white-space: pre-wrap; color: #1e293b;">${escapeHtmlWithBreaks(personalized)}</div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

          <p style="color: #94a3b8; font-size: 12px;">
            You received this email because you're subscribed to updates from ${escapeHtml(projectName)}.${recipient.unsubscribeUrl ? ` <a href="${recipient.unsubscribeUrl}" style="color: #94a3b8;">Unsubscribe</a>` : ''}
          </p>
        </div>
      `
  }

  let sent = 0
  let failed = 0

  // Send one message per recipient so subscriber addresses are never exposed to
  // each other, and to stay within Resend's per-message recipient limit.
  // Resend allows up to 100 individual messages per batch.batch.send call.
  const BATCH_SIZE = 100
  for (let i = 0; i < to.length; i += BATCH_SIZE) {
    const chunk = to.slice(i, i + BATCH_SIZE)
    const messages = chunk.map(recipient => ({
      from,
      to: [recipient.email],
      subject: personalizeTemplate(subject, { name: recipient.name, project: projectName }),
      html: buildHtml(recipient),
      headers: recipient.unsubscribeUrl
        ? { 'List-Unsubscribe': `<${recipient.unsubscribeUrl}>` }
        : undefined,
    }))

    try {
      const { data, error } = await client.batch.send(messages)
      if (error) {
        console.error('Failed to send mailing list batch:', error)
        failed += chunk.length
      } else {
        // batch.send returns one result entry per submitted message.
        const succeeded = Array.isArray(data?.data) ? data.data.length : chunk.length
        sent += succeeded
        failed += chunk.length - succeeded
      }
    } catch (err) {
      console.error('Mailing list batch send error:', err)
      failed += chunk.length
    }
  }

  return { sent, failed }
}

export async function sendAutoReplyEmail({
  to,
  submitterName,
  originalSubject,
  autoReplySubject,
  autoReplyMessage,
  projectName,
  projectEmailFromName,
  projectEmailFromAddress,
}: {
  to: string
  submitterName: string
  originalSubject: string
  autoReplySubject: string
  autoReplyMessage: string
  projectName: string
  projectEmailFromName?: string | null
  projectEmailFromAddress?: string | null
}) {
  const client = getResend()
  if (!client) {
    console.log('RESEND_API_KEY not configured, skipping auto-reply')
    return null
  }

  try {
    // The auto-reply template text is admin-authored (trusted). Escape the
    // substituted values (name/subject are user-controlled) before injecting
    // them into the HTML body so they cannot inject markup.
    const personalizedMessage = autoReplyMessage
      .replace(/\{\{name\}\}/gi, escapeHtml(submitterName))
      .replace(/\{\{subject\}\}/gi, escapeHtml(originalSubject))
      .replace(/\{\{project\}\}/gi, escapeHtml(projectName))

    // The subject line is a plain-text header field (not HTML), so substitute
    // the raw values here.
    const personalizedSubject = autoReplySubject
      .replace(/\{\{subject\}\}/gi, originalSubject)
      .replace(/\{\{project\}\}/gi, projectName)

    const { data, error } = await client.emails.send({
      from: getFromAddress(projectEmailFromName, projectEmailFromAddress),
      to: [to],
      subject: personalizedSubject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="white-space: pre-wrap; color: #1e293b;">${personalizedMessage}</div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

          <p style="color: #94a3b8; font-size: 12px;">
            This is an automated acknowledgement from the ${escapeHtml(projectName)} consultation.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send auto-reply email:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Auto-reply email send error:', err)
    return null
  }
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

export async function sendEnquiryResponseEmail({
  to,
  submitterName,
  subject,
  response,
  projectName,
  projectEmailFromName,
  projectEmailFromAddress,
}: {
  to: string
  submitterName: string
  subject: string
  response: string
  projectName: string
  projectEmailFromName?: string | null
  projectEmailFromAddress?: string | null
}) {
  const client = getResend()
  if (!client) {
    console.log('RESEND_API_KEY not configured, skipping email')
    return null
  }

  try {
    const { data, error } = await client.emails.send({
      from: getFromAddress(projectEmailFromName, projectEmailFromAddress),
      to: [to],
      subject: `Re: ${subject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b; margin-bottom: 20px;">Response to Your Enquiry</h2>

          <p style="color: #475569;">Dear ${escapeHtml(submitterName)},</p>

          <p style="color: #475569;">Thank you for your enquiry regarding <strong>${escapeHtml(subject)}</strong>.</p>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #1e293b; margin: 0; white-space: pre-wrap;">${escapeHtmlWithBreaks(response)}</p>
          </div>

          <p style="color: #475569;">If you have any further questions, please don't hesitate to get in touch.</p>

          <p style="color: #475569;">Best regards,<br>The ${escapeHtml(projectName)} Team</p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

          <p style="color: #94a3b8; font-size: 12px;">
            This email was sent in response to your enquiry submitted through our consultation platform.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send response email:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Email send error:', err)
    return null
  }
}
