'use client'

import { useEffect, useRef, useState } from 'react'
import Marzipano from 'marzipano'
import { Crosshair } from 'lucide-react'

interface PanoramaHotspot {
  id: string
  type: 'info' | 'link' | 'video' | 'image'
  yaw: number
  pitch: number
  title: string | null
}

interface Panorama {
  id: string
  name: string
  description: string | null
  imageUrl: string
  initialYaw: number
  initialPitch: number
  initialFov: number
  hotspots: PanoramaHotspot[]
}

interface PanoramaPreviewProps {
  panorama: Panorama
  isEditing: boolean
  currentPosition: { yaw: number; pitch: number }
  onPositionClick: (yaw: number, pitch: number) => void
}

export default function PanoramaPreview({
  panorama,
  isEditing,
  currentPosition,
  onPositionClick
}: PanoramaPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Marzipano.Viewer | null>(null)
  const sceneRef = useRef<Marzipano.Scene | null>(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [currentView, setCurrentView] = useState({ yaw: 0, pitch: 0 })

  // Initialize viewer
  useEffect(() => {
    if (!containerRef.current) return

    const viewer = new Marzipano.Viewer(containerRef.current, {
      controls: {
        mouseViewMode: 'drag'
      }
    })
    viewerRef.current = viewer
    setViewerReady(true)

    return () => {
      viewer.destroy()
      viewerRef.current = null
    }
  }, [])

  // Load panorama
  useEffect(() => {
    if (!viewerRef.current || !panorama || !viewerReady) return

    const viewer = viewerRef.current

    const geometry = new Marzipano.EquirectGeometry([{ width: 4096 }])
    const limiter = Marzipano.RectilinearView.limit.traditional(
      4096,
      (120 * Math.PI) / 180
    )

    const view = new Marzipano.RectilinearView(
      {
        yaw: (panorama.initialYaw * Math.PI) / 180,
        pitch: (panorama.initialPitch * Math.PI) / 180,
        fov: (panorama.initialFov * Math.PI) / 180
      },
      limiter
    )

    const source = Marzipano.ImageUrlSource.fromString(panorama.imageUrl)

    const scene = viewer.createScene({
      source,
      geometry,
      view,
      pinFirstLevel: true
    })

    sceneRef.current = scene
    scene.switchTo()

    // Add existing hotspots
    const hotspotContainer = scene.hotspotContainer()
    panorama.hotspots.forEach(hotspot => {
      const element = createHotspotMarker(hotspot)
      hotspotContainer.createHotspot(element, {
        yaw: (hotspot.yaw * Math.PI) / 180,
        pitch: (hotspot.pitch * Math.PI) / 180
      })
    })

    // Track view changes
    const handleViewChange = () => {
      const currentYaw = (view.yaw() * 180) / Math.PI
      const currentPitch = (view.pitch() * 180) / Math.PI
      setCurrentView({ yaw: currentYaw, pitch: currentPitch })
    }

    view.addEventListener('change', handleViewChange)

    return () => {
      view.removeEventListener('change', handleViewChange)
      scene.destroy()
    }
  }, [panorama, viewerReady])

  // Update editing marker position
  useEffect(() => {
    if (!sceneRef.current || !isEditing) return

    const scene = sceneRef.current
    const hotspotContainer = scene.hotspotContainer()

    // Remove existing editing marker
    const existingMarker = document.getElementById('editing-hotspot-marker')
    if (existingMarker) {
      existingMarker.remove()
    }

    // Add new editing marker
    const marker = document.createElement('div')
    marker.id = 'editing-hotspot-marker'
    marker.style.cssText = `
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #10B981;
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -50%);
      animation: pulse 2s infinite;
    `
    marker.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    `

    hotspotContainer.createHotspot(marker, {
      yaw: (currentPosition.yaw * Math.PI) / 180,
      pitch: (currentPosition.pitch * Math.PI) / 180
    })

    return () => {
      marker.remove()
    }
  }, [currentPosition, isEditing])

  const createHotspotMarker = (hotspot: PanoramaHotspot) => {
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transform: translate(-50%, -50%);
      pointer-events: none;
    `

    const iconSvg = getHotspotIcon(hotspot.type)
    wrapper.innerHTML = iconSvg

    return wrapper
  }

  const getHotspotIcon = (type: string) => {
    const style = 'width="16" height="16" stroke="white" stroke-width="2" fill="none"'
    switch (type) {
      case 'info':
        return `<svg ${style} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
      case 'link':
        return `<svg ${style} viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`
      case 'video':
        return `<svg ${style} viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" fill="white"/></svg>`
      case 'image':
        return `<svg ${style} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
      default:
        return `<svg ${style} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`
    }
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!isEditing || !sceneRef.current || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const view = sceneRef.current.view() as Marzipano.RectilinearView

    // Convert screen coordinates to yaw/pitch
    const coords = view.screenToCoordinates({ x, y })
    if (coords) {
      const yaw = (coords.yaw * 180) / Math.PI
      const pitch = (coords.pitch * 180) / Math.PI
      onPositionClick(yaw, pitch)
    }
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ background: '#000', cursor: isEditing ? 'crosshair' : 'grab' }}
        onClick={handleContainerClick}
      />

      {/* Editing mode indicator */}
      {isEditing && (
        <div className="absolute top-4 left-4 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium flex items-center gap-2">
          <Crosshair className="w-4 h-4" />
          Click to set hotspot position
        </div>
      )}

      {/* Current view info */}
      <div className="absolute bottom-4 left-4 px-3 py-2 bg-black/70 text-white rounded-lg text-xs font-mono">
        Yaw: {currentView.yaw.toFixed(1)}° · Pitch: {currentView.pitch.toFixed(1)}°
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 12px rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  )
}
