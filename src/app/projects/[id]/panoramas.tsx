'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  GripVertical,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  ExternalLink,
  Info,
  ArrowRight,
  Play,
  Image as ImageIcon,
  Move
} from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import the panorama preview component
const PanoramaPreview = dynamic(() => import('./PanoramaPreview'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-900 rounded-lg">
      <div className="text-gray-400">Loading panorama preview...</div>
    </div>
  )
})

interface PanoramaHotspot {
  id: string
  type: 'info' | 'link' | 'video' | 'image'
  yaw: number
  pitch: number
  title: string | null
  content: string | null
  icon: string | null
  targetId: string | null
  videoUrl: string | null
  imageUrl: string | null
}

interface Panorama {
  id: string
  name: string
  description: string | null
  imageUrl: string
  initialYaw: number
  initialPitch: number
  initialFov: number
  order: number
  active: boolean
  hotspots: PanoramaHotspot[]
}

const HOTSPOT_TYPES = [
  { id: 'info', label: 'Information', icon: Info, description: 'Show info panel' },
  { id: 'link', label: 'Navigate', icon: ArrowRight, description: 'Go to another panorama' },
  { id: 'video', label: 'Video', icon: Play, description: 'Play video' },
  { id: 'image', label: 'Image', icon: ImageIcon, description: 'Show image lightbox' },
]

