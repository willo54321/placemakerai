/**
 * Elgin — Stone Pit Lane illustrative masterplan (Oct 2026) as interactive map
 * layers on the existing Elgin project.
 *
 * The client's plan is a Mapbox print (raster, EPSG:25830 frame). Each legend
 * item was digitised from it into WGS84 GeoJSON (prisma/data/elgin-stone-pit-lane/)
 * and becomes one `plot` GeoLayer, styled to match the plan's key. The public
 * map lists them in its key (legend order) with toggles; polygons, lines and
 * points are all clickable.
 *
 * Target project: ELGIN_PROJECT_ID if set, otherwise the one project whose name
 * contains "Stone Pit" or "Elgin". Replaces earlier copies of these layers
 * (matched by name) and leaves everything else on the project alone.
 *
 * Run locally:   npx tsx prisma/seed-elgin-masterplan.ts
 * Run on prod:   npm run seed:elgin:prod   (user runs it)
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DATA = join(__dirname, 'data', 'elgin-stone-pit-lane')

// Site centre (from the digitised boundary) — Patcham Court Farm style: set once.
const CENTRE = { lat: 53.5591, lng: -0.2441, zoom: 15 }

type LayerDef = { file: string; name: string; style: Prisma.InputJsonObject }

// Legend order from the plan (the key lists layers in creation order).
const LAYERS: LayerDef[] = [
  { file: 'boundary', name: 'Proposed site boundary', style: { fillColor: '#DC2626', strokeColor: '#DC2626', fillOpacity: 0, strokeWidth: 3 } },
  { file: 'hedgerow', name: 'Proposed hedgerow', style: { fillColor: '#166534', strokeColor: '#166534', fillOpacity: 0, strokeWidth: 3, lineStyle: 'dotted' } },
  { file: 'pv', name: 'Proposed Solar PV', style: { fillColor: '#EAB308', strokeColor: '#CA8A04', fillOpacity: 0.35, strokeWidth: 1.5 } },
  { file: 'prow', name: 'Public Right of Way', style: { fillColor: '#D946EF', strokeColor: '#D946EF', fillOpacity: 0, strokeWidth: 3, lineStyle: 'dashed' } },
  { file: 'access', name: 'Potential access point', style: { fillColor: '#2563EB', strokeColor: '#2563EB', fillOpacity: 1, strokeWidth: 2 } },
  { file: 'substation', name: 'Proposed substation location', style: { fillColor: '#F59E0B', strokeColor: '#F59E0B', fillOpacity: 1, strokeWidth: 2 } },
  { file: 'mitigation', name: 'Proposed mitigation and enhancement areas', style: { fillColor: '#65A30D', strokeColor: '#4D7C0F', fillOpacity: 0.35, strokeWidth: 1.5 } },
]

async function findProject() {
  if (process.env.ELGIN_PROJECT_ID) {
    const p = await prisma.project.findUnique({ where: { id: process.env.ELGIN_PROJECT_ID } })
    if (!p) throw new Error(`ELGIN_PROJECT_ID ${process.env.ELGIN_PROJECT_ID} not found`)
    return p
  }
  const matches = await prisma.project.findMany({
    where: { OR: [{ name: { contains: 'Stone Pit', mode: 'insensitive' } }, { name: { contains: 'Elgin', mode: 'insensitive' } }] },
    orderBy: { createdAt: 'asc' },
  })
  if (matches.length === 1) return matches[0]
  if (matches.length === 0) throw new Error('No project named like "Elgin" / "Stone Pit" — set ELGIN_PROJECT_ID')
  throw new Error(`Several candidate projects — set ELGIN_PROJECT_ID to one of: ${matches.map(m => `${m.id} (${m.name})`).join(', ')}`)
}

async function main() {
  const project = await findProject()
  console.log(`Seeding Stone Pit Lane masterplan into "${project.name}" (${project.id})…`)

  await prisma.project.update({
    where: { id: project.id },
    data: {
      latitude: CENTRE.lat, longitude: CENTRE.lng, mapZoom: CENTRE.zoom,
      embedEnabled: true,
      // Elgin brand navy (the ELGIN wordmark / website header), satellite base,
      // and reference mode: the public map shows the plan and its key only.
      embedPrimaryColor: '#005480',
      embedDefaultSatellite: true,
      embedReferenceOnly: true,
    },
  })

  const removed = await prisma.geoLayer.deleteMany({ where: { projectId: project.id, name: { in: LAYERS.map(l => l.name) } } })
  if (removed.count) console.log(`  replaced ${removed.count} existing masterplan layer(s)`)

  for (const def of LAYERS) {
    const geojson = JSON.parse(readFileSync(join(DATA, `${def.file}.geojson`), 'utf8'))
    await prisma.geoLayer.create({
      data: { projectId: project.id, name: def.name, type: 'plot', geojson, style: def.style, visible: true },
    })
    console.log(`  ${def.name}: ${geojson.features.length} feature(s)`)
  }

  const base = process.env.NEXTAUTH_URL || 'http://localhost:3002'
  console.log(`Done. Embed: ${base}/embed/${project.id}   Dashboard: ${base}/projects/${project.id}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
