'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X, Pentagon, Minus, Eye, EyeOff, Upload, Save, ChevronLeft, ChevronRight, Image, ZoomIn, Code, MessageCircle, Globe, Copy, Check, ThumbsUp, ThumbsDown, HelpCircle, ExternalLink, Clock, CheckCircle, XCircle, FileUp, Layers, MapPinned, Palette, Type, MapIcon } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { fetchJson } from '@/lib/fetch-json'

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
  rotation: number
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
  // Styling customization
  embedPrimaryColor: string | null
  embedFontFamily: string | null
  embedHideStreetLabels: boolean
  embedReferenceOnly: boolean
  embedDefaultSatellite: boolean
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

  // Debounce state for overlay PATCHes: Google Maps fires onDrag hundreds of
  // times per drag, so we update local state synchronously but coalesce the
  // server PATCH per overlay (latest-wins) instead of firing one per event.
  const overlayPatchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const overlayPatchPending = useRef<Record<string, { bounds?: [[number, number], [number, number]]; opacity?: number; rotation?: number; visible?: boolean }>>({})

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
      rotation: o.rotation || 0,
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
    mutationFn: (overlay: ImageOverlay & { tempId?: string }) =>
      fetchJson<any>(`/api/projects/${projectId}/overlays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overlay)
      }),
    onSuccess: (data, variables) => {
      setOverlayError(null)
      // Prefer the tempId we sent (available on the mutation variables) so we
      // update exactly the right overlay even if the server echo omits it.
      const tempId = variables.tempId ?? data.tempId
      // Update local state with the server-assigned ID
      setOverlays(prev => prev.map(o =>
        o.id === tempId ? { ...o, id: data.id } : o
      ))
      // selectedOverlayId may still hold the temp id (which would silently
      // deselect the overlay once its id is swapped) — keep it pointing at the
      // now-persisted overlay.
      setSelectedOverlayId(prev => (prev === tempId ? data.id : prev))
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (error: Error, variables) => {
      setOverlayError(error.message)
      toast.error(error.message || 'Failed to save overlay')
      // Roll back ONLY the overlay for this failed mutation (temp ids are
      // Date.now()+i — all digits — so a broad regex filter would wipe every
      // not-yet-confirmed overlay in a multi-file upload).
      const tempId = variables.tempId
      if (tempId) {
        setOverlays(prev => prev.filter(o => o.id !== tempId))
        setSelectedOverlayId(prev => (prev === tempId ? null : prev))
      }
    }
  })

  const updateOverlay = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; bounds?: [[number, number], [number, number]]; opacity?: number; rotation?: number; visible?: boolean }) =>
      fetchJson(`/api/projects/${projectId}/overlays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }),
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update overlay')
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

  // Stable handler so InteractiveMap's overlay effect doesn't re-run on every
  // unrelated re-render of this component.
  const handleOverlayClick = useCallback((id: string) => {
    setSelectedOverlayId(id)
  }, [])

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

  const [isUploading, setIsUploading] = useState(false)

  const handleOverlayUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setOverlayError(null)

    // Validate all files first
    const validFiles: File[] = []
    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        setOverlayError(`${file.name} is too large. Maximum size is 50MB.`)
        e.target.value = ''
        return
      }
      if (!file.type.startsWith('image/')) {
        setOverlayError(`${file.name} is not an image file.`)
        e.target.value = ''
        return
      }
      validFiles.push(file)
    }

    setIsUploading(true)

    try {
      // Upload all files and create overlays
      const newOverlays: ImageOverlay[] = []
      let lastTempId = ''

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]

        // Upload to Vercel Blob
        const formData = new FormData()
        formData.append('file', file)

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json()
          throw new Error(errorData.error || `Upload failed for ${file.name}`)
        }

        const { url: imageUrl } = await uploadRes.json()

        // Offset each overlay slightly so they don't stack exactly on top of each other
        const offset = i * 0.005
        const tempId = (Date.now() + i).toString()
        lastTempId = tempId

        const newOverlay: ImageOverlay = {
          id: tempId,
          name: file.name.replace(/\.[^/.]+$/, ''),
          imageUrl,
          bounds: [
            [mapCenter[0] - 0.01 + offset, mapCenter[1] - 0.01 + offset],
            [mapCenter[0] + 0.01 + offset, mapCenter[1] + 0.01 + offset],
          ],
          opacity: 0.7,
          rotation: 0,
          visible: true,
        }

        newOverlays.push(newOverlay)

        // Save to database
        createOverlay.mutate({ ...newOverlay, tempId } as any)
      }

      // Add all overlays to local state at once
      setOverlays(prev => [...prev, ...newOverlays])
      // Select the last uploaded overlay
      setSelectedOverlayId(lastTempId)
    } catch (error) {
      setOverlayError(error instanceof Error ? error.message : 'Failed to upload images.')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  // Coalesce rapid overlay edits (continuous drag / slider) into a single
  // debounced PATCH per overlay, latest-wins. Discrete actions (visibility
  // toggle, delete) flush/cancel any pending debounce for that id first.
  const scheduleOverlayPatch = useCallback((
    overlayId: string,
    data: { bounds?: [[number, number], [number, number]]; opacity?: number; rotation?: number }
  ) => {
    overlayPatchPending.current[overlayId] = {
      ...overlayPatchPending.current[overlayId],
      ...data,
    }
    if (overlayPatchTimers.current[overlayId]) {
      clearTimeout(overlayPatchTimers.current[overlayId])
    }
    overlayPatchTimers.current[overlayId] = setTimeout(() => {
      const pending = overlayPatchPending.current[overlayId]
      delete overlayPatchPending.current[overlayId]
      delete overlayPatchTimers.current[overlayId]
      if (pending) {
        updateOverlay.mutate({ id: overlayId, ...pending })
      }
    }, 500)
  }, [updateOverlay])

  const flushOverlayPatch = useCallback((overlayId: string) => {
    if (overlayPatchTimers.current[overlayId]) {
      clearTimeout(overlayPatchTimers.current[overlayId])
      delete overlayPatchTimers.current[overlayId]
    }
    delete overlayPatchPending.current[overlayId]
  }, [])

  // Cancel any pending debounced PATCHes on unmount.
  useEffect(() => {
    const timers = overlayPatchTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  const updateOverlayBounds = (overlayId: string, bounds: [[number, number], [number, number]]) => {
    // Update local state immediately (functional update — drag fires rapidly)
    setOverlays(prev => prev.map(o =>
      o.id === overlayId ? { ...o, bounds } : o
    ))
    // Save to database (debounced, latest-wins)
    scheduleOverlayPatch(overlayId, { bounds })
  }

  const updateOverlayOpacity = (overlayId: string, opacity: number) => {
    // Update local state immediately
    setOverlays(prev => prev.map(o =>
      o.id === overlayId ? { ...o, opacity } : o
    ))
    // Save to database (debounced, latest-wins)
    scheduleOverlayPatch(overlayId, { opacity })
  }

  const updateOverlayRotation = (overlayId: string, rotation: number) => {
    // Update local state immediately
    setOverlays(prev => prev.map(o =>
      o.id === overlayId ? { ...o, rotation } : o
    ))
    // Save to database (debounced, latest-wins)
    scheduleOverlayPatch(overlayId, { rotation })
  }

  const toggleOverlayVisibility = (overlayId: string) => {
    const overlay = overlays.find(o => o.id === overlayId)
    if (!overlay) return
    const newVisible = !overlay.visible
    // Update local state immediately
    setOverlays(prev => prev.map(o =>
      o.id === overlayId ? { ...o, visible: newVisible } : o
    ))
    // Discrete action: flush any queued debounced PATCH, then save immediately
    flushOverlayPatch(overlayId)
    updateOverlay.mutate({ id: overlayId, visible: newVisible })
  }

  const deleteOverlay = (overlayId: string) => {
    // Update local state immediately
    setOverlays(prev => prev.filter(o => o.id !== overlayId))
    if (selectedOverlayId === overlayId) {
      setSelectedOverlayId(null)
    }
    // Cancel any queued PATCH for this overlay, then delete from database
    flushOverlayPatch(overlayId)
    deleteOverlayMutation.mutate(overlayId)
  }

  const fitToOverlay = (overlay: ImageOverlay) => {
    mapRef.current?.fitToOverlay(overlay.bounds)
  }

  const saveMapLocation = async () => {
    setSavingLocation(true)
    try {
      await fetchJson(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: mapCenter[0],
          longitude: mapCenter[1],
          mapZoom: mapZoom,
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Map location saved!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save map location')
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
              apiRef={mapRef}
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
              onOverlayClick={handleOverlayClick}
              onOverlayBoundsChange={updateOverlayBounds}
              onOverlayRotationChange={updateOverlayRotation}
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
                        <label className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors ${(isUploading || createOverlay.isPending) ? 'opacity-50 pointer-events-none' : ''}`}>
                          {isUploading ? (
                            <>
                              <span className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
                              <span className="text-sm text-gray-600">Uploading...</span>
                            </>
                          ) : createOverlay.isPending ? (
                            <>
                              <span className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
                              <span className="text-sm text-gray-600">Saving...</span>
                            </>
                          ) : (
                            <>
                              <Upload size={18} className="text-gray-400" />
                              <span className="text-sm text-gray-600">Add Overlay (up to 50MB)</span>
                            </>
                          )}
                          <input type="file" accept="image/*" multiple onChange={handleOverlayUpload} className="hidden" disabled={isUploading || createOverlay.isPending} />
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
                                  <div>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-gray-500">Rotation</span>
                                      <span className="text-gray-700 font-medium">{Math.round(overlay.rotation || 0)}°</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="360"
                                      step="1"
                                      value={overlay.rotation || 0}
                                      onChange={(e) => updateOverlayRotation(overlay.id, parseFloat(e.target.value))}
                                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
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
                                      onClick={(e) => { e.stopPropagation(); updateOverlayRotation(overlay.id, 0) }}
                                      className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                      title="Reset rotation"
                                    >
                                      0°
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteOverlay(overlay.id) }}
                                      className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-400 text-center">Drag green handle to rotate, corners to resize</p>
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
                  <label className={`p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded cursor-pointer transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`} title="Add Overlay (up to 50MB)">
                    {isUploading ? <span className="animate-spin w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full inline-block" /> : <Upload size={20} />}
                    <input type="file" accept="image/*" multiple onChange={handleOverlayUpload} className="hidden" disabled={isUploading} />
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
  const [toggling, setToggling] = useState<string | null>(null)

  const toggleSetting = useMutation({
    mutationFn: async (setting: { key: string; value: boolean }) => {
      setToggling(setting.key)
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [setting.key]: setting.value })
      })
      if (!response.ok) throw new Error('Failed to update setting')
      return response.json()
    },
    onSuccess: (updatedProject) => {
      // Directly update the cache with the response data
      queryClient.setQueryData(['project', projectId], (old: any) => ({
        ...old,
        ...updatedProject
      }))
    },
    onSettled: () => {
      setToggling(null)
    }
  })

  const feedbackEmbedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/embed/${projectId}`
    : `/embed/${projectId}`

  const feedbackEmbedCode = `<iframe
  src="${feedbackEmbedUrl}"
  title="${(project?.name || 'Consultation').replace(/"/g, '&quot;')} consultation map"
  width="100%"
  height="600"
  loading="lazy"
  allow="geolocation"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
></iframe>`

  const copyFeedbackCode = () => {
    navigator.clipboard.writeText(feedbackEmbedCode)
    setCopiedFeedback(true)
    setTimeout(() => setCopiedFeedback(false), 2000)
  }

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

            {/* Display Settings */}
            <div className="mt-6 pt-6 border-t space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Display Settings</p>

              {/* Reference Only Mode Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Reference Only Mode</p>
                  <p className="text-sm text-gray-500">Hide all UI elements - view-only map</p>
                </div>
                <button
                  onClick={() => toggleSetting.mutate({ key: 'embedReferenceOnly', value: !project.embedReferenceOnly })}
                  disabled={toggling === 'embedReferenceOnly'}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    project.embedReferenceOnly ? 'bg-brand-500' : 'bg-gray-300'
                  } ${toggling === 'embedReferenceOnly' ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      project.embedReferenceOnly ? 'left-6' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Default to Satellite Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Default to Satellite View</p>
                  <p className="text-sm text-gray-500">Show satellite imagery instead of map view</p>
                </div>
                <button
                  onClick={() => toggleSetting.mutate({ key: 'embedDefaultSatellite', value: !project.embedDefaultSatellite })}
                  disabled={toggling === 'embedDefaultSatellite'}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    project.embedDefaultSatellite ? 'bg-brand-500' : 'bg-gray-300'
                  } ${toggling === 'embedDefaultSatellite' ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      project.embedDefaultSatellite ? 'left-6' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Styling Customization */}
            <div className="mt-6 pt-6 border-t space-y-4" data-tour="embed-styling">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Styling</p>

              {/* Primary Color */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <Palette size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Primary Color</p>
                    <p className="text-sm text-gray-500">Accent color for buttons and interactive elements</p>
                  </div>
                </div>
                <input
                  type="color"
                  value={project.embedPrimaryColor || '#10B981'}
                  onChange={(e) => {
                    toggleSetting.mutate({ key: 'embedPrimaryColor', value: e.target.value } as any)
                  }}
                  className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                />
              </div>

              {/* Font Family */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <Type size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Font Family</p>
                    <p className="text-sm text-gray-500">Choose a Google Font for embed text</p>
                  </div>
                </div>
                <select
                  value={project.embedFontFamily || ''}
                  onChange={(e) => {
                    toggleSetting.mutate({ key: 'embedFontFamily', value: e.target.value || null } as any)
                  }}
                  className="w-40 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Default (System)</option>
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Open Sans">Open Sans</option>
                  <option value="Lato">Lato</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Source Sans Pro">Source Sans Pro</option>
                  <option value="Nunito">Nunito</option>
                  <option value="Raleway">Raleway</option>
                </select>
              </div>

              {/* Hide Street Labels Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <MapIcon size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Hide Street Labels</p>
                    <p className="text-sm text-gray-500">Show a cleaner map without street names</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSetting.mutate({ key: 'embedHideStreetLabels', value: !project.embedHideStreetLabels })}
                  disabled={toggling === 'embedHideStreetLabels'}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    project.embedHideStreetLabels ? 'bg-brand-500' : 'bg-gray-300'
                  } ${toggling === 'embedHideStreetLabels' ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      project.embedHideStreetLabels ? 'left-6' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
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
                    data-tour="embed-copy"
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

