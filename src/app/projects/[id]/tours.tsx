'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, GripVertical, Edit2, Trash2, MapPin, Eye, EyeOff, ChevronDown, ChevronUp, X, Pentagon, Highlighter, Check, Navigation, ZoomIn, Type } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ImageOverlay, MapDrawing, SpotlightPolygon } from '@/components/InteractiveMap'

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

interface HighlightGeometry {
  type: 'Polygon'
  coordinates: number[][][]
}

type WizardStep = 'position' | 'frame' | 'highlight' | 'content'

const WIZARD_STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: 'position', label: 'Position', icon: Navigation },
  { id: 'frame', label: 'Frame', icon: ZoomIn },
  { id: 'highlight', label: 'Highlight', icon: Pentagon },
  { id: 'content', label: 'Content', icon: Type },
]

interface TourStop {
  id: string
  order: number
  title: string
  description: string
  imageUrl: string | null
  latitude: number
  longitude: number
  zoom: number
  highlight: HighlightGeometry | null
  showOverlay: string | null
}

interface Tour {
  id: string
  name: string
  description: string | null
  active: boolean
  stops: TourStop[]
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

interface Project {
  latitude: number | null
  longitude: number | null
  mapZoom: number | null
  imageOverlays?: DBImageOverlay[]
}

// Convert DB overlays to component format - always visible for tours
const convertOverlays = (dbOverlays: DBImageOverlay[] | undefined): ImageOverlay[] =>
  (dbOverlays || []).map(o => ({
    id: o.id,
    name: o.name,
    imageUrl: o.imageUrl,
    bounds: [[o.southLat, o.westLng], [o.northLat, o.eastLng]] as [[number, number], [number, number]],
    opacity: o.opacity,
    rotation: o.rotation || 0,
    visible: true, // Always show overlays in tours map
  }))

export function ToursTab({ projectId, project }: { projectId: string; project: Project }) {
  const queryClient = useQueryClient()
  const [editingTour, setEditingTour] = useState<Tour | null>(null)
  const [editingStop, setEditingStop] = useState<TourStop | null>(null)
  const [isCreatingTour, setIsCreatingTour] = useState(false)
  const [isAddingStop, setIsAddingStop] = useState(false)
  const [newTourName, setNewTourName] = useState('')
  const [newTourDesc, setNewTourDesc] = useState('')
  const [clickedPosition, setClickedPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null)
  const [overlays, setOverlays] = useState<ImageOverlay[]>(() => convertOverlays(project.imageOverlays))
  const [isDrawingHighlight, setIsDrawingHighlight] = useState(false)
  const [currentHighlight, setCurrentHighlight] = useState<HighlightGeometry | null>(null)
  const [wizardStep, setWizardStep] = useState<WizardStep>('position')
  const [stopZoom, setStopZoom] = useState(16)

  // Sync overlays when project data changes
  useEffect(() => {
    setOverlays(convertOverlays(project.imageOverlays))
  }, [project.imageOverlays])

  // Fetch tours
  const { data: tours = [], isLoading } = useQuery<Tour[]>({
    queryKey: ['tours', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tours`)
      if (!res.ok) throw new Error('Failed to fetch tours')
      return res.json()
    }
  })

  // Create tour mutation
  const createTour = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch(`/api/projects/${projectId}/tours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to create tour')
      return res.json()
    },
    onSuccess: (tour) => {
      queryClient.invalidateQueries({ queryKey: ['tours', projectId] })
      setIsCreatingTour(false)
      setNewTourName('')
      setNewTourDesc('')
      setExpandedTourId(tour.id)
    }
  })

  // Update tour mutation
  const updateTour = useMutation({
    mutationFn: async ({ tourId, data }: { tourId: string; data: Partial<Tour> }) => {
      const res = await fetch(`/api/projects/${projectId}/tours/${tourId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update tour')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours', projectId] })
      setEditingTour(null)
    }
  })

  // Delete tour mutation
  const deleteTour = useMutation({
    mutationFn: async (tourId: string) => {
      const res = await fetch(`/api/projects/${projectId}/tours/${tourId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete tour')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours', projectId] })
    }
  })

