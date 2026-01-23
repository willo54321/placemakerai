import { Resend } from 'resend'

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

          <p style="color: #475569;">Hi ${teamMemberName},</p>

          <p style="color: #475569;">We need your input to help respond to a stakeholder enquiry.</p>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #7c3aed; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase;">Question for You</h3>
            <p style="color: #1e293b; margin: 0; font-weight: 500;">${question}</p>
          </div>

          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #64748b; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase;">Original Enquiry Context</h3>
            <p style="color: #475569; margin: 0 0 8px 0;"><strong>From:</strong> ${submitterName}</p>
            <p style="color: #475569; margin: 0 0 8px 0;"><strong>Subject:</strong> ${enquirySubject}</p>
            <p style="color: #475569; margin: 0; white-space: pre-wrap;">${enquiryMessage.substring(0, 500)}${enquiryMessage.length > 500 ? '...' : ''}</p>
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

          <p style="color: #475569;">A new enquiry has been submitted for <strong>${projectName}</strong>.</p>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #475569; margin: 0 0 8px 0;"><strong>From:</strong> ${submitterName} (${submitterEmail})</p>
            <p style="color: #475569; margin: 0 0 8px 0;"><strong>Category:</strong> ${category}</p>
            <p style="color: #475569; margin: 0 0 8px 0;"><strong>Subject:</strong> ${subject}</p>
          </div>

          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #64748b; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase;">Message</h3>
            <p style="color: #1e293b; margin: 0; white-space: pre-wrap;">${message.substring(0, 1000)}${message.length > 1000 ? '...' : ''}</p>
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

export async function sendMailingListEmail({
  to,
  subject,
  body,
  projectName,
  projectEmailFromName,
  projectEmailFromAddress,
}: {
  to: string[]
  subject: string
  body: string
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
      to,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="white-space: pre-wrap; color: #1e293b;">${body}</div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

          <p style="color: #94a3b8; font-size: 12px;">
            You received this email because you're subscribed to updates from ${projectName}.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send mailing list email:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Email send error:', err)
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

          <p style="color: #475569;">Dear ${submitterName},</p>

          <p style="color: #475569;">Thank you for your enquiry regarding <strong>${subject}</strong>.</p>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #1e293b; margin: 0; white-space: pre-wrap;">${response}</p>
          </div>

          <p style="color: #475569;">If you have any further questions, please don't hesitate to get in touch.</p>

          <p style="color: #475569;">Best regards,<br>The ${projectName} Team</p>

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
