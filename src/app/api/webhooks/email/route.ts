import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sendAutoReplyEmail } from '@/lib/email'

// Webhook secret for verifying requests
const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET

// Resend inbound webhook format
interface ResendInboundEmail {
  type: 'email.received'
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    text?: string
    html?: string
    headers?: Record<string, string>
  }
}

// Generic/Cloudflare format
interface GenericInboundEmail {
  from: string
  fromName?: string
  to: string | string[]
  subject: string
  text?: string
  html?: string
  headers?: Record<string, string>
  timestamp?: string
}

// POST /api/webhooks/email - Receive emails from Resend or other providers
export async function POST(request: Request) {
  try {
    // Verify webhook secret (optional but recommended)
    const headersList = headers()
    const authHeader = headersList.get('authorization')
    const svixId = headersList.get('svix-id') // Resend uses Svix for webhooks

    // If we have a secret configured, verify it (skip for Resend which uses different auth)
    if (WEBHOOK_SECRET && !svixId && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      console.error('Invalid webhook authorization')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Detect if this is Resend format or generic format
    let senderEmail: string
    let senderName: string
    let recipientEmails: string[]
    let subject: string
    let textBody: string
    let htmlBody: string | undefined

    if (body.type === 'email.received' && body.data) {
      // Resend inbound webhook format
      const resendEmail = body as ResendInboundEmail
      senderEmail = resendEmail.data.from
      senderName = senderEmail.split('@')[0]
      recipientEmails = resendEmail.data.to
      subject = resendEmail.data.subject || '(No Subject)'
      textBody = resendEmail.data.text || ''
      htmlBody = resendEmail.data.html
    } else {
      // Generic/Cloudflare format
      const email = body as GenericInboundEmail

      if (!email.from || !email.to || !email.subject) {
        return NextResponse.json(
          { error: 'Missing required fields: from, to, subject' },
          { status: 400 }
        )
      }

      // Extract email address from "Name <email@example.com>" format
      const fromMatch = email.from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/)
      senderEmail = fromMatch ? fromMatch[2] : email.from
      senderName = email.fromName || (fromMatch ? fromMatch[1] : null) || senderEmail.split('@')[0]
      recipientEmails = Array.isArray(email.to) ? email.to : [email.to]
      subject = email.subject
      textBody = email.text || ''
      htmlBody = email.html
    }

    // Clean up sender email
    senderEmail = senderEmail.toLowerCase().trim()

    // Find project by matching recipient domain to project's emailFromAddress domain
    let project = null

    for (const recipientEmail of recipientEmails) {
      // Extract domain from recipient email
      const domainMatch = recipientEmail.match(/@([^>]+)>?$/)
      const recipientDomain = domainMatch ? domainMatch[1].toLowerCase() : null

      if (!recipientDomain) continue

      // Find project where emailFromAddress has the same domain
      project = await prisma.project.findFirst({
        where: {
          emailFromAddress: {
            endsWith: `@${recipientDomain}`,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          name: true,
          emailFromName: true,
          emailFromAddress: true,
          autoReplyEnabled: true,
          autoReplySubject: true,
          autoReplyMessage: true
        }
      })

      if (project) break

      // Also try matching the full email address
      project = await prisma.project.findFirst({
        where: {
          emailFromAddress: {
            equals: recipientEmail.replace(/[<>]/g, '').toLowerCase(),
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          name: true,
          emailFromName: true,
          emailFromAddress: true,
          autoReplyEnabled: true,
          autoReplySubject: true,
          autoReplyMessage: true
        }
      })

      if (project) break
    }

    if (!project) {
      console.log('No matching project found for recipients:', recipientEmails)
      // Return success to prevent webhook retries
      return NextResponse.json({
        success: true,
        warning: 'No matching project found',
        recipients: recipientEmails
      })
    }

    // Check if sender is an existing stakeholder
    const stakeholder = await prisma.stakeholder.findFirst({
      where: {
        projectId: project.id,
        email: { equals: senderEmail, mode: 'insensitive' }
      },
      select: { id: true, name: true, organization: true }
    })

    // Use stakeholder name if found, otherwise use sender name
    const submitterName = stakeholder?.name || senderName

    // Create the enquiry
    const enquiry = await prisma.enquiry.create({
      data: {
        projectId: project.id,
        submitterName,
        submitterEmail: senderEmail,
        submitterOrg: stakeholder?.organization || null,
        subject,
        message: textBody || htmlBody || '(No message body)',
        category: 'email',
        priority: 'normal',
        status: 'new',
        gdprConsent: false
      }
    })

    // Add the original email as the first message in the thread
    await prisma.enquiryMessage.create({
      data: {
        enquiryId: enquiry.id,
        type: 'inbound',
        content: textBody || htmlBody || '(No message body)',
        authorName: submitterName
      }
    })

    console.log(`Created enquiry ${enquiry.id} for project "${project.name}" from ${senderEmail}`)

    // Send auto-reply if enabled
    let autoReplySent = false
    if (project.autoReplyEnabled && project.autoReplySubject && project.autoReplyMessage) {
      try {
        const autoReplyResult = await sendAutoReplyEmail({
          to: senderEmail,
          submitterName,
          originalSubject: subject,
          autoReplySubject: project.autoReplySubject,
          autoReplyMessage: project.autoReplyMessage,
          projectName: project.name,
          projectEmailFromName: project.emailFromName,
          projectEmailFromAddress: project.emailFromAddress
        })

        if (autoReplyResult) {
          autoReplySent = true
          // Log the auto-reply as an outbound message in the thread
          await prisma.enquiryMessage.create({
            data: {
              enquiryId: enquiry.id,
              type: 'outbound',
              content: project.autoReplyMessage
                .replace(/\{\{name\}\}/gi, submitterName)
                .replace(/\{\{subject\}\}/gi, subject)
                .replace(/\{\{project\}\}/gi, project.name),
              authorName: 'Auto-Reply'
            }
          })
          console.log(`Auto-reply sent to ${senderEmail} for enquiry ${enquiry.id}`)
        }
      } catch (autoReplyError) {
        console.error('Failed to send auto-reply:', autoReplyError)
        // Don't fail the webhook if auto-reply fails
      }
    }

    return NextResponse.json({
      success: true,
      enquiryId: enquiry.id,
      projectId: project.id,
      projectName: project.name,
      fromStakeholder: !!stakeholder,
      autoReplySent
    })

  } catch (error) {
    console.error('Error processing incoming email:', error)
    return NextResponse.json(
      { error: 'Failed to process email' },
      { status: 500 }
    )
  }
}

// GET endpoint for health check / verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'email-webhook',
    timestamp: new Date().toISOString()
  })
}
