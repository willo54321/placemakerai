import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// Public API - no auth required
// Returns project data for embedding (if embedEnabled)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') || 'feedback'

  // Build pin filter based on mode
  const pinFilter: { approved: boolean; mode: string; resolved?: boolean } = {
    approved: true,
    mode: mode
  }

  // For issues mode, hide resolved issues from public view
  if (mode === 'issues') {
    pinFilter.resolved = false
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      imageOverlays: {
        where: { visible: true },
        orderBy: { createdAt: 'asc' }
      },
      publicPins: {
        where: pinFilter,
        orderBy: { createdAt: 'desc' }
      },
      tours: {
        where: { active: true },
        include: {
          stops: {
            orderBy: { order: 'asc' }
          }
        },
        take: 1 // Only get the first active tour for now
      }
    }
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.embedEnabled) {
    return NextResponse.json({ error: 'Embedding not enabled for this project' }, { status: 403 })
  }

  // For issues mode, check if issues are enabled
  if (mode === 'issues' && !project.issuesEnabled) {
    return NextResponse.json({ error: 'Issue reporting not enabled for this project' }, { status: 403 })
  }

  // Return only public-safe data
  return NextResponse.json({
    id: project.id,
    name: project.name,
    description: project.description,
    latitude: project.latitude,
    longitude: project.longitude,
    mapZoom: project.mapZoom,
    allowPins: project.allowPins,
    allowDrawing: project.allowDrawing,
    issuesEnabled: project.issuesEnabled,
    mode: mode,
    // Styling customization
    embedPrimaryColor: project.embedPrimaryColor,
    embedFontFamily: project.embedFontFamily,
    embedHideStreetLabels: project.embedHideStreetLabels,
    overlays: project.imageOverlays.map(o => ({
      id: o.id,
      name: o.name,
      imageUrl: o.imageUrl,
      bounds: [[o.southLat, o.westLng], [o.northLat, o.eastLng]],
      opacity: o.opacity,
      rotation: o.rotation
    })),
    pins: project.publicPins.map(p => ({
      id: p.id,
      shapeType: p.shapeType,
      latitude: p.latitude,
      longitude: p.longitude,
      geometry: p.geometry,
      category: p.category,
      comment: p.comment,
      name: p.name,
      votes: p.votes,
      createdAt: p.createdAt
    })),
    tour: project.tours[0] ? {
      id: project.tours[0].id,
      name: project.tours[0].name,
      description: project.tours[0].description,
      stops: project.tours[0].stops.map(s => ({
        id: s.id,
        order: s.order,
        title: s.title,
        description: s.description,
        imageUrl: s.imageUrl,
        latitude: s.latitude,
        longitude: s.longitude,
        zoom: s.zoom,
        highlight: s.highlight,
        showOverlay: s.showOverlay,
        icon: s.icon
      }))
    } : null
  })
}
