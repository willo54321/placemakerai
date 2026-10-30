/**
 * Elgin — Stone Pit Lane illustrative masterplan (v2, 28 Oct 2026) as
 * interactive map layers on the existing Elgin project.
 *
 * Source: the client's GeoJSON export of the plan ("Stone Pit Lane -
 * Illustrative Masterplan v2.geojson"), split by legend item into
 * prisma/data/elgin-stone-pit-lane/. Each item becomes one `plot` GeoLayer,
 * styled to match the plan's key. The public map lists them in its key
 * (legend order) with toggles; polygons, lines and points are all clickable.
 *
 * Target project: ELGIN_PROJECT_ID if set, otherwise the one project whose name
 * contains "Stone Pit" or "Elgin". Replaces earlier copies of these layers
 * (matched by current or previous name) and leaves everything else on the
 * project alone.
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

// Site centre (middle of the site boundary and mitigation area).
const CENTRE = { lat: 53.5591, lng: -0.2441, zoom: 15 }

type LayerDef = { file: string; name: string; style: Prisma.InputJsonObject }

// Legend order from the plan (the key lists layers in creation order). The
// diagonal-stripe PV fill becomes a light tint, as map polygons can't hatch.
// `icon` is a shared marker glyph: points draw as Placemaker pins, lines carry
// badges along their length.
const LAYERS: LayerDef[] = [
  { file: 'boundary', name: 'Proposed site boundary', style: { fillColor: '#64BD31', strokeColor: '#FF0000', fillOpacity: 0.5, strokeWidth: 1.5 } },
  { file: 'pv', name: 'Proposed solar PV', style: { fillColor: '#C7B132', strokeColor: '#FCFF99', fillOpacity: 0.3, strokeWidth: 1.5 } },
  { file: 'hedgerow', name: 'Proposed hedgerows', style: { fillColor: '#165E22', strokeColor: '#165E22', fillOpacity: 0, strokeWidth: 4, lineStyle: 'dashed' } },
  { file: 'prow', name: 'Public Right of Way', style: { fillColor: '#F200FF', strokeColor: '#F200FF', fillOpacity: 0, strokeWidth: 3, lineStyle: 'dotted', icon: 'walk' } },
  { file: 'access', name: 'Potential access points', style: { fillColor: '#2563EB', strokeColor: '#2563EB', fillOpacity: 1, strokeWidth: 2, icon: 'entrance' } },
  { file: 'substation', name: 'Proposed substation location', style: { fillColor: '#F5A623', strokeColor: '#F5A623', fillOpacity: 1, strokeWidth: 2, icon: 'power' } },
  { file: 'mitigation', name: 'Proposed mitigation and enhancement', style: { fillColor: '#64BD31', strokeColor: '#FF0000', fillOpacity: 0.5, strokeWidth: 1.5 } },
]

// v1 (27 Oct) layer names that v2 renamed — removed so the key has no duplicates.
const PREVIOUS_NAMES = ['Proposed Solar PV', 'Proposed hedgerow', 'Potential access point', 'Proposed mitigation and enhancement areas']

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

  const removed = await prisma.geoLayer.deleteMany({ where: { projectId: project.id, name: { in: [...LAYERS.map(l => l.name), ...PREVIOUS_NAMES] } } })
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
