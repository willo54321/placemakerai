import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// Public form config for the /forms/[id] page and external embeds. Gated the
// same way as submissions (form active + project embedding enabled) and
// trimmed to the fields a visitor needs — never the raw row.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const form = await prisma.feedbackForm.findUnique({
    where: { id: params.id },
    include: { Project: { select: { embedEnabled: true, name: true } } },
  })
  if (!form || !form.active || !form.Project.embedEnabled) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }
  return NextResponse.json({
    id: form.id,
    name: form.name,
    fields: form.fields,
    projectName: form.Project.name,
  })
}