  // Create stop mutation
  const createStop = useMutation({
    mutationFn: async ({ tourId, data }: { tourId: string; data: Partial<TourStop> }) => {
      const res = await fetch(`/api/projects/${projectId}/tours/${tourId}/stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to create stop')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours', projectId] })
      setIsAddingStop(false)
      setClickedPosition(null)
      setEditingStop(null)
    }
  })

  // Update stop mutation
  const updateStop = useMutation({
    mutationFn: async ({ tourId, stopId, data }: { tourId: string; stopId: string; data: Partial<TourStop> }) => {
      const res = await fetch(`/api/projects/${projectId}/tours/${tourId}/stops/${stopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update stop')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours', projectId] })
      setEditingStop(null)
    }
  })

  // Delete stop mutation
  const deleteStop = useMutation({
    mutationFn: async ({ tourId, stopId }: { tourId: string; stopId: string }) => {
      const res = await fetch(`/api/projects/${projectId}/tours/${tourId}/stops/${stopId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete stop')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours', projectId] })
    }
  })

  // Reorder stops mutation
  const reorderStops = useMutation({
    mutationFn: async ({ tourId, stops }: { tourId: string; stops: string[] }) => {
      const res = await fetch(`/api/projects/${projectId}/tours/${tourId}/stops/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stops })
      })
      if (!res.ok) throw new Error('Failed to reorder stops')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours', projectId] })
    }
  })

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isAddingStop && !isDrawingHighlight) {
      setClickedPosition({ lat, lng })
      setEditingStop({
        id: '',
        order: 0,
        title: '',
        description: '',
        imageUrl: null,
        latitude: lat,
        longitude: lng,
        zoom: 16,
        highlight: null,
        showOverlay: null
      })
    }
  }, [isAddingStop, isDrawingHighlight])

  const handleDrawingCreated = useCallback((geometry: GeoJSON.Geometry, type: 'polygon' | 'line') => {
    if (type === 'polygon' && geometry.type === 'Polygon') {
      const highlight: HighlightGeometry = {
        type: 'Polygon',
        coordinates: geometry.coordinates as number[][][]
      }
      setCurrentHighlight(highlight)
      if (editingStop) {
        setEditingStop({ ...editingStop, highlight })
      }
      setIsDrawingHighlight(false)
    }
  }, [editingStop])

  const moveStop = (tour: Tour, stopId: string, direction: 'up' | 'down') => {
    const stopIndex = tour.stops.findIndex(s => s.id === stopId)
    if (stopIndex === -1) return

    const newIndex = direction === 'up' ? stopIndex - 1 : stopIndex + 1
    if (newIndex < 0 || newIndex >= tour.stops.length) return

    const newOrder = [...tour.stops]
    const [moved] = newOrder.splice(stopIndex, 1)
    newOrder.splice(newIndex, 0, moved)

    reorderStops.mutate({
      tourId: tour.id,
      stops: newOrder.map(s => s.id)
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Guided Tours</h2>
          <p className="text-sm text-slate-500">
            Create interactive tours to guide visitors through your masterplan
          </p>
        </div>
        <button
          onClick={() => setIsCreatingTour(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus size={16} />
          Create Tour
        </button>
      </div>

      {/* Create Tour Form */}
      {isCreatingTour && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-slate-900">New Tour</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tour Name</label>
            <input
              type="text"
              value={newTourName}
              onChange={(e) => setNewTourName(e.target.value)}
              placeholder="e.g., Development Overview Tour"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
            <textarea
              value={newTourDesc}
              onChange={(e) => setNewTourDesc(e.target.value)}
              placeholder="A brief description of what this tour covers..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createTour.mutate({ name: newTourName, description: newTourDesc })}
              disabled={!newTourName.trim() || createTour.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createTour.isPending ? 'Creating...' : 'Create Tour'}
            </button>
            <button
              onClick={() => {
                setIsCreatingTour(false)
                setNewTourName('')
                setNewTourDesc('')
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tours List */}
      {tours.length === 0 && !isCreatingTour ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <MapPin size={32} className="mx-auto text-slate-400 mb-3" />
          <p className="text-slate-600 font-medium">No tours yet</p>
          <p className="text-sm text-slate-500 mt-1">Create a tour to guide visitors through your masterplan</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tours.map(tour => (
            <div key={tour.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              {/* Tour Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedTourId(expandedTourId === tour.id ? null : tour.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedTourId === tour.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  <div>
                    <h3 className="font-medium text-slate-900">{tour.name}</h3>
                    {tour.description && (
                      <p className="text-sm text-slate-500">{tour.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{tour.stops.length} stops</p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => updateTour.mutate({ tourId: tour.id, data: { active: !tour.active } })}
                    className={`p-2 rounded-lg transition-colors ${
                      tour.active
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-slate-400 hover:bg-slate-100'
                    }`}
                    title={tour.active ? 'Active - Click to disable' : 'Inactive - Click to enable'}
                  >
                    {tour.active ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                  <button
                    onClick={() => setEditingTour(tour)}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this tour?')) {
                        deleteTour.mutate(tour.id)
                      }
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Expanded Tour Content */}
              {expandedTourId === tour.id && (
                <div className="border-t border-slate-200 p-4">
                  {/* Stops List */}
                  <div className="space-y-2 mb-4">
                    {tour.stops.map((stop, index) => (
                      <div
                        key={stop.id}
                        className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg"
                      >
                        <GripVertical size={16} className="text-slate-400 cursor-grab" />
                        <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900 truncate">{stop.title}</p>
                            {stop.highlight && (
                              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                <Pentagon size={10} />
                                Highlight
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">{stop.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveStop(tour, stop.id, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            onClick={() => moveStop(tour, stop.id, 'down')}
                            disabled={index === tour.stops.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            onClick={() => setEditingStop(stop)}
                            className="p-1 text-slate-500 hover:text-slate-700"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this stop?')) {
                                deleteStop.mutate({ tourId: tour.id, stopId: stop.id })
                              }
                            }}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Stop Button / Wizard */}
                  {isAddingStop && expandedTourId === tour.id ? (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                      {/* Wizard Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
                        <h4 className="font-medium text-slate-900">Add Tour Stop</h4>
                        <button
                          onClick={() => {
                            setIsAddingStop(false)
                            setClickedPosition(null)
                            setEditingStop(null)
                            setCurrentHighlight(null)
                            setIsDrawingHighlight(false)
                            setWizardStep('position')
                            setStopZoom(16)
                          }}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="flex">
                        {/* Step Indicators - Sidebar */}
                        <div className="w-40 bg-white border-r border-slate-200 p-3 space-y-1">
                          {WIZARD_STEPS.map((step, idx) => {
                            const stepIndex = WIZARD_STEPS.findIndex(s => s.id === wizardStep)
                            const isComplete = idx < stepIndex
                            const isCurrent = step.id === wizardStep
                            const isDisabled = idx > stepIndex && !(
                              (step.id === 'frame' && clickedPosition) ||
                              (step.id === 'highlight' && clickedPosition) ||
                              (step.id === 'content' && clickedPosition)
                            )

                            return (
                              <button
                                key={step.id}
                                onClick={() => !isDisabled && setWizardStep(step.id)}
                                disabled={isDisabled}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  isCurrent
                                    ? 'bg-green-100 text-green-700 font-medium'
                                    : isComplete
                                    ? 'text-green-600 hover:bg-green-50'
                                    : isDisabled
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                {isComplete ? (
                                  <Check size={16} className="text-green-600" />
                                ) : (
                                  <step.icon size={16} />
                                )}
                                <span>{step.label}</span>
                              </button>
                            )
                          })}
                        </div>

                        {/* Step Content */}
                        <div className="flex-1 p-4">
                          {/* Step 1: Position */}
                          {wizardStep === 'position' && (
                            <div className="space-y-3">
                              <p className="text-sm text-slate-600">Click on the map to place your tour stop marker.</p>
                              <div className="h-80 rounded-lg overflow-hidden border border-slate-200">
                                <InteractiveMap
                                  center={clickedPosition
                                    ? [clickedPosition.lat, clickedPosition.lng]
                                    : [project.latitude || 51.5074, project.longitude || -0.1278]}
                                  zoom={stopZoom}
                                  markers={[
                                    ...tour.stops.map((stop, idx) => ({
                                      id: stop.id,
                                      label: String(idx + 1),
                                      latitude: stop.latitude,
                                      longitude: stop.longitude,
                                      color: '#3B82F6',
                                      notes: stop.title,
                                    })),
                                    ...(clickedPosition ? [{
                                      id: 'new-stop',
                                      label: String(tour.stops.length + 1),
                                      latitude: clickedPosition.lat,
                                      longitude: clickedPosition.lng,
                                      color: '#16a34a',
                                      notes: null,
                                    }] : [])
                                  ]}
                                  overlays={overlays}
                                  isAddingMarker={true}
                                  onMapClick={handleMapClick}
                                />
                              </div>
                              {clickedPosition && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-green-600 flex items-center gap-1">
                                    <Check size={14} />
                                    Position set
                                  </span>
                                  <button
                                    onClick={() => setWizardStep('frame')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                                  >
                                    Next: Set Frame
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Step 2: Frame (Zoom) */}
                          {wizardStep === 'frame' && clickedPosition && (
                            <div className="space-y-3">
                              <p className="text-sm text-slate-600">Adjust the zoom level to frame your view.</p>
                              <div className="h-80 rounded-lg overflow-hidden border border-slate-200">
                                <InteractiveMap
                                  center={[clickedPosition.lat, clickedPosition.lng]}
                                  zoom={stopZoom}
                                  markers={[{
                                    id: 'new-stop',
                                    label: String(tour.stops.length + 1),
                                    latitude: clickedPosition.lat,
                                    longitude: clickedPosition.lng,
                                    color: '#16a34a',
                                    notes: null,
                                  }]}
                                  overlays={overlays}
                                  isAddingMarker={false}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700">
                                  Zoom Level: {stopZoom}
                                </label>
                                <input
                                  type="range"
                                  min="10"
                                  max="17"
                                  value={stopZoom}
                                  onChange={(e) => setStopZoom(parseInt(e.target.value))}
                                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                                />
                                <div className="flex justify-between text-xs text-slate-400">
                                  <span>Wide</span>
                                  <span>Close</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-2">
                                <button
                                  onClick={() => setWizardStep('position')}
                                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm"
                                >
                                  Back
                                </button>
                                <button
                                  onClick={() => setWizardStep('highlight')}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                                >
                                  Next: Highlight Area
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 3: Highlight */}
                          {wizardStep === 'highlight' && clickedPosition && (
                            <div className="space-y-3">
                              <p className="text-sm text-slate-600">
                                Draw a polygon to highlight an area of interest (optional).
                              </p>
                              <div className="h-80 rounded-lg overflow-hidden border border-slate-200">
                                <InteractiveMap
                                  center={[clickedPosition.lat, clickedPosition.lng]}
                                  zoom={stopZoom}
                                  markers={[{
                                    id: 'new-stop',
                                    label: String(tour.stops.length + 1),
                                    latitude: clickedPosition.lat,
                                    longitude: clickedPosition.lng,
                                    color: '#16a34a',
                                    notes: null,
                                  }]}
                                  overlays={overlays}
                                  spotlightPolygon={currentHighlight ? {
                                    coordinates: currentHighlight.coordinates,
                                    strokeColor: '#F59E0B',
                                    strokeWeight: 3
                                  } : null}
                                  isAddingMarker={false}
                                  isDrawingMode={isDrawingHighlight}
                                  activeDrawingTool={isDrawingHighlight ? 'polygon' : null}
                                  activeDrawingColor="#F59E0B"
                                  onDrawingCreated={handleDrawingCreated}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setIsDrawingHighlight(!isDrawingHighlight)}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    isDrawingHighlight
                                      ? 'bg-amber-100 text-amber-700 border-2 border-amber-400'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                                  }`}
                                >
                                  <Pentagon size={16} />
                                  {isDrawingHighlight ? 'Drawing... (click map)' : 'Draw Highlight'}
                                </button>
                                {currentHighlight && (
                                  <button
                                    type="button"
                                    onClick={() => setCurrentHighlight(null)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                  >
                                    <Trash2 size={16} />
                                    Clear
                                  </button>
                                )}
                                {currentHighlight && (
                                  <span className="text-sm text-green-600 flex items-center gap-1">
                                    <Check size={14} />
                                    Highlight set
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between pt-2">
                                <button
                                  onClick={() => setWizardStep('frame')}
                                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm"
                                >
                                  Back
                                </button>
                                <button
                                  onClick={() => {
                                    setWizardStep('content')
                                    setIsDrawingHighlight(false)
                                    if (!editingStop) {
                                      setEditingStop({
                                        id: '',
                                        order: 0,
                                        title: '',
                                        description: '',
                                        imageUrl: null,
                                        latitude: clickedPosition.lat,
                                        longitude: clickedPosition.lng,
                                        zoom: stopZoom,
                                        highlight: currentHighlight,
                                        showOverlay: null
                                      })
                                    }
                                  }}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                                >
                                  Next: Add Content
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 4: Content */}
                          {wizardStep === 'content' && clickedPosition && (
                            <div className="space-y-3">
                              <p className="text-sm text-slate-600">Add a title and description for this stop.</p>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Stop Title *</label>
                                <input
                                  type="text"
                                  value={editingStop?.title || ''}
                                  onChange={(e) => editingStop && setEditingStop({ ...editingStop, title: e.target.value })}
                                  placeholder="e.g., Welcome Centre"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                                <textarea
                                  value={editingStop?.description || ''}
                                  onChange={(e) => editingStop && setEditingStop({ ...editingStop, description: e.target.value })}
                                  placeholder="Describe this stop..."
                                  rows={4}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Image URL (optional)</label>
                                <input
                                  type="text"
                                  value={editingStop?.imageUrl || ''}
                                  onChange={(e) => editingStop && setEditingStop({ ...editingStop, imageUrl: e.target.value || null })}
                                  placeholder="https://..."
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                              </div>
                              <div className="flex items-center justify-between pt-2">
                                <button
                                  onClick={() => setWizardStep('highlight')}
                                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm"
                                >
                                  Back
                                </button>
                                <button
                                  onClick={() => {
                                    if (editingStop) {
                                      createStop.mutate({
                                        tourId: tour.id,
                                        data: {
                                          title: editingStop.title,
                                          description: editingStop.description,
                                          imageUrl: editingStop.imageUrl,
                                          latitude: clickedPosition.lat,
                                          longitude: clickedPosition.lng,
                                          zoom: stopZoom,
                                          highlight: currentHighlight,
                                        }
                                      })
                                      setCurrentHighlight(null)
                                      setWizardStep('position')
                                      setStopZoom(16)
                                    }
                                  }}
                                  disabled={!editingStop?.title?.trim() || !editingStop?.description?.trim() || createStop.isPending}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                                >
                                  {createStop.isPending ? 'Saving...' : 'Save Stop'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIsAddingStop(true)
                        setWizardStep('position')
                        setStopZoom(16)
                        setClickedPosition(null)
                        setEditingStop(null)
                        setCurrentHighlight(null)
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-green-400 hover:text-green-600 transition-colors"
                    >
                      <Plus size={18} />
                      Add Stop
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Tour Modal */}
      {editingTour && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Tour</h3>
              <button onClick={() => setEditingTour(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tour Name</label>
                <input
                  type="text"
                  value={editingTour.name}
                  onChange={(e) => setEditingTour({ ...editingTour, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={editingTour.description || ''}
                  onChange={(e) => setEditingTour({ ...editingTour, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateTour.mutate({
                    tourId: editingTour.id,
                    data: { name: editingTour.name, description: editingTour.description }
                  })}
                  disabled={!editingTour.name.trim() || updateTour.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {updateTour.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditingTour(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Stop Modal */}
      {editingStop && editingStop.id && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Stop</h3>
              <button onClick={() => setEditingStop(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stop Title</label>
                <input
                  type="text"
                  value={editingStop.title}
                  onChange={(e) => setEditingStop({ ...editingStop, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={editingStop.description}
                  onChange={(e) => setEditingStop({ ...editingStop, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Image URL (optional)</label>
                <input
                  type="text"
                  value={editingStop.imageUrl || ''}
                  onChange={(e) => setEditingStop({ ...editingStop, imageUrl: e.target.value || null })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zoom Level</label>
                <input
                  type="number"
                  min="10"
                  max="20"
                  value={editingStop.zoom}
                  onChange={(e) => setEditingStop({ ...editingStop, zoom: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              {/* Highlight Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Highlight Area</label>
                {editingStop.highlight ? (
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="flex items-center gap-2 text-sm text-amber-700">
                      <Pentagon size={16} />
                      Highlight area set
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingStop({ ...editingStop, highlight: null })}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">
                    No highlight area. Create a new stop to add one.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const tour = tours.find(t => t.stops.some(s => s.id === editingStop.id))
                    if (tour) {
                      updateStop.mutate({
                        tourId: tour.id,
                        stopId: editingStop.id,
                        data: {
                          title: editingStop.title,
                          description: editingStop.description,
                          imageUrl: editingStop.imageUrl,
                          zoom: editingStop.zoom,
                          highlight: editingStop.highlight,
                        }
                      })
                    }
                  }}
                  disabled={!editingStop.title.trim() || updateStop.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {updateStop.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditingStop(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
