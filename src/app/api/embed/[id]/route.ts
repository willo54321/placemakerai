import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// Public API - no auth required
// Returns project data for embedding (if embedEnabled)
export async function GET(request: Request, props0: { params: Promise<{ id: string }> }) {
  const params = await props0.params;
  // ?mode=issues serves the construction-issue reporter embed: same project
  // config, but the pin set is the approved issue reports (open and resolved,
  // so the reporter page can show a "you said, we did" log).
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') === 'issues' ? 'issues' : 'feedback'

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      imageOverlays: {
        where: { visible: true },
        orderBy: { createdAt: 'asc' }
      },
      publicPins: {
        where: { approved: true, mode },
        orderBy: { createdAt: 'desc' }
      },
      geoLayers: {
        where: { type: 'plot', visible: true },
        orderBy: { createdAt: 'asc' }
      },
      tours: {
        where: { active: true },
        include: { stops: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.embedEnabled) {
    return NextResponse.json({ error: 'Embedding not enabled for this project' }, { status: 403 })
  }

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
    mode,
    // Styling customization
    embedPrimaryColor: project.embedPrimaryColor,
    embedFontFamily: project.embedFontFamily,
    embedHideStreetLabels: project.embedHideStreetLabels,
    embedReferenceOnly: project.embedReferenceOnly,
    embedDefaultSatellite: project.embedDefaultSatellite,
    overlays: project.imageOverlays.map(o => ({
      id: o.id,
      name: o.name,
      imageUrl: o.imageUrl,
      bounds: [[o.southLat, o.westLng], [o.northLat, o.eastLng]],
      opacity: o.opacity,
      rotation: o.rotation
    })),
    // No name/email here: submitter identity never appears on public surfaces.
    pins: project.publicPins.map(p => ({
      id: p.id,
      shapeType: p.shapeType,
      latitude: p.latitude,
      longitude: p.longitude,
      geometry: p.geometry,
      category: p.category,
      comment: p.comment,
      votes: p.votes,
      createdAt: p.createdAt,
      tourStopId: p.tourStopId,
      ...(mode === 'issues' ? {
        photoUrl: p.photoUrl,
        resolved: p.resolved,
        resolvedAt: p.resolvedAt,
        resolvedNotes: p.resolvedNotes,
      } : {})
    })),
    tours: project.tours
      .filter(t => t.stops.length > 0)
      .map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        stops: t.stops.map(s => ({
          id: s.id,
          order: s.order,
          title: s.title,
          description: s.description,
          imageUrl: s.imageUrl,
          videoUrl: s.videoUrl,
          latitude: s.latitude,
          longitude: s.longitude,
          zoom: s.zoom,
          highlight: s.highlight,
          showOverlays: s.showOverlays,
          icon: s.icon
        }))
      })),
    zones: project.geoLayers.map(l => {
      const feature = (l.geojson as any)?.type === 'FeatureCollection' ? (l.geojson as any).features?.[0] : (l.geojson as any)
      const props = feature?.properties || {}
      const style = (l.style as any) || {}
      return {
        id: l.id,
        name: l.name,
        status: props.status || '',
        blurb: props.blurb || '',
        color: style.fillColor || style.strokeColor || '#0E7C86',
        geometry: feature?.geometry ?? null,
      }
    })
  })
}
