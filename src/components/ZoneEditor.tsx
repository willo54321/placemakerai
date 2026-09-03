'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { GoogleMap, PolygonF, DrawingManagerF, useJsApiLoader } from '@react-google-maps/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '@/lib/fetch-json'
import { toast } from 'sonner'
import { Plus, Pencil, Check, Trash2, MapPin } from 'lucide-react'

// Editor for a project's plot/zone boundaries. Zones are stored as GeoLayers of
// type 'plot' (a FeatureCollection with one Polygon). The programme/analytics
// breakdowns and the public embed both read these, so this is the single place
// to draw and reshape them.

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
// Same loader options as every other map in the app.
const LIBRARIES: ('drawing' | 'geometry' | 'visualization')[] = ['drawing', 'geometry', 'visualization']

const PALETTE = ['#0E7C86', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#DC2626']

type Layer = { id: string; name: string; type: string; geojson: any; style: any; visible: boolean }
type LatLng = { lat: number; lng: number }

const getFeature = (l: Layer) => (l.geojson?.type === 'FeatureCollection' ? l.geojson.features?.[0] : l.geojson)
const getRing = (l: Layer): number[][] => getFeature(l)?.geometry?.coordinates?.[0] ?? []
const getProps = (l: Layer): Record<string, any> => getFeature(l)?.properties ?? {}
const ringToPath = (ring: number[][]): LatLng[] =>
  ring.slice(0, ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? -1 : undefined)
    .map(([lng, lat]) => ({ lat, lng }))
const pathToRing = (path: LatLng[]): number[][] => {
  const ring = path.map(p => [p.lng, p.lat])
  if (ring.length) ring.push([ring[0][0], ring[0][1]])
  return ring
}
const buildGeojson = (ring: number[][], props: Record<string, any>) => ({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [ring] } }],
})

