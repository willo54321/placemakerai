import { NextResponse } from 'next/server'
import * as turf from '@turf/turf'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import type { FullAnalysisResult } from '@/lib/ai'

/**
 * Programme-level rollup for a multi-plot project.
 *
 * Computes, from live data, three views the standard analytics tab doesn't:
 *   - per-plot participation + stance (map pins bucketed by point-in-polygon
 *     against the plot boundary layers; survey responses by their plot field)
 *   - participation metrics (totals by channel, a weekly timeline, registrations)
 *   - audience segmentation (from the survey "which best describes you?" field,
 *     plus organisations seen in enquiries and the stakeholder register)
 *
 * Sentiment here is a cheap, generic proxy — pin category and the survey's
 * support question — so this works for any project without a paid AI run. The
 * AI analysis, if present, is used only to label each plot's leading theme.
 */

type Field = { id: string; label: string; type: string; options?: string[] }
type Stance = 'support' | 'neutral' | 'object'

const REGISTER_RE = /register|updates|sign[- ]?up|mailing|newsletter/i
const AUDIENCE_RE = /which best describes|about you|are you a/i
const PLOT_FIELD_RE = /which (part|plot|site|phase)|plot|phase/i
const SUPPORT_RE = /support|do you (support|back)|overall/i

const supportToStance = (value: string): Stance => {
  const v = value.toLowerCase()
  if (v.includes('oppose') || v.includes('object') || v.includes('against')) return 'object'
  if (v.includes('support') || v.includes('favour') || v.includes('favor')) return 'support'
  return 'neutral'
}

const pinToStance = (category: string): Stance => {
  if (category === 'positive') return 'support'
  if (category === 'negative') return 'object'
  return 'neutral'
}

