'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X, Pentagon, Minus, Eye, EyeOff, Upload, Save, ChevronLeft, ChevronRight, Image, ZoomIn, Map, Code, MessageCircle, Globe, Copy, Check, ThumbsUp, ThumbsDown, HelpCircle, ExternalLink, Clock, CheckCircle, XCircle, FileUp, Layers, MapPinned } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Direct dynamic import - bypass MapWrapper to test if wrapper is causing issues
const InteractiveMap = dynamic(
  () => import('@/components/InteractiveMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-gray-500">Loading map...</div>
      </div>
    )
  }
)

// Import utilities from separate file to avoid SSR issues with Google Maps
import { calculateDrawingMetrics } from '@/lib/map-utils'
import type { ImageOverlay } from '@/components/InteractiveMap'

interface MapMarker {
  id: string
  label: string
  type?: 'point' | 'polygon' | 'line'
  latitude?: number | null
  longitude?: number | null
  geometry?: any
  color: string
  notes: string | null
}

interface MapDrawing {
  id: string
  type: 'polygon' | 'line'
  geometry: any
  label: string
  color: string
  notes?: string
  area?: number
  length?: number
}

interface GeoJSONGeometry {
  type: 'LineString' | 'Polygon'
  coordinates: number[][] | number[][][]
}

interface PublicPin {
  id: string
  shapeType: 'pin' | 'line' | 'polygon'
  latitude: number | null
  longitude: number | null
  geometry: GeoJSONGeometry | null
  category: string
  comment: string
  name: string | null
  email: string | null
  approved: boolean
  votes: number
  createdAt: string
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
  visible: boolean
}

interface GeoLayer {
  id: string
  name: string
  type: string
  geojson: any
  style: {
    fillColor: string
    strokeColor: string
    fillOpacity: number
    strokeWidth: number
  }
  visible: boolean
  createdAt: string
}

const LAYER_TYPES = [
  { value: 'boundary', label: 'Site Boundary', color: '#EF4444' },
  { value: 'zone', label: 'Zone', color: '#F59E0B' },
  { value: 'building', label: 'Building', color: '#3B82F6' },
  { value: 'road', label: 'Road', color: '#6B7280' },
  { value: 'path', label: 'Path', color: '#10B981' },
  { value: 'other', label: 'Other', color: '#8B5CF6' },
]

interface Project {
  id: string
  name: string
  embedEnabled: boolean
  allowPins: boolean
  allowDrawing: boolean
  latitude: number | null
  longitude: number | null
  mapZoom: number | null
  mapMarkers: MapMarker[]
  publicPins: PublicPin[]
  imageOverlays: DBImageOverlay[]
}

const CATEGORY_CONFIG: Record<string, { color: string; icon: any; label: string; bg: string }> = {
  positive: { color: '#10B981', icon: ThumbsUp, label: 'Support', bg: '#ECFDF5' },
  negative: { color: '#EF4444', icon: ThumbsDown, label: 'Concern', bg: '#FEF2F2' },
  question: { color: '#F59E0B', icon: HelpCircle, label: 'Question', bg: '#FFFBEB' },
  comment: { color: '#6366F1', icon: MessageCircle, label: 'Comment', bg: '#EEF2FF' },
}