export function ZoneEditor({ projectId, project }: { projectId: string; project: any }) {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [satellite, setSatellite] = useState(true)
  const polyRefs = useRef<Record<string, google.maps.Polygon>>({})

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script-embed',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    version: '3.64',
    libraries: LIBRARIES,
  })

  const layersKey = ['layers', projectId]
  const { data: layers } = useQuery<Layer[]>({
    queryKey: layersKey,
    queryFn: () => fetchJson(`/api/projects/${projectId}/layers`),
  })
  const zones = useMemo(() => (layers ?? []).filter(l => l.type === 'plot'), [layers])
  // Latest zones for use inside long-lived Google Maps event listeners.
  const zonesRef = useRef<Layer[]>(zones)
  zonesRef.current = zones
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: layersKey })

  const createZone = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson(`/api/projects/${projectId}/layers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: (created: { id: string }) => { refresh(); setSelectedId(created?.id ?? null); toast.success('Zone added — drag the points to reshape it') },
    onError: (e: Error) => toast.error(e.message || 'Could not add zone'),
  })
  const updateZone = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      fetchJson(`/api/projects/${projectId}/layers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message || 'Could not save zone'),
  })
  const deleteZone = useMutation({
    mutationFn: (id: string) => fetchJson(`/api/projects/${projectId}/layers/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); setSelectedId(null); toast.success('Zone deleted') },
    onError: (e: Error) => toast.error(e.message || 'Could not delete zone'),
  })

  // Read the (possibly edited) path back off the live polygon and persist it.
  // Optimistically update the query cache first so the controlled <PolygonF>
  // path prop reflects the edit and never snaps back to the old shape.
  const saveGeometry = useCallback((id: string) => {
    const poly = polyRefs.current[id]
    const zone = zonesRef.current.find(z => z.id === id)
    if (!poly || !zone) return
    const path: LatLng[] = poly.getPath().getArray().map(ll => ({ lat: ll.lat(), lng: ll.lng() }))
    if (path.length < 3) return
    const geojson = buildGeojson(pathToRing(path), getProps(zone))
    queryClient.setQueryData<Layer[]>(layersKey, old => (old ?? []).map(l => (l.id === id ? { ...l, geojson } : l)))
    updateZone.mutate({ id, geojson })
  }, [updateZone, queryClient])

  const scheduleSave = useCallback((id: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveGeometry(id), 500)
  }, [saveGeometry])

  // Attach path-change listeners so vertex drags/inserts/removes (which don't
  // fire onMouseUp) and whole-shape drags all persist.
  const attachEditListeners = useCallback((id: string, poly: google.maps.Polygon) => {
    polyRefs.current[id] = poly
    const path = poly.getPath()
    const onEdit = () => scheduleSave(id)
    path.addListener('set_at', onEdit)
    path.addListener('insert_at', onEdit)
    path.addListener('remove_at', onEdit)
    poly.addListener('dragend', onEdit)
  }, [scheduleSave])

  const onPolygonComplete = useCallback((poly: google.maps.Polygon) => {
    const path: LatLng[] = poly.getPath().getArray().map(ll => ({ lat: ll.lat(), lng: ll.lng() }))
    poly.setMap(null)
    setDrawing(false)
    if (path.length < 3) return
    const n = zones.length
    const color = PALETTE[n % PALETTE.length]
    const name = `Zone ${n + 1}`
    createZone.mutate({
      name,
      type: 'plot',
      geojson: buildGeojson(pathToRing(path), { name, plot: String.fromCharCode(65 + n), status: '' }),
      style: { fillColor: color, strokeColor: color, fillOpacity: 0.18, strokeWidth: 2 },
      visible: true,
    })
  }, [zones.length, createZone])

  const patchProps = (zone: Layer, patch: Record<string, any>) => {
    const props = { ...getProps(zone), ...patch }
    const body: Record<string, unknown> = { geojson: buildGeojson(getRing(zone), props) }
    if (patch.name !== undefined) body.name = patch.name
    updateZone.mutate({ id: zone.id, ...body })
  }

  const center = { lat: project?.latitude ?? 51.5023, lng: project?.longitude ?? 0.0285 }

  if (!isLoaded) {
    return <div className="h-[540px] rounded-xl bg-slate-100 animate-pulse flex items-center justify-center text-slate-500 text-sm">Loading map…</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div className="relative">
        <GoogleMap
          mapContainerStyle={{ height: '540px', width: '100%', borderRadius: '12px' }}
          center={center}
          zoom={project?.mapZoom ?? 16}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true, mapTypeId: satellite ? 'hybrid' : 'roadmap' }}
        >
          {zones.map(z => {
            const color = z.style?.fillColor || z.style?.strokeColor || '#0E7C86'
            const selected = selectedId === z.id
            return (
              <PolygonF
                key={z.id}
                path={ringToPath(getRing(z))}
                editable={selected}
                draggable={selected}
                onLoad={poly => attachEditListeners(z.id, poly)}
                onUnmount={poly => { window.google?.maps?.event?.clearInstanceListeners(poly.getPath()); window.google?.maps?.event?.clearInstanceListeners(poly); delete polyRefs.current[z.id] }}
                onClick={() => setSelectedId(z.id)}
                options={{
                  fillColor: color,
                  fillOpacity: selected ? 0.32 : 0.18,
                  strokeColor: color,
                  strokeWeight: selected ? 3 : 2,
                  clickable: true,
                  zIndex: selected ? 2 : 1,
                }}
              />
            )
          })}
          {drawing && (
            <DrawingManagerF
              onPolygonComplete={onPolygonComplete}
              options={{
                drawingControl: false,
                drawingMode: (window.google?.maps?.drawing?.OverlayType.POLYGON) as any,
                polygonOptions: { fillColor: '#0E7C86', fillOpacity: 0.25, strokeColor: '#0E7C86', strokeWeight: 2 },
              }}
            />
          )}
        </GoogleMap>
        <button
          onClick={() => setSatellite(s => !s)}
          className="absolute top-3 right-14 bg-white rounded-md shadow px-2.5 py-1 text-xs font-medium text-slate-700"
        >
          {satellite ? 'Map' : 'Satellite'}
        </button>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => { setDrawing(true); setSelectedId(null) }}
          disabled={drawing}
          className="btn-primary w-full justify-center"
        >
          <Plus size={18} aria-hidden="true" />
          {drawing ? 'Click the map to draw…' : 'Add zone'}
        </button>

        {zones.length === 0 && !drawing && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            <MapPin size={22} className="mx-auto mb-2 text-slate-300" aria-hidden="true" />
            No zones yet. Add one to define an area for feedback.
          </div>
        )}

        {zones.map(z => {
          const props = getProps(z)
          const color = z.style?.fillColor || '#0E7C86'
          const selected = selectedId === z.id
          return (
            <div key={z.id} className={`rounded-xl border p-3 ${selected ? 'border-green-400 bg-green-50/40' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={e => updateZone.mutate({ id: z.id, style: { ...z.style, fillColor: e.target.value, strokeColor: e.target.value } })}
                  className="h-6 w-6 cursor-pointer rounded border border-slate-200 bg-white p-0"
                  title="Zone colour"
                />
                <input
                  defaultValue={z.name}
                  onBlur={e => { if (e.target.value.trim() && e.target.value !== z.name) patchProps(z, { name: e.target.value.trim() }) }}
                  className="flex-1 min-w-0 rounded-md border border-slate-200 px-2 py-1 text-sm font-medium text-slate-900"
                />
              </div>
              <input
                defaultValue={props.status ?? ''}
                placeholder="Status (e.g. Outline consented)"
                onBlur={e => { if ((e.target.value ?? '') !== (props.status ?? '')) patchProps(z, { status: e.target.value }) }}
                className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
              />
              <textarea
                defaultValue={props.blurb ?? ''}
                placeholder="Description shown when a visitor clicks this zone"
                rows={2}
                onBlur={e => { if ((e.target.value ?? '') !== (props.blurb ?? '')) patchProps(z, { blurb: e.target.value }) }}
                className="mt-2 w-full resize-none rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setSelectedId(selected ? null : z.id)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${selected ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {selected ? <><Check size={13} /> Done</> : <><Pencil size={13} /> Edit shape</>}
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${z.name}"?`)) deleteZone.mutate(z.id) }}
                  className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
              {selected && <p className="mt-2 text-xs text-slate-400">Drag the points to reshape, or drag the whole zone to move it. Changes save automatically.</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
