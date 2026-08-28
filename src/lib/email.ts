import { Resend } from 'resend'
import { escapeHtml } from '@/lib/escape-html'

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
