import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { getCurrentUser } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { sendCampaignEmail } from '@/lib/email'
import { getProjectReplyAddress } from '@/lib/email-identity'
import { NextResponse } from 'next/server'

/**
 * Send a draft campaign to every subscribed address on the project's mailing
 * list. Runs synchronously (Resend batches of 100), then flips the campaign
 * to its immutable sent state. Failed sends stay editable for retry.
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string; campaignId: string }> }
) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const [campaign, project, user] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id: params.campaignId, projectId: params.id },
    }),
    prisma.project.findUnique({
      where: { id: params.id },
      select: { name: true, emailLocalPart: true },
    }),
    getCurrentUser(),
  ])

  if (!campaign || !project) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  if (campaign.status === 'sent') {
    return NextResponse.json({ error: 'Campaign has already been sent' }, { status: 400 })
  }

  const recipients = await prisma.subscriber.findMany({
    where: { projectId: params.id, subscribed: true },
    select: { email: true, name: true, unsubscribeToken: true },
  })

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: 'No subscribed recipients on the mailing list' },
      { status: 400 }
    )
  }

  const baseUrl = (process.env.NEXTAUTH_URL || 'https://platform.placemakerai.io').replace(/\/$/, '')

  // With inbound email configured, replies become new enquiries attributed to
  // this campaign; otherwise they go to the sending admin's own inbox.
  const { sent, failed } = await sendCampaignEmail({
    to: recipients,
    subject: campaign.subject,
    body: campaign.body,
    project,
    replyTo: getProjectReplyAddress(project, `c-${campaign.id}`) ?? user?.email ?? null,
    baseUrl,
  })

  const status = sent > 0 ? 'sent' : 'failed'
  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status,
      sentAt: sent > 0 ? new Date() : null,
      sentBy: user?.email || null,
      recipientCount: sent,
      failedCount: failed,
    },
  })

  await logAudit({
    projectId: params.id,
    action: 'campaign.send',
    targetType: 'Campaign',
    targetId: campaign.id,
    detail: { subject: campaign.subject, sent, failed },
  })

  if (sent === 0) {
    return NextResponse.json(
      { error: 'Failed to send campaign — no messages were delivered', campaign: updated },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true, campaign: updated, sent, failed })
}
