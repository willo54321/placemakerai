import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// CORS headers for cross-origin embedding
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// Public API - no auth required
// Returns panorama data for embedding (if panoramaEnabled)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      panoramas: {
        where: { active: true },
        include: {
          hotspots: true
        },
        orderBy: { order: 'asc' }
      }
    }
  })

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404, headers: corsHeaders }
    )
  }

  if (!project.embedEnabled) {
    return NextResponse.json(
      { error: 'Embedding not enabled for this project' },
      { status: 403, headers: corsHeaders }
    )
  }

  if (!project.panoramaEnabled) {
    return NextResponse.json(
      { error: 'Panorama viewing not enabled for this project' },
      { status: 403, headers: corsHeaders }
    )
  }

  if (project.panoramas.length === 0) {
    return NextResponse.json(
      { error: 'No panoramas available for this project' },
      { status: 404, headers: corsHeaders }
    )
  }

  // Return public-safe data
  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      embedPrimaryColor: project.embedPrimaryColor,
      embedFontFamily: project.embedFontFamily,
    },
    panoramas: project.panoramas.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      initialYaw: p.initialYaw,
      initialPitch: p.initialPitch,
      initialFov: p.initialFov,
      order: p.order,
      hotspots: p.hotspots.map(h => ({
        id: h.id,
        type: h.type,
        yaw: h.yaw,
        pitch: h.pitch,
        title: h.title,
        content: h.content,
        icon: h.icon,
        targetId: h.targetId,
        videoUrl: h.videoUrl,
        imageUrl: h.imageUrl,
      }))
    }))
  }, { headers: corsHeaders })
}
