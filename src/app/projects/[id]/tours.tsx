'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, GripVertical, Edit2, Trash2, MapPin, Eye, EyeOff, ChevronDown, ChevronUp, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ImageOverlay } from '@/components/InteractiveMap'

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

interface TourStop {
  id: string
  order: number
  title: string
  description: string
  imageUrl: string | null
  latitude: number
  longitude: number
  zoom: number
  highlight: unknown | null
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
    if (isAddingStop) {
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
  }, [isAddingStop])

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
                          <p className="font-medium text-slate-900 truncate">{stop.title}</p>
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

                  {/* Add Stop Button / Map */}
                  {isAddingStop && expandedTourId === tour.id ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-600">Click on the map to place the stop</p>
                        <button
                          onClick={() => {
                            setIsAddingStop(false)
                            setClickedPosition(null)
                            setEditingStop(null)
                          }}
                          className="text-sm text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="h-64 rounded-lg overflow-hidden border border-slate-200">
                        <InteractiveMap
                          center={[project.latitude || 51.5074, project.longitude || -0.1278]}
                          zoom={project.mapZoom || 14}
                          markers={[
                            // Existing stops as markers
                            ...tour.stops.map((stop, idx) => ({
                              id: stop.id,
                              label: String(idx + 1),
                              latitude: stop.latitude,
                              longitude: stop.longitude,
                              color: '#3B82F6',
                              notes: stop.title,
                            })),
                            // Clicked position as a new marker
                            ...(clickedPosition ? [{
                              id: 'new-stop',
                              label: 'New',
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

                      {/* Stop Form (when position is clicked) */}
                      {editingStop && clickedPosition && (
                        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Stop Title</label>
                            <input
                              type="text"
                              value={editingStop.title}
                              onChange={(e) => setEditingStop({ ...editingStop, title: e.target.value })}
                              placeholder="e.g., Welcome Centre"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                            <textarea
                              value={editingStop.description}
                              onChange={(e) => setEditingStop({ ...editingStop, description: e.target.value })}
                              placeholder="Describe this stop..."
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
                          <div className="grid grid-cols-2 gap-3">
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
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => createStop.mutate({
                                tourId: tour.id,
                                data: {
                                  title: editingStop.title,
                                  description: editingStop.description,
                                  imageUrl: editingStop.imageUrl,
                                  latitude: clickedPosition.lat,
                                  longitude: clickedPosition.lng,
                                  zoom: editingStop.zoom,
                                }
                              })}
                              disabled={!editingStop.title.trim() || !editingStop.description.trim() || createStop.isPending}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              {createStop.isPending ? 'Adding...' : 'Add Stop'}
                            </button>
                            <button
                              onClick={() => {
                                setClickedPosition(null)
                                setEditingStop(null)
                              }}
                              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingStop(true)}
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
