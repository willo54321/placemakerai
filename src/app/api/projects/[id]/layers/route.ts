import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET all geo layers for a project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const layers = await prisma.geoLayer.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(layers.map(layer => ({
    id: layer.id,
    name: layer.name,
    type: layer.type,
    geojson: layer.geojson,
    style: layer.style,
    visible: layer.visible,
    createdAt: layer.createdAt
  })))
}

// POST new geo layer (from parsed shapefile/geojson)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Validate required fields
  if (!body.name || !body.geojson) {
    return NextResponse.json(
      { error: 'Missing required fields: name, geojson' },
      { status: 400 }
    )
  }

  // Validate geojson structure
  if (!body.geojson.type || !['FeatureCollection', 'Feature', 'GeometryCollection'].includes(body.geojson.type)) {
    return NextResponse.json(
      { error: 'Invalid GeoJSON: must be FeatureCollection, Feature, or GeometryCollection' },
      { status: 400 }
    )
  }

  // Wrap single Feature in FeatureCollection if needed
  let geojson = body.geojson
  if (geojson.type === 'Feature') {
    geojson = {
      type: 'FeatureCollection',
      features: [geojson]
    }
  }

  const layer = await prisma.geoLayer.create({
    data: {
      projectId: params.id,
      name: body.name,
      type: body.type || 'boundary',
      geojson: geojson,
      style: body.style || {
        fillColor: '#3B82F6',
        strokeColor: '#1E40AF',
        fillOpacity: 0.3,
        strokeWidth: 2
      },
      visible: body.visible ?? true
    }
  })

  return NextResponse.json({
    id: layer.id,
    name: layer.name,
    type: layer.type,
    geojson: layer.geojson,
    style: layer.style,
    visible: layer.visible,
    createdAt: layer.createdAt
  })
}