export function MapTab({ projectId, project }: { projectId: string; project: Project }) {
  const queryClient = useQueryClient()
  const mapRef = useRef<{ fitToOverlay: (bounds: [[number, number], [number, number]]) => void } | null>(null)

  // Map state
  const [showForm, setShowForm] = useState(false)
  const [isAddingMarker, setIsAddingMarker] = useState(false)
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [activeDrawingTool, setActiveDrawingTool] = useState<'polygon' | 'line' | null>(null)
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingDrawing, setPendingDrawing] = useState<{ geometry: any; type: 'polygon' | 'line' } | null>(null)

  // Convert DB overlays to component format
  const convertOverlays = (dbOverlays: DBImageOverlay[] | undefined): ImageOverlay[] =>
    (dbOverlays || []).map(o => ({
      id: o.id,
      name: o.name,
      imageUrl: o.imageUrl,
      bounds: [[o.southLat, o.westLng], [o.northLat, o.eastLng]] as [[number, number], [number, number]],
      opacity: o.opacity,
      visible: o.visible,
    }))
  const [overlays, setOverlays] = useState<ImageOverlay[]>(() => convertOverlays(project.imageOverlays))

  // Sync overlays when project data changes (e.g., after page reload)
  useEffect(() => {
    setOverlays(convertOverlays(project.imageOverlays))
  }, [project.imageOverlays])
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [form, setForm] = useState({
    label: '',
    latitude: '',
    longitude: '',
    color: '#3B82F6',
    notes: '',
  })
  const [drawingForm, setDrawingForm] = useState({
    label: '',
    color: '#10B981',
    notes: '',
  })


  // Use saved location or default to UK
  const savedCenter = project.latitude && project.longitude ? [project.latitude, project.longitude] as [number, number] : null
  const [mapCenter, setMapCenter] = useState<[number, number]>(savedCenter || [51.5074, -0.1278])
  const [mapZoom, setMapZoom] = useState(project.mapZoom || 10)

  const markers = project.mapMarkers || []

  // Separate point markers from shapes (polygons/lines)
  const pointMarkers = markers.filter(m => m.type === 'point' || (!m.type && m.latitude))
  const drawings = markers.filter(m => m.type === 'polygon' || m.type === 'line').map(m => {
    const metrics = m.geometry ? calculateDrawingMetrics(m.geometry) : { area: 0, length: 0 }
    return {
      id: m.id,
      type: m.type as 'polygon' | 'line',
      geometry: m.geometry,
      label: m.label,
      color: m.color,
      notes: m.notes,
      area: metrics.area,
      length: metrics.length,
    }
  })

  const createMarker = useMutation({
    mutationFn: (data: typeof form) =>
      fetch(`/api/projects/${projectId}/markers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          type: 'point',
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
        }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      resetForm()
    },
  })

  const deleteMarker = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/projects/${projectId}/markers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  const createShape = useMutation({
    mutationFn: (data: { label: string; type: 'polygon' | 'line'; geometry: any; color: string; notes: string }) =>
      fetch(`/api/projects/${projectId}/markers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setPendingDrawing(null)
      setDrawingForm({ label: '', color: '#10B981', notes: '' })
    },
  })


  // Overlay mutations
  const [overlayError, setOverlayError] = useState<string | null>(null)
  const createOverlay = useMutation({
    mutationFn: async (overlay: ImageOverlay & { tempId?: string }) => {
      const response = await fetch(`/api/projects/${projectId}/overlays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overlay)
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save overlay')
      }
      return response.json()
    },
    onSuccess: (data) => {
      setOverlayError(null)
      // Update local state with the server-assigned ID
      setOverlays(prev => prev.map(o =>
        o.id === data.tempId ? { ...o, id: data.id } : o
      ))
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (error: Error) => {
      setOverlayError(error.message)
      // Remove the optimistically added overlay
      setOverlays(prev => prev.filter(o => !o.id.startsWith('temp-') && !o.id.match(/^\d+$/)))
    }
  })

  const updateOverlay = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; bounds?: [[number, number], [number, number]]; opacity?: number; visible?: boolean }) => {
      const response = await fetch(`/api/projects/${projectId}/overlays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return response.json()
    }
  })

  const deleteOverlayMutation = useMutation({
    mutationFn: async (overlayId: string) => {
      await fetch(`/api/projects/${projectId}/overlays/${overlayId}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    }
  })

  // Geo layers state
  const [sidebarMode, setSidebarMode] = useState<'overlays' | 'layers'>('overlays')
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [importingFile, setImportingFile] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  // Fetch geo layers
  const { data: geoLayers = [] } = useQuery<GeoLayer[]>({
    queryKey: ['geoLayers', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/layers`).then(r => r.json()),
  })

  // Geo layer mutations
  const createGeoLayer = useMutation({
    mutationFn: async (layer: { name: string; type: string; geojson: any; style?: any }) => {
      const response = await fetch(`/api/projects/${projectId}/layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layer)
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create layer')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geoLayers', projectId] })
    }
  })

  const updateGeoLayer = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; visible?: boolean; style?: any }) => {
      const response = await fetch(`/api/projects/${projectId}/layers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geoLayers', projectId] })
    }
  })

  const deleteGeoLayer = useMutation({
    mutationFn: async (layerId: string) => {
      await fetch(`/api/projects/${projectId}/layers/${layerId}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geoLayers', projectId] })
      if (selectedLayerId) setSelectedLayerId(null)
    }
  })

  // Handle shapefile/geojson import
  const handleGeoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportingFile(true)
    setImportError(null)

    try {
      const fileName = file.name.toLowerCase()
      let geojson: any

      if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
        // Parse GeoJSON directly
        const text = await file.text()
        geojson = JSON.parse(text)
      } else if (fileName.endsWith('.zip')) {
        // Parse shapefile from zip - dynamic import to avoid SSR issues
        const shp = (await import('shpjs')).default
        const arrayBuffer = await file.arrayBuffer()
        geojson = await shp(arrayBuffer)
      } else {
        throw new Error('Unsupported file format. Please upload .geojson, .json, or .zip (shapefile)')
      }

      // Ensure it's a valid GeoJSON
      if (!geojson || !geojson.type) {
        throw new Error('Invalid GeoJSON structure')
      }

      // Normalize to FeatureCollection
      if (geojson.type === 'Feature') {
        geojson = { type: 'FeatureCollection', features: [geojson] }
      } else if (Array.isArray(geojson)) {
        // shpjs can return array of FeatureCollections for multi-layer shapefiles
        geojson = {
          type: 'FeatureCollection',
          features: geojson.flatMap((fc: any) => fc.features || [])
        }
      }

      // Create the layer
      const layerName = file.name.replace(/\.(geojson|json|zip|shp)$/i, '')
      await createGeoLayer.mutateAsync({
        name: layerName,
        type: 'boundary',
        geojson,
        style: {
          fillColor: '#3B82F6',
          strokeColor: '#1E40AF',
          fillOpacity: 0.3,
          strokeWidth: 2
        }
      })

    } catch (err: any) {
      console.error('File import error:', err)
      setImportError(err.message || 'Failed to import file')
    } finally {
      setImportingFile(false)
      e.target.value = ''
    }
  }

  const toggleGeoLayerVisibility = (layerId: string) => {
    const layer = geoLayers.find(l => l.id === layerId)
    if (layer) {
      updateGeoLayer.mutate({ id: layerId, visible: !layer.visible })
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setIsAddingMarker(false)
    setPendingLocation(null)
    setForm({ label: '', latitude: '', longitude: '', color: '#3B82F6', notes: '' })
  }

  const handleMapClick = (lat: number, lng: number) => {
    if (isAddingMarker) {
      setPendingLocation({ lat, lng })
      setForm(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }))
      setShowForm(true)
    }
  }

  const handleDrawingCreated = (geometry: any, type: 'polygon' | 'line') => {
    setPendingDrawing({ geometry, type })
    setIsDrawingMode(false)
    setActiveDrawingTool(null)
  }

  const saveDrawing = () => {
    if (!pendingDrawing) return

    // Get existing shapes count for default label
    const existingShapes = markers.filter(m => m.type === 'polygon' || m.type === 'line')

    createShape.mutate({
      label: drawingForm.label || `${pendingDrawing.type} ${existingShapes.length + 1}`,
      type: pendingDrawing.type,
      geometry: pendingDrawing.geometry,
      color: drawingForm.color,
      notes: drawingForm.notes,
    })
  }

  const deleteDrawing = (id: string) => {
    deleteMarker.mutate(id)
  }

  const startDrawing = (tool: 'polygon' | 'line') => {
    setIsAddingMarker(false)
    setIsDrawingMode(true)
    setActiveDrawingTool(tool)
  }

  const cancelDrawing = () => {
    setIsDrawingMode(false)
    setActiveDrawingTool(null)
    setPendingDrawing(null)
  }

  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setOverlayError(null)

    // Check file size - Vercel has 4.5MB body limit, base64 adds ~33% overhead
    // So original file should be under ~3MB to be safe
    if (file.size > 3 * 1024 * 1024) {
      setOverlayError('Image too large. Please use an image under 3MB.')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      const tempId = Date.now().toString()
      const newOverlay: ImageOverlay = {
        id: tempId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        imageUrl,
        bounds: [
          [mapCenter[0] - 0.01, mapCenter[1] - 0.01],
          [mapCenter[0] + 0.01, mapCenter[1] + 0.01],
        ],
        opacity: 0.7,
        visible: true,
      }
      // Optimistically add to local state
      setOverlays([...overlays, newOverlay])
      setSelectedOverlayId(tempId)
      // Save to database
      createOverlay.mutate({ ...newOverlay, tempId } as any)
    }
    reader.onerror = () => {
      setOverlayError('Failed to read image file.')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const updateOverlayBounds = (overlayId: string, bounds: [[number, number], [number, number]]) => {
    // Update local state immediately
    setOverlays(overlays.map(o =>
      o.id === overlayId ? { ...o, bounds } : o
    ))
    // Save to database
    updateOverlay.mutate({ id: overlayId, bounds })
  }

  const updateOverlayOpacity = (overlayId: string, opacity: number) => {
    // Update local state immediately
    setOverlays(overlays.map(o =>
      o.id === overlayId ? { ...o, opacity } : o
    ))
    // Save to database
    updateOverlay.mutate({ id: overlayId, opacity })
  }

  const toggleOverlayVisibility = (overlayId: string) => {
    const overlay = overlays.find(o => o.id === overlayId)
    if (!overlay) return
    const newVisible = !overlay.visible
    // Update local state immediately
    setOverlays(overlays.map(o =>
      o.id === overlayId ? { ...o, visible: newVisible } : o
    ))
    // Save to database
    updateOverlay.mutate({ id: overlayId, visible: newVisible })
  }

  const deleteOverlay = (overlayId: string) => {
    // Update local state immediately
    setOverlays(overlays.filter(o => o.id !== overlayId))
    if (selectedOverlayId === overlayId) {
      setSelectedOverlayId(null)
    }
    // Delete from database
    deleteOverlayMutation.mutate(overlayId)
  }

  const fitToOverlay = (overlay: ImageOverlay) => {
    mapRef.current?.fitToOverlay(overlay.bounds)
  }

  const saveMapLocation = async () => {
    setSavingLocation(true)
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: mapCenter[0],
          longitude: mapCenter[1],
          mapZoom: mapZoom,
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      alert('Map location saved!')
    } catch (error) {
      alert('Failed to save map location')
    } finally {
      setSavingLocation(false)
    }
  }

  const allMarkers = [
    ...markers,
    ...(pendingLocation ? [{
      id: 'pending',
      label: form.label || 'New marker',
      latitude: pendingLocation.lat,
      longitude: pendingLocation.lng,
      color: form.color,
      notes: null
    }] : [])
  ]

  return (
    <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Interactive Map</h2>
              <p className="text-sm text-slate-600">Add markers, draw areas, and manage overlays</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isDrawingMode && !isAddingMarker ? (
                <>
                  <button
                    onClick={() => { setIsAddingMarker(true); setIsDrawingMode(false) }}
                    className="btn-primary"
                  >
                    <Plus size={18} aria-hidden="true" /> Add Marker
                  </button>
                  <button
                    onClick={() => startDrawing('polygon')}
                    className="btn bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Pentagon size={18} aria-hidden="true" /> Draw Area
                  </button>
                  <button
                    onClick={() => startDrawing('line')}
                    className="btn bg-brand-600 text-white hover:bg-brand-700"
                  >
                    <Minus size={18} aria-hidden="true" /> Draw Line
                  </button>
                  <button
                    onClick={saveMapLocation}
                    disabled={savingLocation}
                    className="btn-secondary"
                    title="Save current map view as default"
                  >
                    <Save size={18} className={savingLocation ? 'animate-pulse' : ''} aria-hidden="true" />
                    {savingLocation ? 'Saving...' : 'Save View'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { cancelDrawing(); resetForm() }}
                  className="btn-secondary"
                >
                  <X size={18} aria-hidden="true" /> Cancel
                </button>
              )}
            </div>
          </div>

          {isAddingMarker && !showForm && (
            <div className="card bg-blue-50 border-blue-200 p-4 mb-4" role="alert">
              <p className="text-blue-800 text-sm font-medium">Click on the map to place a marker</p>
            </div>
          )}

          {isDrawingMode && (
            <div className="card bg-emerald-50 border-emerald-200 p-4 mb-4" role="alert">
              <p className="text-emerald-800 text-sm font-medium">
                {activeDrawingTool === 'polygon'
                  ? 'Click on the map to draw polygon points. Click the first point to complete.'
                  : 'Click on the map to draw line points. Double-click to complete.'}
              </p>
            </div>
          )}

          {showForm && (
            <div className="card p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Add Map Marker</h3>
                <button onClick={resetForm} className="btn-icon" aria-label="Close form">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="marker-label" className="label label-required">Label</label>
                  <input
                    id="marker-label"
                    type="text"
                    placeholder="Enter marker label"
                    value={form.label}
                    onChange={e => setForm({ ...form, label: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="marker-color" className="label">Color</label>
                  <input
                    id="marker-color"
                    type="color"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="input h-10 p-1"
                  />
                </div>
                <div>
                  <label htmlFor="marker-lat" className="label">Latitude</label>
                  <input
                    id="marker-lat"
                    type="number"
                    step="any"
                    placeholder="51.5074"
                    value={form.latitude}
                    onChange={e => setForm({ ...form, latitude: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="marker-lng" className="label">Longitude</label>
                  <input
                    id="marker-lng"
                    type="number"
                    step="any"
                    placeholder="-0.1278"
                    value={form.longitude}
                    onChange={e => setForm({ ...form, longitude: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="marker-notes" className="label">Notes</label>
                <textarea
                  id="marker-notes"
                  placeholder="Additional notes about this marker"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="input resize-y"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
                <button
                  onClick={() => createMarker.mutate(form)}
                  disabled={!form.label || !form.latitude || !form.longitude}
                  className="btn-primary"
                >
                  Save Marker
                </button>
                <button onClick={resetForm} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {pendingDrawing && (
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Save {pendingDrawing.type === 'polygon' ? 'Area' : 'Line'}</h3>
                <button onClick={() => setPendingDrawing(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Label"
                  value={drawingForm.label}
                  onChange={e => setDrawingForm({ ...drawingForm, label: e.target.value })}
                  className="p-2 border rounded"
                />
                <input
                  type="color"
                  value={drawingForm.color}
                  onChange={e => setDrawingForm({ ...drawingForm, color: e.target.value })}
                  className="p-1 border rounded h-10"
                />
              </div>
              <textarea
                placeholder="Notes"
                value={drawingForm.notes}
                onChange={e => setDrawingForm({ ...drawingForm, notes: e.target.value })}
                className="w-full p-2 border rounded mt-4"
                rows={2}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={saveDrawing}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Save
                </button>
                <button onClick={() => setPendingDrawing(null)} className="px-4 py-2 border rounded hover:bg-gray-50">
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Map Container - explicit dimensions all the way down */}
          <div className="relative rounded-xl overflow-hidden shadow-lg border border-gray-200 mb-6" style={{ height: '600px', width: '100%' }}>
            {/* Map wrapper with explicit height (not percentage) */}
            <div style={{ height: '600px', width: '100%' }}>
              <InteractiveMap
              ref={mapRef}
              center={mapCenter}
              zoom={mapZoom}
              markers={allMarkers}
              drawings={drawings}
              overlays={overlays}
              geoLayers={geoLayers}
              selectedOverlayId={selectedOverlayId}
              isAddingMarker={isAddingMarker}
              isDrawingMode={isDrawingMode}
              activeDrawingTool={activeDrawingTool}
              activeDrawingColor={drawingForm.color}
              onMapClick={handleMapClick}
              onDrawingCreated={handleDrawingCreated}
              onBoundsChange={(center: [number, number], zoom: number) => {
                setMapCenter(center)
                setMapZoom(zoom)
              }}
              onOverlayClick={(id: string) => setSelectedOverlayId(id)}
              onOverlayBoundsChange={updateOverlayBounds}
            />
            </div>

            {/* Sidebar as overlay on top of map */}
            <div className={`absolute top-0 left-0 h-full bg-white border-r border-gray-200 flex flex-col z-10 transition-all duration-300 ${sidebarCollapsed ? 'w-12' : 'w-80'}`}>
              {/* Header with collapse button */}
              <div className={`flex items-center justify-between p-3 bg-brand-600 text-white ${sidebarCollapsed ? 'px-2' : ''}`}>
                {!sidebarCollapsed && (
                  <span className="font-semibold text-sm">Map Layers</span>
                )}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
              </div>

              {!sidebarCollapsed && (
                <>
                  {/* Tab switcher */}
                  <div className="flex border-b border-gray-200">
                    <button
                      onClick={() => setSidebarMode('overlays')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                        sidebarMode === 'overlays'
                          ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Image size={16} />
                      <span>Images</span>
                      <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{overlays.length}</span>
                    </button>
                    <button
                      onClick={() => setSidebarMode('layers')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                        sidebarMode === 'layers'
                          ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Layers size={16} />
                      <span>Geo Data</span>
                      <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{geoLayers.length}</span>
                    </button>
                  </div>

                  {/* Overlays Panel */}
                  {sidebarMode === 'overlays' && (
                    <>
                      <div className="p-3 border-b border-gray-100">
                        <label className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors ${createOverlay.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                          {createOverlay.isPending ? (
                            <>
                              <span className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
                              <span className="text-sm text-gray-600">Saving...</span>
                            </>
                          ) : (
                            <>
                              <Upload size={18} className="text-gray-400" />
                              <span className="text-sm text-gray-600">Add Overlay</span>
                            </>
                          )}
                          <input type="file" accept="image/*" onChange={handleOverlayUpload} className="hidden" disabled={createOverlay.isPending} />
                        </label>
                        {overlayError && (
                          <p className="text-xs text-red-600 mt-2 text-center">{overlayError}</p>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {overlays.length === 0 ? (
                          <div className="text-center py-8">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                              <Image size={24} className="text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500">No overlays yet</p>
                            <p className="text-xs text-gray-400 mt-1">Upload an image to get started</p>
                          </div>
                        ) : (
                          overlays.map(overlay => (
                            <div
                              key={overlay.id}
                              className={`rounded-lg border transition-all cursor-pointer ${
                                selectedOverlayId === overlay.id
                                  ? 'border-brand-400 bg-brand-50 shadow-sm'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                              onClick={() => setSelectedOverlayId(selectedOverlayId === overlay.id ? null : overlay.id)}
                            >
                              <div className="flex items-center gap-2 p-2">
                                <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                                  <img src={overlay.imageUrl} alt={overlay.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-gray-800 truncate">{overlay.name}</p>
                                  <p className="text-xs text-gray-400">{Math.round(overlay.opacity * 100)}% opacity</p>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleOverlayVisibility(overlay.id) }}
                                  className={`p-1.5 rounded transition-colors ${
                                    overlay.visible ? 'text-brand-600 bg-brand-100 hover:bg-brand-200' : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                                  }`}
                                >
                                  {overlay.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                              </div>
                              {selectedOverlayId === overlay.id && (
                                <div className="px-3 pb-3 space-y-3 border-t border-gray-100 mt-2 pt-3">
                                  <div>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-gray-500">Opacity</span>
                                      <span className="text-gray-700 font-medium">{Math.round(overlay.opacity * 100)}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="1"
                                      step="0.05"
                                      value={overlay.opacity}
                                      onChange={(e) => updateOverlayOpacity(overlay.id, parseFloat(e.target.value))}
                                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); fitToOverlay(overlay) }}
                                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-brand-600 bg-brand-100 hover:bg-brand-200 rounded transition-colors"
                                    >
                                      <ZoomIn size={14} /> Fit to View
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteOverlay(overlay.id) }}
                                      className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-400 text-center">Drag corner handles to resize</p>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {/* Geo Layers Panel */}
                  {sidebarMode === 'layers' && (
                    <>
                      <div className="p-3 border-b border-gray-100">
                        <label className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors ${importingFile ? 'opacity-50 pointer-events-none' : ''}`}>
                          {importingFile ? (
                            <>
                              <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                              <span className="text-sm text-gray-600">Importing...</span>
                            </>
                          ) : (
                            <>
                              <FileUp size={18} className="text-gray-400" />
                              <span className="text-sm text-gray-600">Import Shapefile/GeoJSON</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept=".geojson,.json,.zip"
                            onChange={handleGeoFileUpload}
                            className="hidden"
                            disabled={importingFile}
                          />
                        </label>
                        {importError && (
                          <p className="text-xs text-red-600 mt-2 text-center">{importError}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2 text-center">
                          Supports .geojson, .json, or .zip (shapefile)
                        </p>
                      </div>

                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {geoLayers.length === 0 ? (
                          <div className="text-center py-8">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                              <Layers size={24} className="text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500">No geo layers yet</p>
                            <p className="text-xs text-gray-400 mt-1">Import a shapefile or GeoJSON</p>
                          </div>
                        ) : (
                          geoLayers.map(layer => {
                            const layerType = LAYER_TYPES.find(t => t.value === layer.type) || LAYER_TYPES[5]
                            const featureCount = layer.geojson?.features?.length || 0
                            return (
                              <div
                                key={layer.id}
                                className={`rounded-lg border transition-all cursor-pointer ${
                                  selectedLayerId === layer.id
                                    ? 'border-blue-400 bg-blue-50 shadow-sm'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                                onClick={() => setSelectedLayerId(selectedLayerId === layer.id ? null : layer.id)}
                              >
                                <div className="flex items-center gap-2 p-2">
                                  <div
                                    className="w-10 h-10 rounded flex items-center justify-center"
                                    style={{ backgroundColor: layer.style?.fillColor || layerType.color, opacity: 0.3 }}
                                  >
                                    <MapPinned size={18} style={{ color: layer.style?.strokeColor || layerType.color }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-gray-800 truncate">{layer.name}</p>
                                    <p className="text-xs text-gray-400">{featureCount} feature{featureCount !== 1 ? 's' : ''}</p>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleGeoLayerVisibility(layer.id) }}
                                    className={`p-1.5 rounded transition-colors ${
                                      layer.visible ? 'text-blue-600 bg-blue-100 hover:bg-blue-200' : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                                    }`}
                                  >
                                    {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                  </button>
                                </div>
                                {selectedLayerId === layer.id && (
                                  <div className="px-3 pb-3 space-y-3 border-t border-gray-100 mt-2 pt-3">
                                    <div>
                                      <span className="text-xs text-gray-500">Type: </span>
                                      <span className="text-xs font-medium text-gray-700">{layerType.label}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteGeoLayer.mutate(layer.id) }}
                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                      >
                                        <Trash2 size={14} /> Delete Layer
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {sidebarCollapsed && (
                <div className="flex-1 flex flex-col items-center py-4 gap-3">
                  <label className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded cursor-pointer transition-colors" title="Add Overlay">
                    <Upload size={20} />
                    <input type="file" accept="image/*" onChange={handleOverlayUpload} className="hidden" />
                  </label>
                  <label className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors" title="Import Geo Data">
                    <FileUp size={20} />
                    <input type="file" accept=".geojson,.json,.zip" onChange={handleGeoFileUpload} className="hidden" />
                  </label>
                  <div className="w-full h-px bg-gray-200 my-1" />
                  {overlays.map(overlay => (
                    <button
                      key={overlay.id}
                      onClick={() => { setSidebarCollapsed(false); setSidebarMode('overlays'); setSelectedOverlayId(overlay.id) }}
                      className={`w-8 h-8 rounded overflow-hidden border-2 transition-colors ${
                        selectedOverlayId === overlay.id ? 'border-brand-500' : 'border-transparent hover:border-gray-300'
                      }`}
                      title={overlay.name}
                    >
                      <img src={overlay.imageUrl} alt={overlay.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {geoLayers.map(layer => (
                    <button
                      key={layer.id}
                      onClick={() => { setSidebarCollapsed(false); setSidebarMode('layers'); setSelectedLayerId(layer.id) }}
                      className={`w-8 h-8 rounded flex items-center justify-center border-2 transition-colors ${
                        selectedLayerId === layer.id ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                      }`}
                      style={{ backgroundColor: layer.style?.fillColor || '#3B82F6' }}
                      title={layer.name}
                    >
                      <Layers size={14} className="text-white" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Markers List */}
          {pointMarkers.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Markers ({pointMarkers.length})</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pointMarkers.map(m => (
                  <div key={m.id} className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="font-medium">{m.label}</span>
                      <button onClick={() => deleteMarker.mutate(m.id)} className="ml-auto text-gray-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">{m.latitude?.toFixed(6)}, {m.longitude?.toFixed(6)}</p>
                    {m.notes && <p className="text-sm mt-2">{m.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drawings List */}
          {drawings.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Drawings ({drawings.length})</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {drawings.map(d => (
                  <div key={d.id} className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: d.color }} />
                      <span className="font-medium">{d.label}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{d.type}</span>
                      <button onClick={() => deleteDrawing(d.id)} className="ml-auto text-gray-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">
                      {d.type === 'polygon'
                        ? `Area: ${((d.area || 0) / 10000).toFixed(2)} hectares`
                        : `Length: ${((d.length || 0) / 1000).toFixed(2)} km`}
                    </p>
                    {d.notes && <p className="text-sm mt-2">{d.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
    </div>
  )
}

// Separate Embed Settings Tab Component
export function EmbedSettingsTab({ projectId, project }: { projectId: string; project: Project }) {
  const queryClient = useQueryClient()
  const [copiedFeedback, setCopiedFeedback] = useState(false)
  const [copiedTour, setCopiedTour] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const toggleSetting = useMutation({
    mutationFn: async (setting: { key: string; value: boolean }) => {
      setToggling(setting.key)
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [setting.key]: setting.value })
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onSettled: () => {
      setToggling(null)
    }
  })

  const feedbackEmbedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/embed/${projectId}`
    : `/embed/${projectId}`

  const tourEmbedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/embed/${projectId}/tour`
    : `/embed/${projectId}/tour`

  const feedbackEmbedCode = `<iframe
  src="${feedbackEmbedUrl}"
  width="100%"
  height="600"
  frameborder="0"
  allow="geolocation"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
></iframe>`

  const tourEmbedCode = `<iframe
  src="${tourEmbedUrl}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
></iframe>`

  const copyFeedbackCode = () => {
    navigator.clipboard.writeText(feedbackEmbedCode)
    setCopiedFeedback(true)
    setTimeout(() => setCopiedFeedback(false), 2000)
  }

  const copyTourCode = () => {
    navigator.clipboard.writeText(tourEmbedCode)
    setCopiedTour(true)
    setTimeout(() => setCopiedTour(false), 2000)
  }

  const hasTours = (project as any).tours?.length > 0

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              project.embedEnabled ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Globe size={24} className={project.embedEnabled ? 'text-green-600' : 'text-gray-400'} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Public Embedding</h3>
              <p className="text-sm text-gray-500">
                {project.embedEnabled
                  ? 'Anyone with the embed code can view and leave feedback'
                  : 'Enable to allow public access to this map'}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleSetting.mutate({ key: 'embedEnabled', value: !project.embedEnabled })}
            disabled={toggling === 'embedEnabled'}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              project.embedEnabled ? 'bg-green-500' : 'bg-gray-300'
            } ${toggling === 'embedEnabled' ? 'opacity-50' : ''}`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                project.embedEnabled ? 'left-8' : 'left-1'
              }`}
            />
          </button>
        </div>

        {project.embedEnabled && (
          <>
            {/* Interaction Settings */}
            <div className="mt-6 pt-6 border-t space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Interaction Settings</p>

              {/* Allow Pins Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <MapPinned size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Allow Pin Comments</p>
                    <p className="text-sm text-gray-500">Visitors can drop pins and leave comments</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSetting.mutate({ key: 'allowPins', value: !project.allowPins })}
                  disabled={toggling === 'allowPins'}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    project.allowPins ? 'bg-brand-500' : 'bg-gray-300'
                  } ${toggling === 'allowPins' ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      project.allowPins ? 'left-6' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Allow Drawing Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <Pentagon size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Allow Shape Drawing</p>
                    <p className="text-sm text-gray-500">Visitors can draw areas on the map</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSetting.mutate({ key: 'allowDrawing', value: !project.allowDrawing })}
                  disabled={toggling === 'allowDrawing'}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    project.allowDrawing ? 'bg-brand-500' : 'bg-gray-300'
                  } ${toggling === 'allowDrawing' ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      project.allowDrawing ? 'left-6' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {!project.allowPins && !project.allowDrawing && (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  Both interactions are disabled. The map will be view-only (reference mode).
                </p>
              )}
            </div>

            {/* Feedback Map Embed Code */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Code size={18} className="text-gray-400" />
                  <span className="font-medium text-sm text-gray-700">Feedback Map Embed</span>
                </div>
                <div className="flex gap-2">
                  <a
                    href={feedbackEmbedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
                  >
                    <ExternalLink size={14} /> Preview
                  </a>
                  <button
                    onClick={copyFeedbackCode}
                    className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
                  >
                    {copiedFeedback ? <Check size={14} /> : <Copy size={14} />}
                    {copiedFeedback ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <pre className="bg-gray-900 text-gray-100 text-sm p-4 rounded-lg overflow-x-auto">
                <code>{feedbackEmbedCode}</code>
              </pre>
              <p className="text-sm text-gray-500 mt-3">
                Embed the feedback map to collect public comments and feedback.
              </p>
            </div>

            {/* Tour Embed Code */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Code size={18} className="text-gray-400" />
                  <span className="font-medium text-sm text-gray-700">Guided Tour Embed</span>
                </div>
                <div className="flex gap-2">
                  <a
                    href={tourEmbedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
                  >
                    <ExternalLink size={14} /> Preview
                  </a>
                  <button
                    onClick={copyTourCode}
                    className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
                  >
                    {copiedTour ? <Check size={14} /> : <Copy size={14} />}
                    {copiedTour ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <pre className="bg-gray-900 text-gray-100 text-sm p-4 rounded-lg overflow-x-auto">
                <code>{tourEmbedCode}</code>
              </pre>
              <p className="text-sm text-gray-500 mt-3">
                {hasTours
                  ? 'Embed the guided tour to showcase your masterplan with an interactive walkthrough.'
                  : 'Create a tour in the Tours tab to enable this embed.'}
              </p>
            </div>
          </>
        )}
      </div>

      {!project.embedEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800 text-sm">
            Enable public embedding to generate an embed code for your engagement website.
          </p>
        </div>
      )}
    </div>
  )
}

// Separate Public Comments Tab Component
export function PublicCommentsTab({ projectId, project }: { projectId: string; project: Project }) {
  const queryClient = useQueryClient()
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null)

  const deletePin = useMutation({
    mutationFn: async (pinId: string) => {
      await fetch(`/api/projects/${projectId}/pins/${pinId}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    }
  })

  const approvePin = useMutation({
    mutationFn: async ({ pinId, approved }: { pinId: string; approved: boolean }) => {
      setPendingApprovalId(pinId)
      const response = await fetch(`/api/projects/${projectId}/pins/${pinId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved })
      })
      if (!response.ok) {
        throw new Error(`Failed to update pin: ${response.status}`)
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (error) => {
      console.error('Approve pin error:', error)
      alert('Failed to update approval status. Please try again.')
    },
    onSettled: () => {
      setPendingApprovalId(null)
    }
  })

  const categoryStats = (project.publicPins || []).reduce((acc, pin) => {
    acc[pin.category] = (acc[pin.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {(project.publicPins?.length || 0) > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const count = categoryStats[key] || 0
            const IconComponent = config.icon
            return (
              <div key={key} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: config.bg }}
                  >
                    <IconComponent size={20} style={{ color: config.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <p className="text-sm text-gray-500">{config.label}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold">Public Feedback ({project.publicPins?.length || 0})</h3>
        </div>
        {!project.publicPins?.length ? (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-500">No public feedback yet</p>
            <p className="text-sm text-gray-400 mt-1">
              {project.embedEnabled
                ? 'Share the embed code to start collecting feedback'
                : 'Enable embedding in the Embed tab first'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {project.publicPins.map(pin => {
              const config = CATEGORY_CONFIG[pin.category] || CATEGORY_CONFIG.comment
              const IconComponent = config.icon
              return (
                <div key={pin.id} className={`px-6 py-4 hover:bg-gray-50 ${!pin.approved ? 'bg-amber-50/50' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: config.bg }}
                    >
                      <IconComponent size={20} style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: config.bg, color: config.color }}
                        >
                          {config.label}
                        </span>
                        {pin.approved ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                            <CheckCircle size={12} />
                            Approved
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                            <Clock size={12} />
                            Pending
                          </span>
                        )}
                        {pin.name && (
                          <span className="text-sm font-medium text-gray-700">{pin.name}</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(pin.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {pin.shapeType && pin.shapeType !== 'pin' && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 flex items-center gap-1">
                            {pin.shapeType === 'line' ? <Minus size={12} /> : <Pentagon size={12} />}
                            {pin.shapeType === 'line' ? 'Route' : 'Area'}
                          </span>
                        )}
                        {pin.votes > 0 && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <ThumbsUp size={12} />
                            {pin.votes}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{pin.comment}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        {pin.shapeType === 'pin' || !pin.shapeType ? (
                          <span>{pin.latitude?.toFixed(6)}, {pin.longitude?.toFixed(6)}</span>
                        ) : (
                          <span>
                            {pin.shapeType === 'line'
                              ? `${(pin.geometry?.coordinates as number[][])?.length || 0} points`
                              : `${((pin.geometry?.coordinates as number[][][])?.[0]?.length || 1) - 1} points`}
                          </span>
                        )}
                        {pin.email && (
                          <a href={`mailto:${pin.email}`} className="text-brand-600 hover:underline">
                            {pin.email}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {pin.approved ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            approvePin.mutate({ pinId: pin.id, approved: false })
                          }}
                          disabled={pendingApprovalId === pin.id}
                          className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Unapprove"
                        >
                          {pendingApprovalId === pin.id ? (
                            <span className="animate-spin inline-block w-[18px] h-[18px] border-2 border-amber-500 border-t-transparent rounded-full" />
                          ) : (
                            <XCircle size={18} />
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            approvePin.mutate({ pinId: pin.id, approved: true })
                          }}
                          disabled={pendingApprovalId === pin.id}
                          className="p-2 text-green-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Approve"
                        >
                          {pendingApprovalId === pin.id ? (
                            <span className="animate-spin inline-block w-[18px] h-[18px] border-2 border-green-500 border-t-transparent rounded-full" />
                          ) : (
                            <CheckCircle size={18} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('Delete this feedback?')) {
                            deletePin.mutate(pin.id)
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
