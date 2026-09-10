'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import {
  Plus, Trash2, Pencil, ChevronLeft, ChevronUp, ChevronDown, GripVertical,
  Check, X, Play, Link as LinkIcon, Pentagon, MapPin, Crosshair, ImageIcon,
} from 'lucide-react'
import { fetchJson } from '@/lib/fetch-json'
import { TourPlayer } from '@/app/embed/[id]/TourPlayer'
import type { TourData, TourStopData, TourStopHighlight } from '@/app/embed/[id]/TourPlayer'
import type { ImageOverlay as MapOverlay, MapMarker } from '@/components/InteractiveMap'

const InteractiveMap = dynamic(() => import('@/components/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
})

interface Tour extends TourData {
  active: boolean
  stops: TourStopData[]
}

interface DBImageOverlay {
  id: string
  name: string
  imageUrl: string
  southLat: number
  westLng: number
  northLat: number
  eastLng: number
  opacity: number
  rotation: number
  visible: boolean
}

interface ProjectShape {
  latitude: number | null
  longitude: number | null
  mapZoom: number | null
  imageOverlays?: DBImageOverlay[]
}

interface StopDraft {
  title: string
  description: string
  imageUrl: string
  videoUrl: string
  latitude: number | null
  longitude: number | null
  zoom: number
  highlight: TourStopHighlight | null
  showOverlays: string[] | null
}

const EMPTY_DRAFT: StopDraft = {
  title: '',
  description: '',
  imageUrl: '',
  videoUrl: '',
  latitude: null,
  longitude: null,
  zoom: 16,
  highlight: null,
  showOverlays: null,
}

const convertOverlays = (dbOverlays: DBImageOverlay[] | undefined, allowed: string[] | null): MapOverlay[] =>
  (dbOverlays || [])
    .filter(o => o.visible)
    .filter(o => allowed === null || allowed.includes(o.id))
    .map(o => ({
      id: o.id,
      name: o.name,
      imageUrl: o.imageUrl,
      bounds: [[o.southLat, o.westLng], [o.northLat, o.eastLng]] as [[number, number], [number, number]],
      opacity: o.opacity,
      rotation: o.rotation || 0,
      visible: true,
    }))