export function PanoramasTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [expandedPanoramaId, setExpandedPanoramaId] = useState<string | null>(null)
  const [isCreatingPanorama, setIsCreatingPanorama] = useState(false)
  const [editingPanorama, setEditingPanorama] = useState<Panorama | null>(null)
  const [editingHotspot, setEditingHotspot] = useState<PanoramaHotspot | null>(null)
  const [isAddingHotspot, setIsAddingHotspot] = useState(false)
  const [previewPanorama, setPreviewPanorama] = useState<Panorama | null>(null)

  // Form state for new panorama
  const [newPanorama, setNewPanorama] = useState({
    name: '',
    description: '',
    imageUrl: '',
    initialYaw: 0,
    initialPitch: 0,
    initialFov: 100
  })

  // Form state for hotspot
  const [hotspotForm, setHotspotForm] = useState({
    type: 'info' as 'info' | 'link' | 'video' | 'image',
    yaw: 0,
    pitch: 0,
    title: '',
    content: '',
    targetId: '',
    videoUrl: '',
    imageUrl: ''
  })

  // Fetch panoramas
  const { data: panoramas = [], isLoading } = useQuery<Panorama[]>({
    queryKey: ['panoramas', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/panoramas`)
      if (!res.ok) throw new Error('Failed to fetch panoramas')
      return res.json()
    }
  })

  // Create panorama mutation
  const createPanorama = useMutation({
    mutationFn: async (data: typeof newPanorama) => {
      const res = await fetch(`/api/projects/${projectId}/panoramas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to create panorama')
      return res.json()
    },
    onSuccess: (panorama) => {
      queryClient.invalidateQueries({ queryKey: ['panoramas', projectId] })
      setIsCreatingPanorama(false)
      setNewPanorama({
        name: '',
        description: '',
        imageUrl: '',
        initialYaw: 0,
        initialPitch: 0,
        initialFov: 100
      })
      setExpandedPanoramaId(panorama.id)
    }
  })

  // Update panorama mutation
  const updatePanorama = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Panorama> }) => {
      const res = await fetch(`/api/projects/${projectId}/panoramas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update panorama')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panoramas', projectId] })
      setEditingPanorama(null)
    }
  })

  // Delete panorama mutation
  const deletePanorama = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${projectId}/panoramas/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete panorama')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panoramas', projectId] })
    }
  })

  // Create hotspot mutation
  const createHotspot = useMutation({
    mutationFn: async ({ panoramaId, data }: { panoramaId: string; data: Partial<PanoramaHotspot> }) => {
      const res = await fetch(`/api/projects/${projectId}/panoramas/${panoramaId}/hotspots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to create hotspot')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panoramas', projectId] })
      setIsAddingHotspot(false)
      resetHotspotForm()
    }
  })

  // Update hotspot mutation
  const updateHotspot = useMutation({
    mutationFn: async ({ panoramaId, hotspotId, data }: { panoramaId: string; hotspotId: string; data: Partial<PanoramaHotspot> }) => {
      const res = await fetch(`/api/projects/${projectId}/panoramas/${panoramaId}/hotspots/${hotspotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update hotspot')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panoramas', projectId] })
      setEditingHotspot(null)
      resetHotspotForm()
    }
  })

  // Delete hotspot mutation
  const deleteHotspot = useMutation({
    mutationFn: async ({ panoramaId, hotspotId }: { panoramaId: string; hotspotId: string }) => {
      const res = await fetch(`/api/projects/${projectId}/panoramas/${panoramaId}/hotspots/${hotspotId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete hotspot')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panoramas', projectId] })
    }
  })

  const resetHotspotForm = () => {
    setHotspotForm({
      type: 'info',
      yaw: 0,
      pitch: 0,
      title: '',
      content: '',
      targetId: '',
      videoUrl: '',
      imageUrl: ''
    })
  }

  const handleHotspotPositionFromPreview = (yaw: number, pitch: number) => {
    setHotspotForm(prev => ({ ...prev, yaw, pitch }))
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading panoramas...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">360° Panoramas</h2>
          <p className="text-sm text-gray-500">
            Create immersive panorama experiences with interactive hotspots
          </p>
        </div>
        <button
          onClick={() => setIsCreatingPanorama(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Panorama
        </button>
      </div>

      {/* Create panorama form */}
      {isCreatingPanorama && (
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <h3 className="font-medium text-gray-900 mb-4">Create New Panorama</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={newPanorama.name}
                onChange={(e) => setNewPanorama(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., Entrance View"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL *
              </label>
              <input
                type="url"
                value={newPanorama.imageUrl}
                onChange={(e) => setNewPanorama(prev => ({ ...prev, imageUrl: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="https://example.com/panorama.jpg"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={newPanorama.description}
                onChange={(e) => setNewPanorama(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Yaw (degrees)
              </label>
              <input
                type="number"
                value={newPanorama.initialYaw}
                onChange={(e) => setNewPanorama(prev => ({ ...prev, initialYaw: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                min="-180"
                max="180"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Pitch (degrees)
              </label>
              <input
                type="number"
                value={newPanorama.initialPitch}
                onChange={(e) => setNewPanorama(prev => ({ ...prev, initialPitch: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                min="-90"
                max="90"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial FOV: {newPanorama.initialFov}°
              </label>
              <input
                type="range"
                value={newPanorama.initialFov}
                onChange={(e) => setNewPanorama(prev => ({ ...prev, initialFov: parseFloat(e.target.value) }))}
                className="w-full"
                min="30"
                max="120"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setIsCreatingPanorama(false)
                setNewPanorama({
                  name: '',
                  description: '',
                  imageUrl: '',
                  initialYaw: 0,
                  initialPitch: 0,
                  initialFov: 100
                })
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => createPanorama.mutate(newPanorama)}
              disabled={!newPanorama.name || !newPanorama.imageUrl || createPanorama.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createPanorama.isPending ? 'Creating...' : 'Create Panorama'}
            </button>
          </div>
        </div>
      )}

      {/* Panoramas list */}
      {panoramas.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed">
          <div className="text-gray-400 mb-2">
            <ImageIcon className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No panoramas yet</h3>
          <p className="text-gray-500 mb-4">Create your first 360° panorama to get started</p>
          <button
            onClick={() => setIsCreatingPanorama(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Panorama
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {panoramas.map((panorama, index) => (
            <div
              key={panorama.id}
              className="bg-white border rounded-xl shadow-sm overflow-hidden"
            >
              {/* Panorama header */}
              <div className="flex items-center gap-4 p-4">
                <div className="flex-shrink-0 text-gray-400">
                  <GripVertical className="w-5 h-5" />
                </div>

                {/* Thumbnail */}
                <div className="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={panorama.imageUrl}
                    alt={panorama.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23e5e7eb" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%239ca3af">No preview</text></svg>'
                    }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">{panorama.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${panorama.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {panorama.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {panorama.hotspots.length} hotspot{panorama.hotspots.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewPanorama(panorama)}
                    className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => updatePanorama.mutate({ id: panorama.id, data: { active: !panorama.active } })}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title={panorama.active ? 'Deactivate' : 'Activate'}
                  >
                    {panorama.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this panorama?')) {
                        deletePanorama.mutate(panorama.id)
                      }
                    }}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpandedPanoramaId(expandedPanoramaId === panorama.id ? null : panorama.id)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {expandedPanoramaId === panorama.id ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              {expandedPanoramaId === panorama.id && (
                <div className="border-t p-4 bg-gray-50">
                  {/* Hotspots section */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Hotspots</h4>
                      <button
                        onClick={() => {
                          setIsAddingHotspot(true)
                          setPreviewPanorama(panorama)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add Hotspot
                      </button>
                    </div>

                    {panorama.hotspots.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No hotspots added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {panorama.hotspots.map((hotspot) => {
                          const typeInfo = HOTSPOT_TYPES.find(t => t.id === hotspot.type)
                          const TypeIcon = typeInfo?.icon || Info

                          return (
                            <div
                              key={hotspot.id}
                              className="flex items-center gap-3 p-3 bg-white rounded-lg border"
                            >
                              <div className="p-2 bg-emerald-100 rounded-lg">
                                <TypeIcon className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">
                                  {hotspot.title || 'Untitled'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {typeInfo?.label} · Yaw: {hotspot.yaw.toFixed(1)}° · Pitch: {hotspot.pitch.toFixed(1)}°
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingHotspot(hotspot)
                                  setHotspotForm({
                                    type: hotspot.type,
                                    yaw: hotspot.yaw,
                                    pitch: hotspot.pitch,
                                    title: hotspot.title || '',
                                    content: hotspot.content || '',
                                    targetId: hotspot.targetId || '',
                                    videoUrl: hotspot.videoUrl || '',
                                    imageUrl: hotspot.imageUrl || ''
                                  })
                                  setPreviewPanorama(panorama)
                                }}
                                className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Delete this hotspot?')) {
                                    deleteHotspot.mutate({ panoramaId: panorama.id, hotspotId: hotspot.id })
                                  }
                                }}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Edit panorama details */}
                  <div className="pt-4 border-t">
                    <button
                      onClick={() => setEditingPanorama(panorama)}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit panorama details
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview modal with hotspot editor */}
      {previewPanorama && (
        <div className="fixed inset-0 z-50 flex">
          {/* Panorama preview */}
          <div className="flex-1 bg-black relative">
            <PanoramaPreview
              panorama={previewPanorama}
              isEditing={isAddingHotspot || !!editingHotspot}
              currentPosition={{ yaw: hotspotForm.yaw, pitch: hotspotForm.pitch }}
              onPositionClick={handleHotspotPositionFromPreview}
            />
            <button
              onClick={() => {
                setPreviewPanorama(null)
                setIsAddingHotspot(false)
                setEditingHotspot(null)
                resetHotspotForm()
              }}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Hotspot editor panel */}
          {(isAddingHotspot || editingHotspot) && (
            <div className="w-96 bg-white border-l overflow-y-auto">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-900">
                  {editingHotspot ? 'Edit Hotspot' : 'Add Hotspot'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Click on the panorama to set the position
                </p>
              </div>

              <div className="p-4 space-y-4">
                {/* Hotspot type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {HOTSPOT_TYPES.map((type) => {
                      const Icon = type.icon
                      return (
                        <button
                          key={type.id}
                          onClick={() => setHotspotForm(prev => ({ ...prev, type: type.id as typeof prev.type }))}
                          className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                            hotspotForm.type === type.id
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm font-medium">{type.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Position */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Yaw (°)
                    </label>
                    <input
                      type="number"
                      value={hotspotForm.yaw}
                      onChange={(e) => setHotspotForm(prev => ({ ...prev, yaw: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pitch (°)
                    </label>
                    <input
                      type="number"
                      value={hotspotForm.pitch}
                      onChange={(e) => setHotspotForm(prev => ({ ...prev, pitch: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      step="0.1"
                    />
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={hotspotForm.title}
                    onChange={(e) => setHotspotForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Hotspot title"
                  />
                </div>

                {/* Type-specific fields */}
                {hotspotForm.type === 'info' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content
                    </label>
                    <textarea
                      value={hotspotForm.content}
                      onChange={(e) => setHotspotForm(prev => ({ ...prev, content: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Information to display..."
                    />
                  </div>
                )}

                {hotspotForm.type === 'link' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Panorama
                    </label>
                    <select
                      value={hotspotForm.targetId}
                      onChange={(e) => setHotspotForm(prev => ({ ...prev, targetId: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select a panorama...</option>
                      {panoramas
                        .filter(p => p.id !== previewPanorama.id)
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                  </div>
                )}

                {hotspotForm.type === 'video' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Video URL
                    </label>
                    <input
                      type="url"
                      value={hotspotForm.videoUrl}
                      onChange={(e) => setHotspotForm(prev => ({ ...prev, videoUrl: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="https://..."
                    />
                  </div>
                )}

                {hotspotForm.type === 'image' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={hotspotForm.imageUrl}
                      onChange={(e) => setHotspotForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="https://..."
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t bg-gray-50 flex gap-2">
                <button
                  onClick={() => {
                    setIsAddingHotspot(false)
                    setEditingHotspot(null)
                    resetHotspotForm()
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (editingHotspot) {
                      updateHotspot.mutate({
                        panoramaId: previewPanorama.id,
                        hotspotId: editingHotspot.id,
                        data: hotspotForm
                      })
                    } else {
                      createHotspot.mutate({
                        panoramaId: previewPanorama.id,
                        data: hotspotForm
                      })
                    }
                  }}
                  disabled={createHotspot.isPending || updateHotspot.isPending}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {editingHotspot ? 'Save Changes' : 'Add Hotspot'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit panorama modal */}
      {editingPanorama && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Edit Panorama</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editingPanorama.name}
                  onChange={(e) => setEditingPanorama(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={editingPanorama.imageUrl}
                  onChange={(e) => setEditingPanorama(prev => prev ? { ...prev, imageUrl: e.target.value } : null)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editingPanorama.description || ''}
                  onChange={(e) => setEditingPanorama(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setEditingPanorama(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingPanorama) {
                    updatePanorama.mutate({
                      id: editingPanorama.id,
                      data: {
                        name: editingPanorama.name,
                        description: editingPanorama.description,
                        imageUrl: editingPanorama.imageUrl
                      }
                    })
                  }
                }}
                disabled={updatePanorama.isPending}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
