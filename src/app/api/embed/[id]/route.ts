import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// Public API - no auth required
// Returns project data for embedding (if embedEnabled)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      imageOverlays: {
        where: { visible: true },
        orderBy: { createdAt: 'asc' }
      },
      publicPins: {
        where: { approved: true }, // Only show approved pins publicly
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
    overlays: project.imageOverlays.map(o => ({
      id: o.id,
      name: o.name,
      imageUrl: o.imageUrl,
      bounds: [[o.southLat, o.westLng], [o.northLat, o.eastLng]],
      opacity: o.opacity
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
        showOverlay: s.showOverlay
      }))
    } : null
  })
}