export function ToursTab({ projectId, project }: { projectId: string; project: ProjectShape }) {
  const queryClient = useQueryClient()

  const defaultCenter: [number, number] = [project.latitude || 51.5074, project.longitude || -0.1278]
  const defaultZoom = project.mapZoom || 15

  // ---- List / editor navigation ----
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  // ---- Editor state ----
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter)
  const [mapZoom, setMapZoom] = useState(defaultZoom)
  const [editingStopId, setEditingStopId] = useState<string | null>(null) // 'new' = unsaved draft
  const [stopDraft, setStopDraft] = useState<StopDraft>(EMPTY_DRAFT)
  const [placing, setPlacing] = useState(false)
  const [drawingSpotlight, setDrawingSpotlight] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [detailsName, setDetailsName] = useState('')
  const [detailsDesc, setDetailsDesc] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewStopIndex, setPreviewStopIndex] = useState(-1)

  const { data: tours = [], isLoading } = useQuery<Tour[]>({
    queryKey: ['tours', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/tours`),
  })

  const tour = tours.find(t => t.id === selectedTourId) || null

  // Recentre the editor map when opening a tour
  useEffect(() => {
    if (!selectedTourId) return
    const selected = tours.find(t => t.id === selectedTourId)
    if (selected && selected.stops.length > 0) {
      setMapCenter([selected.stops[0].latitude, selected.stops[0].longitude])
      setMapZoom(selected.stops[0].zoom)
    } else {
      setMapCenter(defaultCenter)
      setMapZoom(defaultZoom)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTourId])

  // ---- Mutations ----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tours', projectId] })

  const createTour = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      fetchJson(`/api/projects/${projectId}/tours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (created: Tour) => {
      invalidate()
      setCreating(false)
      setNewName('')
      setNewDesc('')
      setSelectedTourId(created.id)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create tour'),
  })

  const updateTour = useMutation({
    mutationFn: ({ tourId, data }: { tourId: string; data: Partial<Pick<Tour, 'name' | 'description' | 'active'>> }) =>
      fetchJson(`/api/projects/${projectId}/tours/${tourId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      setEditingDetails(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update tour'),
  })

  const deleteTour = useMutation({
    mutationFn: (tourId: string) =>
      fetchJson(`/api/projects/${projectId}/tours/${tourId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      setSelectedTourId(null)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete tour'),
  })

  const closeStopForm = () => {
    setEditingStopId(null)
    setStopDraft(EMPTY_DRAFT)
    setPlacing(false)
    setDrawingSpotlight(false)
  }

  const saveStop = useMutation({
    mutationFn: ({ tourId, stopId, data }: { tourId: string; stopId: string | 'new'; data: Record<string, unknown> }) =>
      stopId === 'new'
        ? fetchJson(`/api/projects/${projectId}/tours/${tourId}/stops`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
        : fetchJson(`/api/projects/${projectId}/tours/${tourId}/stops/${stopId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }),
    onSuccess: () => {
      invalidate()
      closeStopForm()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save stop'),
  })

  const deleteStop = useMutation({
    mutationFn: ({ tourId, stopId }: { tourId: string; stopId: string }) =>
      fetchJson(`/api/projects/${projectId}/tours/${tourId}/stops/${stopId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      closeStopForm()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete stop'),
  })

  const reorderStops = useMutation({
    mutationFn: ({ tourId, stops }: { tourId: string; stops: string[] }) =>
      fetchJson(`/api/projects/${projectId}/tours/${tourId}/stops/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stops }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || 'Failed to reorder stops'),
  })

  // ---- Stop form helpers ----
  const openNewStop = () => {
    setEditingStopId('new')
    setStopDraft({ ...EMPTY_DRAFT, zoom: mapZoom })
    setPlacing(true)
    setDrawingSpotlight(false)
    setPreviewing(false)
  }

  const openEditStop = (stop: TourStopData) => {
    setEditingStopId(stop.id)
    setStopDraft({
      title: stop.title,
      description: stop.description,
      imageUrl: stop.imageUrl || '',
      videoUrl: stop.videoUrl || '',
      latitude: stop.latitude,
      longitude: stop.longitude,
      zoom: stop.zoom,
      highlight: stop.highlight,
      showOverlays: stop.showOverlays,
    })
    setPlacing(false)
    setDrawingSpotlight(false)
    setMapCenter([stop.latitude, stop.longitude])
    setMapZoom(stop.zoom)
  }

  const handleMapClick = (lat: number, lng: number) => {
    if (!placing) return
    setStopDraft(d => ({ ...d, latitude: lat, longitude: lng, zoom: mapZoom }))
    setPlacing(false)
  }

  const handleDrawingCreated = (geometry: GeoJSON.Geometry) => {
    if (geometry.type === 'Polygon') {
      setStopDraft(d => ({ ...d, highlight: { type: 'Polygon', coordinates: geometry.coordinates as number[][][] } }))
      setDrawingSpotlight(false)
    }
  }

  const captureView = () => {
    setStopDraft(d => ({ ...d, latitude: mapCenter[0], longitude: mapCenter[1], zoom: mapZoom }))
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Images must be 4MB or smaller')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setStopDraft(d => ({ ...d, imageUrl: data.url }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSaveStop = () => {
    if (!tour || stopDraft.latitude === null || stopDraft.longitude === null) return
    saveStop.mutate({
      tourId: tour.id,
      stopId: (editingStopId || 'new') as string | 'new',
      data: {
        title: stopDraft.title,
        description: stopDraft.description,
        imageUrl: stopDraft.imageUrl.trim() || null,
        videoUrl: stopDraft.videoUrl.trim() || null,
        latitude: stopDraft.latitude,
        longitude: stopDraft.longitude,
        zoom: stopDraft.zoom,
        highlight: stopDraft.highlight,
        showOverlays: stopDraft.showOverlays,
      },
    })
  }

  const moveStop = (from: number, to: number) => {
    if (!tour || to < 0 || to >= tour.stops.length) return
    const order = tour.stops.map(s => s.id)
    const [moved] = order.splice(from, 1)
    order.splice(to, 0, moved)
    reorderStops.mutate({ tourId: tour.id, stops: order })
  }

  const copyEmbedLink = (tourId: string) => {
    const url = `${window.location.origin}/embed/${projectId}/tour?tour=${tourId}`
    navigator.clipboard.writeText(url).then(
      () => toast.success('Tour embed link copied'),
      () => toast.error('Could not copy the link')
    )
  }

  // ---- Map content for the editor ----
  const formOpen = editingStopId !== null
  const previewStop = previewing && tour && previewStopIndex >= 0 ? tour.stops[previewStopIndex] : null

  const editorMarkers: MapMarker[] = useMemo(() => {
    if (!tour || previewing) return []
    const markers: MapMarker[] = []
    tour.stops.forEach((stop, idx) => {
      const isEditing = editingStopId === stop.id
      markers.push({
        id: stop.id,
        label: String(idx + 1),
        latitude: isEditing ? stopDraft.latitude ?? stop.latitude : stop.latitude,
        longitude: isEditing ? stopDraft.longitude ?? stop.longitude : stop.longitude,
        color: isEditing ? '#F59E0B' : '#16A34A',
        notes: stop.title,
      })
    })
    if (editingStopId === 'new' && stopDraft.latitude !== null && stopDraft.longitude !== null) {
      markers.push({
        id: 'new-stop',
        label: String(tour.stops.length + 1),
        latitude: stopDraft.latitude,
        longitude: stopDraft.longitude,
        color: '#F59E0B',
        notes: null,
      })
    }
    return markers
  }, [tour, previewing, editingStopId, stopDraft.latitude, stopDraft.longitude])

  const overlayFilter = previewing
    ? (previewStop ? previewStop.showOverlays : null)
    : (formOpen ? stopDraft.showOverlays : null)
  const editorOverlays = useMemo(
    () => convertOverlays(project.imageOverlays, overlayFilter),
    [project.imageOverlays, overlayFilter]
  )

  const spotlight = previewing
    ? (previewStop?.highlight ?? null)
    : (formOpen ? stopDraft.highlight : null)

  const projectOverlays = (project.imageOverlays || []).filter(o => o.visible)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    )
  }

  // ================= LIST VIEW =================
  if (!tour) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">Guided Tours</h2>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={16} />
              New Tour
            </button>
          )}
        </div>

        {creating && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Masterplan walkthrough"
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Introduction (optional)</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Shown on the tour's opening screen"
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => createTour.mutate({ name: newName, description: newDesc })}
                disabled={!newName.trim() || createTour.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTour.isPending ? 'Creating…' : 'Create Tour'}
              </button>
              <button
                onClick={() => { setCreating(false); setNewName(''); setNewDesc('') }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {tours.length === 0 && !creating ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
            <MapPin size={32} className="mx-auto text-slate-400 mb-3" />
            <p className="text-slate-600 font-medium">No tours yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tours.map(t => (
              <div
                key={t.id}
                className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <button onClick={() => setSelectedTourId(t.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 truncate">{t.name}</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {t.active ? 'Live' : 'Draft'}
                    </span>
                  </div>
                  {t.description && <p className="text-sm text-slate-500 truncate mt-0.5">{t.description}</p>}
                  <p className="text-xs text-slate-400 mt-1">{t.stops.length} stop{t.stops.length !== 1 ? 's' : ''}</p>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyEmbedLink(t.id)}
                    title="Copy embed link"
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    <LinkIcon size={17} />
                  </button>
                  <button
                    onClick={() => updateTour.mutate({ tourId: t.id, data: { active: !t.active } })}
                    title={t.active ? 'Unpublish' : 'Publish'}
                    className={`relative w-11 h-6 rounded-full transition-colors ${t.active ? 'bg-green-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        t.active ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => setSelectedTourId(t.id)}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${t.name}"? Feedback left on its stops is kept.`)) {
                        deleteTour.mutate(t.id)
                      }
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ================= EDITOR VIEW =================
  const draftPositioned = stopDraft.latitude !== null && stopDraft.longitude !== null
  const canSaveStop = draftPositioned && stopDraft.title.trim() && stopDraft.description.trim()

  return (
    <div className="space-y-4">
      {/* Editor header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => { setSelectedTourId(null); closeStopForm(); setPreviewing(false) }}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            title="Back to tours"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-slate-900 truncate">{tour.name}</h2>
          <button
            onClick={() => {
              setEditingDetails(!editingDetails)
              setDetailsName(tour.name)
              setDetailsDesc(tour.description || '')
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
            title="Edit name and introduction"
          >
            <Pencil size={15} />
          </button>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              tour.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {tour.active ? 'Live' : 'Draft'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => copyEmbedLink(tour.id)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700"
          >
            <LinkIcon size={15} />
            Embed link
          </button>
          <button
            onClick={() => {
              if (previewing) {
                setPreviewing(false)
              } else {
                closeStopForm()
                setPreviewing(true)
                setPreviewStopIndex(-1)
              }
            }}
            disabled={tour.stops.length === 0}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              previewing
                ? 'bg-slate-800 border-slate-800 text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {previewing ? <X size={15} /> : <Play size={15} />}
            {previewing ? 'Exit preview' : 'Preview'}
          </button>
          <button
            onClick={() => updateTour.mutate({ tourId: tour.id, data: { active: !tour.active } })}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tour.active
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {tour.active ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Tour details editing */}
      {editingDetails && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={detailsName}
              onChange={e => setDetailsName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Introduction</label>
            <textarea
              value={detailsDesc}
              onChange={e => setDetailsDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => updateTour.mutate({ tourId: tour.id, data: { name: detailsName, description: detailsDesc } })}
              disabled={!detailsName.trim() || updateTour.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {updateTour.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditingDetails(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Map editor */}
      <div className="relative rounded-xl overflow-hidden shadow-lg border border-gray-200" style={{ height: '640px', width: '100%' }}>
        <div style={{ height: '640px', width: '100%' }}>
          <InteractiveMap
            center={mapCenter}
            zoom={mapZoom}
            markers={editorMarkers}
            overlays={editorOverlays}
            spotlightPolygon={spotlight ? { coordinates: spotlight.coordinates, strokeColor: '#F59E0B', strokeWeight: 3 } : null}
            isAddingMarker={placing && !drawingSpotlight}
            isDrawingMode={drawingSpotlight}
            activeDrawingTool={drawingSpotlight ? 'polygon' : null}
            activeDrawingColor="#F59E0B"
            onMapClick={handleMapClick}
            onDrawingCreated={handleDrawingCreated}
            onBoundsChange={(center: [number, number], zoom: number) => {
              setMapCenter(center)
              setMapZoom(zoom)
            }}
          />
        </div>

        {/* Placing / drawing hints */}
        {placing && !drawingSpotlight && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg">
            Click the map to place this stop
          </div>
        )}
        {drawingSpotlight && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg">
            Draw the spotlight area — double-click to finish
          </div>
        )}

        {/* Preview: the real public player against this map */}
        {previewing && (
          <TourPlayer
            tours={[tour]}
            tour={tour}
            stopIndex={previewStopIndex}
            onTourSelect={() => {}}
            onStopIndexChange={idx => {
              setPreviewStopIndex(idx)
              const stop = tour.stops[idx]
              if (stop) {
                setMapCenter([stop.latitude, stop.longitude])
                setMapZoom(stop.zoom)
              }
            }}
            onClose={() => setPreviewing(false)}
            responsesByStop={new Map()}
            canRespond={false}
            onSubmitResponse={async () => {}}
          />
        )}

        {/* Left panel: stop list or stop form */}
        {!previewing && (
          <div className="absolute top-4 left-4 bottom-4 z-10 w-[340px] max-w-[calc(100%-2rem)] bg-white rounded-xl shadow-xl flex flex-col overflow-hidden">
            {!formOpen ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">Stops</h3>
                  <button
                    onClick={openNewStop}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    <Plus size={15} />
                    Add stop
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {tour.stops.length === 0 ? (
                    <div className="text-center py-10 px-4">
                      <MapPin size={28} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">No stops yet</p>
                    </div>
                  ) : (
                    tour.stops.map((stop, idx) => (
                      <div
                        key={stop.id}
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex !== null && dragIndex !== idx) moveStop(dragIndex, idx)
                          setDragIndex(null)
                        }}
                        onDragEnd={() => setDragIndex(null)}
                        className={`group flex items-center gap-2 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer ${
                          dragIndex === idx ? 'opacity-40' : ''
                        }`}
                        onClick={() => openEditStop(stop)}
                      >
                        <GripVertical size={15} className="text-slate-300 group-hover:text-slate-400 cursor-grab shrink-0" />
                        <span className="w-6 h-6 shrink-0 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{stop.title}</p>
                          <div className="flex items-center gap-2">
                            {stop.highlight && (
                              <span className="flex items-center gap-1 text-[11px] text-amber-600">
                                <Pentagon size={10} /> Spotlight
                              </span>
                            )}
                            {stop.imageUrl && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <ImageIcon size={10} /> Image
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => moveStop(idx, idx - 1)}
                            disabled={idx === 0}
                            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-20"
                            aria-label="Move up"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => moveStop(idx, idx + 1)}
                            disabled={idx === tour.stops.length - 1}
                            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-20"
                            aria-label="Move down"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <button
                    onClick={closeStopForm}
                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
                  >
                    <ChevronLeft size={15} /> Stops
                  </button>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    {editingStopId === 'new' ? 'New stop' : 'Edit stop'}
                  </h3>
                  {editingStopId !== 'new' ? (
                    <button
                      onClick={() => {
                        if (confirm('Delete this stop? Feedback left on it is kept.')) {
                          deleteStop.mutate({ tourId: tour.id, stopId: editingStopId as string })
                        }
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      title="Delete stop"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : (
                    <span className="w-7" />
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Position & view */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">Position &amp; view</label>
                      {draftPositioned ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Check size={12} /> Zoom {Number(stopDraft.zoom).toFixed(1).replace(/\.0$/, '')}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Not placed</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">The tour flies to the stop&apos;s marker at its saved zoom.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPlacing(!placing)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-colors ${
                          placing
                            ? 'border-slate-800 bg-slate-800 text-white'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <MapPin size={13} />
                        {placing ? 'Click map…' : draftPositioned ? 'Move stop' : 'Place stop'}
                      </button>
                      <button
                        type="button"
                        onClick={captureView}
                        title="Centre the stop on the current map view and save its zoom"
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border-2 border-slate-200 text-slate-600 hover:border-slate-300 transition-colors"
                      >
                        <Crosshair size={13} />
                        Capture view
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={stopDraft.title}
                      onChange={e => setStopDraft(d => ({ ...d, title: e.target.value }))}
                      placeholder="e.g. Access and movement"
                      maxLength={120}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={stopDraft.description}
                      onChange={e => setStopDraft(d => ({ ...d, description: e.target.value }))}
                      rows={5}
                      maxLength={4000}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    />
                  </div>

                  {/* Spotlight */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Spotlight</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setDrawingSpotlight(!drawingSpotlight); setPlacing(false) }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-colors ${
                          drawingSpotlight
                            ? 'border-amber-400 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Pentagon size={13} />
                        {drawingSpotlight ? 'Drawing…' : stopDraft.highlight ? 'Redraw' : 'Draw area'}
                      </button>
                      {stopDraft.highlight && !drawingSpotlight && (
                        <button
                          type="button"
                          onClick={() => setStopDraft(d => ({ ...d, highlight: null }))}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <X size={13} /> Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Image */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Image</label>
                    {stopDraft.imageUrl ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={stopDraft.imageUrl}
                          alt=""
                          className="w-full h-28 object-cover rounded-lg border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => setStopDraft(d => ({ ...d, imageUrl: '' }))}
                          className="absolute top-1.5 right-1.5 p-1 bg-white/90 hover:bg-white rounded-full shadow"
                          aria-label="Remove image"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <label className={`flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-lg text-xs font-medium text-slate-500 hover:border-slate-300 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        <ImageIcon size={14} />
                        {uploading ? 'Uploading…' : 'Upload image'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                    )}
                  </div>

                  {/* Video */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Video URL</label>
                    <input
                      type="text"
                      value={stopDraft.videoUrl}
                      onChange={e => setStopDraft(d => ({ ...d, videoUrl: e.target.value }))}
                      placeholder="YouTube or Vimeo link"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    />
                  </div>

                  {/* Overlay visibility */}
                  {projectOverlays.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Overlays shown at this stop</label>
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={stopDraft.showOverlays === null}
                          onChange={e =>
                            setStopDraft(d => ({ ...d, showOverlays: e.target.checked ? null : projectOverlays.map(o => o.id) }))
                          }
                          className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                        />
                        All overlays
                      </label>
                      {stopDraft.showOverlays !== null && (
                        <div className="pl-6 space-y-1.5">
                          {projectOverlays.map(o => (
                            <label key={o.id} className="flex items-center gap-2 text-sm text-slate-600">
                              <input
                                type="checkbox"
                                checked={stopDraft.showOverlays?.includes(o.id) ?? false}
                                onChange={e =>
                                  setStopDraft(d => ({
                                    ...d,
                                    showOverlays: e.target.checked
                                      ? [...(d.showOverlays || []), o.id]
                                      : (d.showOverlays || []).filter(id => id !== o.id),
                                  }))
                                }
                                className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                              />
                              <span className="truncate">{o.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={closeStopForm}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveStop}
                    disabled={!canSaveStop || saveStop.isPending}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saveStop.isPending ? 'Saving…' : 'Save stop'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
