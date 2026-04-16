'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Marzipano from 'marzipano'
import { gsap } from 'gsap'
import { Info, ArrowRight, Play, Image, X, ChevronLeft, ChevronRight } from 'lucide-react'
import InfoPanel from './InfoPanel'
import VideoPanel from './VideoPanel'
import SceneNav from './SceneNav'

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
  hotspots: PanoramaHotspot[]
}

interface PanoramaViewerProps {
  panorama: Panorama
  panoramas: Panorama[]
  primaryColor: string
  onNavigateToPanorama: (panoramaId: string) => void
}

export default function PanoramaViewer({
  panorama,
  panoramas,
  primaryColor,
  onNavigateToPanorama
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Marzipano.Viewer | null>(null)
  const sceneRef = useRef<Marzipano.Scene | null>(null)
  const [activePanel, setActivePanel] = useState<{
    type: 'info' | 'video' | 'image'
    hotspot: PanoramaHotspot
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize Marzipano viewer
  useEffect(() => {
    if (!containerRef.current) return

    // Create viewer
    const viewer = new Marzipano.Viewer(containerRef.current, {
      controls: {
        mouseViewMode: 'drag'
      }
    })
    viewerRef.current = viewer

    return () => {
      viewer.destroy()
      viewerRef.current = null
    }
  }, [])

  // Load panorama scene
  useEffect(() => {
    if (!viewerRef.current || !panorama) return

    setIsLoading(true)

    const viewer = viewerRef.current

    // Create geometry for equirectangular panorama
    const geometry = new Marzipano.EquirectGeometry([{ width: 4096 }])

    // Create view limiter
    const limiter = Marzipano.RectilinearView.limit.traditional(
      4096,
      (panorama.initialFov * Math.PI) / 180
    )

    // Create initial view
    const view = new Marzipano.RectilinearView(
      {
        yaw: (panorama.initialYaw * Math.PI) / 180,
        pitch: (panorama.initialPitch * Math.PI) / 180,
        fov: (panorama.initialFov * Math.PI) / 180
      },
      limiter
    )

    // Create image source
    const source = Marzipano.ImageUrlSource.fromString(panorama.imageUrl)

    // Create scene
    const scene = viewer.createScene({
      source,
      geometry,
      view,
      pinFirstLevel: true
    })

    sceneRef.current = scene

    // Switch to scene with fade transition
    scene.switchTo({
      transitionDuration: 500
    })

    // Add hotspots
    const hotspotContainer = scene.hotspotContainer()

    panorama.hotspots.forEach(hotspot => {
      const element = createHotspotElement(hotspot)
      hotspotContainer.createHotspot(element, {
        yaw: (hotspot.yaw * Math.PI) / 180,
        pitch: (hotspot.pitch * Math.PI) / 180
      })
    })

    // Handle load complete
    const handleLoad = () => {
      setIsLoading(false)
    }

    // Listen for first render
    viewer.stage().addEventListener('renderComplete', handleLoad)

    return () => {
      viewer.stage().removeEventListener('renderComplete', handleLoad)
      scene.destroy()
    }
  }, [panorama])

  // Create hotspot DOM element
  const createHotspotElement = useCallback((hotspot: PanoramaHotspot) => {
    const wrapper = document.createElement('div')
    wrapper.className = 'hotspot-wrapper'
    wrapper.style.cssText = `
      position: relative;
      cursor: pointer;
      transform: translate(-50%, -50%);
    `

    const marker = document.createElement('div')
    marker.className = 'hotspot-marker'
    marker.style.cssText = `
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: ${primaryColor};
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    `

    // Add icon based on type
    const iconSvg = getHotspotIcon(hotspot.type)
    marker.innerHTML = iconSvg

    marker.addEventListener('mouseenter', () => {
      marker.style.transform = 'scale(1.15)'
      marker.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)'
    })

    marker.addEventListener('mouseleave', () => {
      marker.style.transform = 'scale(1)'
      marker.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
    })

    marker.addEventListener('click', (e) => {
      e.stopPropagation()
      handleHotspotClick(hotspot)
    })

    // Add tooltip with title
    if (hotspot.title) {
      const tooltip = document.createElement('div')
      tooltip.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 8px;
        padding: 6px 12px;
        background: rgba(0,0,0,0.8);
        color: white;
        font-size: 14px;
        border-radius: 6px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      `
      tooltip.textContent = hotspot.title
      wrapper.appendChild(tooltip)

      marker.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1'
      })
      marker.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0'
      })
    }

    wrapper.appendChild(marker)
    return wrapper
  }, [primaryColor])

  const getHotspotIcon = (type: string) => {
    const iconStyle = 'width="24" height="24" stroke="white" stroke-width="2" fill="none"'
    switch (type) {
      case 'info':
        return `<svg ${iconStyle} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
      case 'link':
        return `<svg ${iconStyle} viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`
      case 'video':
        return `<svg ${iconStyle} viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" fill="white"/></svg>`
      case 'image':
        return `<svg ${iconStyle} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
      default:
        return `<svg ${iconStyle} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`
    }
  }

  const handleHotspotClick = (hotspot: PanoramaHotspot) => {
    switch (hotspot.type) {
      case 'link':
        if (hotspot.targetId) {
          onNavigateToPanorama(hotspot.targetId)
        }
        break
      case 'info':
      case 'video':
      case 'image':
        setActivePanel({ type: hotspot.type, hotspot })
        break
    }
  }

  const closePanel = () => {
    setActivePanel(null)
  }

  // Animate view to position
  const animateToView = (yaw: number, pitch: number, fov?: number) => {
    if (!sceneRef.current) return

    const view = sceneRef.current.view() as Marzipano.RectilinearView
    const currentParams = {
      yaw: view.yaw(),
      pitch: view.pitch(),
      fov: view.fov()
    }

    const targetParams = {
      yaw: (yaw * Math.PI) / 180,
      pitch: (pitch * Math.PI) / 180,
      fov: fov ? (fov * Math.PI) / 180 : currentParams.fov
    }

    gsap.to(currentParams, {
      duration: 1,
      yaw: targetParams.yaw,
      pitch: targetParams.pitch,
      fov: targetParams.fov,
      ease: 'power2.inOut',
      onUpdate: () => {
        view.setYaw(currentParams.yaw)
        view.setPitch(currentParams.pitch)
        view.setFov(currentParams.fov)
      }
    })
  }

  const currentIndex = panoramas.findIndex(p => p.id === panorama.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < panoramas.length - 1

  const goToPrev = () => {
    if (hasPrev) {
      onNavigateToPanorama(panoramas[currentIndex - 1].id)
    }
  }

  const goToNext = () => {
    if (hasNext) {
      onNavigateToPanorama(panoramas[currentIndex + 1].id)
    }
  }

  return (
    <div className="relative w-full h-full">
      {/* Marzipano container */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ background: '#000' }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-white text-lg">Loading panorama...</div>
        </div>
      )}

      {/* Panorama title overlay */}
      <div className="absolute top-4 left-4 z-20">
        <div
          className="px-4 py-2 rounded-lg"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <h2 className="text-white font-semibold text-lg">{panorama.name}</h2>
          {panorama.description && (
            <p className="text-gray-300 text-sm mt-1">{panorama.description}</p>
          )}
        </div>
      </div>

      {/* Navigation arrows (for multiple panoramas) */}
      {panoramas.length > 1 && (
        <>
          {hasPrev && (
            <button
              onClick={goToPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {hasNext && (
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </>
      )}

      {/* Scene navigation (thumbnails) */}
      {panoramas.length > 1 && (
        <SceneNav
          panoramas={panoramas}
          currentPanoramaId={panorama.id}
          onNavigate={onNavigateToPanorama}
          primaryColor={primaryColor}
        />
      )}

      {/* Info Panel */}
      {activePanel?.type === 'info' && (
        <InfoPanel
          hotspot={activePanel.hotspot}
          onClose={closePanel}
          primaryColor={primaryColor}
        />
      )}

      {/* Video Panel */}
      {activePanel?.type === 'video' && activePanel.hotspot.videoUrl && (
        <VideoPanel
          hotspot={activePanel.hotspot}
          onClose={closePanel}
          primaryColor={primaryColor}
        />
      )}

      {/* Image Lightbox */}
      {activePanel?.type === 'image' && activePanel.hotspot.imageUrl && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={closePanel}
        >
          <button
            onClick={closePanel}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={activePanel.hotspot.imageUrl}
            alt={activePanel.hotspot.title || 'Image'}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {activePanel.hotspot.title && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/70 text-white">
              {activePanel.hotspot.title}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
