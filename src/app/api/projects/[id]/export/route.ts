import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

/**
 * Full project data export for reporting, offboarding and GDPR access
 * requests. ?format=json (default) returns everything; ?format=csv returns
 * the feedback corpus flattened to one row per submission.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      publicPins: { orderBy: { createdAt: 'asc' } },
      feedbackForms: { include: { responses: { orderBy: { submittedAt: 'asc' } } } },
      enquiries: { orderBy: { createdAt: 'asc' } },
      analysisResults: { where: { type: 'full' } },
    },
  })
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const format = new URL(request.url).searchParams.get('format') || 'json'
  const stamp = new Date().toISOString().slice(0, 10)
  const slug = project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()

  await logAudit({
    projectId: params.id,
    action: 'export.download',
    detail: {
      format,
      pins: project.publicPins.length,
      responses: project.feedbackForms.reduce((n, f) => n + f.responses.length, 0),
      enquiries: project.enquiries.length,
    },
  })

  if (format === 'csv') {
    const escape = (value: unknown) => {
      const text = value == null ? '' : String(value)
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const rows: string[] = [
      'id,channel,submitted_at,name,email,category,latitude,longitude,approved,content',
    ]
    project.publicPins.forEach(pin => {
      rows.push(
        [
          pin.id, 'map_pin', pin.createdAt.toISOString(), pin.name ?? '', pin.email ?? '',
          pin.category, pin.latitude ?? '', pin.longitude ?? '', pin.approved, pin.comment,
        ].map(escape).join(',')
      )
    })
    project.feedbackForms.forEach(form => {
      form.responses.forEach(response => {
        const data = response.data as Record<string, unknown>
        const name = data.name || data.Name || data.fullName || ''
        const email = data.email || data.Email || ''
        const content = Object.entries(data)
          .filter(([key]) => !['gdprConsent'].includes(key))
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join('; ') : value}`)
          .join(' | ')
        rows.push(
          [response.id, `form:${form.name}`, response.submittedAt.toISOString(), name, email, '', '', '', '', content]
            .map(escape).join(',')
        )
      })
    })
    project.enquiries.forEach(enquiry => {
      rows.push(
        [
          enquiry.id, 'enquiry', enquiry.createdAt.toISOString(), enquiry.submitterName,
          enquiry.submitterEmail, enquiry.category, '', '', '',
          `${enquiry.subject}: ${enquiry.message}`,
        ].map(escape).join(',')
      )
    })
    return new NextResponse(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}-feedback-${stamp}.csv"`,
      },
    })
  }

  const analysis = project.analysisResults[0]
  const payload = {
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
    },
    pins: project.publicPins,
    forms: project.feedbackForms.map(form => ({
      id: form.id,
      name: form.name,
      fields: form.fields,
      responses: form.responses,
    })),
    enquiries: project.enquiries,
    analysis: analysis && analysis.status === 'complete' ? analysis.data : null,
  }
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${slug}-export-${stamp}.json"`,
    },
  })
}