const weekKey = (d: Date): string => {
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

const findField = (fields: Field[], re: RegExp, id?: string): Field | undefined =>
  fields.find(f => (id && f.id === id)) || fields.find(f => re.test(f.label) || re.test(f.id))

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied
  const projectId = params.id

  const [project, plotLayers, pins, forms, enquiries] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    prisma.geoLayer.findMany({ where: { projectId, type: 'plot' }, orderBy: { createdAt: 'asc' } }),
    prisma.publicPin.findMany({ where: { projectId, approved: true, shapeType: 'pin', latitude: { not: null }, longitude: { not: null } } }),
    prisma.feedbackForm.findMany({ where: { projectId }, include: { responses: true } }),
    prisma.enquiry.findMany({ where: { projectId } }),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Stakeholders are optional (schema may be absent in some environments).
  let stakeholders: Array<{ type: string; category: string; organization: string | null }> = []
  try {
    stakeholders = await (prisma as any).stakeholder.findMany({ where: { projectId }, select: { type: true, category: true, organization: true } })
  } catch { /* no stakeholder table here */ }

  // The stored AI analysis, if any — used only for per-plot theme labels.
  const analysisRow = await prisma.analysisResult.findUnique({ where: { projectId_type: { projectId, type: 'full' } } })
  const analysis = (analysisRow?.data as unknown as FullAnalysisResult) || null

  // --- classify forms -----------------------------------------------------
  const registerForm = forms.find(f => REGISTER_RE.test(f.name))
  const surveyForms = forms.filter(f => f.id !== registerForm?.id)
  const registrations = registerForm?.responses ?? []

  // --- plots --------------------------------------------------------------
  type PlotAgg = { key: string; name: string; color: string; pins: number; support: number; neutral: number; object: number; surveyResponses: number; theme: string | null; headline: string | null }
  const plots: PlotAgg[] = plotLayers.map((layer, idx) => {
    const gj = layer.geojson as any
    const feature = gj?.type === 'FeatureCollection' ? gj.features?.[0] : gj
    const props = feature?.properties || {}
    const style = (layer.style as any) || {}
    const spatial = analysis?.spatialInsights?.find(s => s.areaLabel === layer.name)
    return { key: props.plot || String.fromCharCode(65 + idx), name: layer.name, color: style.fillColor || style.strokeColor || '#0E7C86', pins: 0, support: 0, neutral: 0, object: 0, surveyResponses: 0, theme: spatial?.theme ?? null, headline: spatial?.headline ?? null, _geometry: feature?.geometry } as PlotAgg & { _geometry: any }
  }) as any

  // Map pins → plots by point-in-polygon.
  for (const pin of pins) {
    const pt = turf.point([pin.longitude as number, pin.latitude as number])
    for (const p of plots as any[]) {
      if (!p._geometry) continue
      try {
        if (turf.booleanPointInPolygon(pt, p._geometry)) {
          p.pins++
          const s = pinToStance(pin.category)
          p[s]++
          break
        }
      } catch { /* malformed geometry */ }
    }
  }

  // --- survey-derived data (audience, plot attribution, stance) -----------
  const audienceCounts = new Map<string, { count: number; support: number; neutral: number; object: number }>()
  const timeline = new Map<string, { pins: number; forms: number; enquiries: number; registrations: number }>()
  const bump = (map: typeof timeline, key: string, field: keyof ReturnType<() => { pins: number; forms: number; enquiries: number; registrations: number }>) => {
    if (!map.has(key)) map.set(key, { pins: 0, forms: 0, enquiries: 0, registrations: 0 })
    ;(map.get(key) as any)[field]++
  }

  let surveyTotal = 0
  for (const form of surveyForms) {
    const fields = (form.fields as Field[]) || []
    const audienceField = findField(fields, AUDIENCE_RE, 'audience')
    const plotField = findField(fields, PLOT_FIELD_RE, 'plot')
    const supportField = findField(fields, SUPPORT_RE, 'support')
    for (const resp of form.responses) {
      surveyTotal++
      const data = resp.data as Record<string, unknown>
      const stance: Stance = supportField ? supportToStance(String(data[supportField.id] ?? data[supportField.label] ?? '')) : 'neutral'
      // audience
      if (audienceField) {
        const val = String(data[audienceField.id] ?? data[audienceField.label] ?? '').trim()
        if (val) {
          if (!audienceCounts.has(val)) audienceCounts.set(val, { count: 0, support: 0, neutral: 0, object: 0 })
          const a = audienceCounts.get(val)!
          a.count++; a[stance]++
        }
      }
      // plot attribution
      if (plotField) {
        const val = String(data[plotField.id] ?? data[plotField.label] ?? '').trim()
        const plot = (plots as any[]).find(p => p.name === val || val.includes(p.key))
        if (plot) { plot.surveyResponses++; plot[stance]++ }
      }
      bump(timeline, weekKey(resp.submittedAt), 'forms')
    }
  }

  // Registrations + other channels into the timeline.
  registrations.forEach(r => bump(timeline, weekKey(r.submittedAt), 'registrations'))
  pins.forEach(p => bump(timeline, weekKey(p.createdAt), 'pins'))
  enquiries.forEach(e => bump(timeline, weekKey(e.createdAt), 'enquiries'))

  const timelineArr = Array.from(timeline.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([week, v]) => ({ week, ...v }))

  // --- audience segmentation ---------------------------------------------
  const audience = Array.from(audienceCounts.entries())
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.count - a.count)
  const organisations = enquiries.filter(e => e.submitterOrg && e.submitterOrg.trim()).length
  const stakeholdersByStance = stakeholders.reduce(
    (acc, s) => { acc[s.category] = (acc[s.category] || 0) + 1; return acc },
    {} as Record<string, number>
  )
  const stakeholdersByType = stakeholders.reduce(
    (acc, s) => { acc[s.type] = (acc[s.type] || 0) + 1; return acc },
    {} as Record<string, number>
  )

  // --- participation totals ----------------------------------------------
  const totals = {
    pins: pins.length,
    survey: surveyTotal,
    enquiries: enquiries.length,
    registrations: registrations.length,
    stakeholders: stakeholders.length,
    contributions: pins.length + surveyTotal + enquiries.length,
  }

  // strip internal geometry before returning
  const plotsOut = (plots as any[]).map(({ _geometry, ...rest }) => rest)

  return NextResponse.json({
    projectName: project.name,
    plots: plotsOut,
    participation: { totals, timeline: timelineArr },
    audience: { segments: audience, organisations, stakeholdersByStance, stakeholdersByType, stakeholderTotal: stakeholders.length },
  })
}
