import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

// Webhook secret for verifying requests from Cloudflare Worker
const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET

interface IncomingEmail {
  from: string
  fromName?: string
  to: string
  subject: string
  text: string
  html?: string
  headers?: Record<string, string>
  timestamp?: string
}

// POST /api/webhooks/email - Receive emails from Cloudflare Email Worker
export async function POST(request: Request) {
  try {
    // Verify webhook secret
    const headersList = headers()
    const authHeader = headersList.get('authorization')

    if (WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      console.error('Invalid webhook authorization')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const email: IncomingEmail = await request.json()

    // Validate required fields
    if (!email.from || !email.to || !email.subject) {
      return NextResponse.json(
        { error: 'Missing required fields: from, to, subject' },
        { status: 400 }
      )
    }

    // Extract email address and name from "Name <email@example.com>" format
    const fromMatch = email.from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/)
    const senderEmail = fromMatch ? fromMatch[2] : email.from
    const senderName = email.fromName || (fromMatch ? fromMatch[1] : null) || senderEmail.split('@')[0]

    // Extract the local part of the recipient email (e.g., "project-abc" from "project-abc@placemakerai.io")
    const toMatch = email.to.match(/^<?([^@]+)@/)
    const recipientLocal = toMatch ? toMatch[1].toLowerCase() : null

    if (!recipientLocal) {
      console.error('Could not parse recipient email:', email.to)
      return NextResponse.json({ error: 'Invalid recipient format' }, { status: 400 })
    }

    // Find the project by matching the email local part
    // Projects can set their emailFromAddress or we match by project slug/id
    let project = await prisma.project.findFirst({
      where: {
        OR: [
          // Match if emailFromAddress contains the local part
          { emailFromAddress: { contains: recipientLocal, mode: 'insensitive' } },
          // Match if project ID starts with the local part
          { id: { startsWith: recipientLocal } }
        ]
      },
      select: { id: true, name: true }
    })

    // If no direct match, try to find by checking all projects' email patterns
    if (!project) {
      // Look for project where the local part might be a slug-like identifier
      const allProjects = await prisma.project.findMany({
        select: { id: true, name: true, emailFromAddress: true }
      })

      // Try matching based on project name slug
      project = allProjects.find(p => {
        const nameSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        return nameSlug === recipientLocal || recipientLocal.includes(nameSlug)
      }) || null
    }

    if (!project) {
      console.log('No matching project found for recipient:', email.to)
      // Still log the email for debugging but return success to prevent retries
      return NextResponse.json({
        success: true,
        warning: 'No matching project found',
        recipient: email.to
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

    // Create the enquiry
    const enquiry = await prisma.enquiry.create({
      data: {
        projectId: project.id,
        submitterName: stakeholder?.name || senderName,
        submitterEmail: senderEmail,
        submitterOrg: stakeholder?.organization || null,
        subject: email.subject,
        message: email.text || email.html || '(No message body)',
        category: 'email',
        priority: 'normal',
        status: 'new',
        gdprConsent: false // Emails don't have explicit GDPR consent
      }
    })

    // Add the original email as the first message in the thread
    await prisma.enquiryMessage.create({
      data: {
        enquiryId: enquiry.id,
        type: 'inbound',
        content: email.text || email.html || '(No message body)',
        authorName: stakeholder?.name || senderName
      }
    })

    console.log(`Created enquiry ${enquiry.id} for project ${project.name} from ${senderEmail}`)

    return NextResponse.json({
      success: true,
      enquiryId: enquiry.id,
      projectId: project.id,
      fromStakeholder: !!stakeholder
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
