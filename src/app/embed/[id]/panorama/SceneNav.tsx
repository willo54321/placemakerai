'use client'

import { useRef, useEffect, useState } from 'react'
import { gsap } from 'gsap'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface Panorama {
  id: string
  name: string
  description: string | null
  imageUrl: string
  initialYaw: number
  initialPitch: number
  initialFov: number
  order: number
}

interface SceneNavProps {
  panoramas: Panorama[]
  currentPanoramaId: string
  onNavigate: (panoramaId: string) => void
  primaryColor: string
}

export default function SceneNav({
  panoramas,
  currentPanoramaId,
  onNavigate,
  primaryColor
}: SceneNavProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [thumbnailErrors, setThumbnailErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (containerRef.current) {
      if (isExpanded) {
        gsap.to(containerRef.current, {
          height: 'auto',
          duration: 0.3,
          ease: 'power2.out'
        })
      } else {
        gsap.to(containerRef.current, {
          height: 80,
          duration: 0.3,
          ease: 'power2.in'
        })
      }
    }
  }, [isExpanded])

  const handleThumbnailError = (id: string) => {
    setThumbnailErrors(prev => {
      const newSet = new Set(prev)
      newSet.add(id)
      return newSet
    })
  }

  const currentIndex = panoramas.findIndex(p => p.id === currentPanoramaId)

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
      {/* Expand/collapse toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-1 rounded-t-lg bg-black/70 hover:bg-black/80 text-white text-sm flex items-center gap-1 transition-colors"
      >
        {isExpanded ? (
          <>
            <ChevronDown className="w-4 h-4" />
            <span>Hide scenes</span>
          </>
        ) : (
          <>
            <ChevronUp className="w-4 h-4" />
            <span>
              Scene {currentIndex + 1} of {panoramas.length}
            </span>
          </>
        )}
      </button>

      {/* Thumbnails container */}
      <div
        ref={containerRef}
        className="bg-black/70 backdrop-blur-sm rounded-xl p-2 overflow-hidden"
        style={{ height: 80 }}
      >
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ maxWidth: '80vw' }}>
          {panoramas.map((panorama, index) => {
            const isActive = panorama.id === currentPanoramaId
            const hasError = thumbnailErrors.has(panorama.id)

            return (
              <button
                key={panorama.id}
                onClick={() => onNavigate(panorama.id)}
                className={`
                  relative flex-shrink-0 rounded-lg overflow-hidden transition-all duration-200
                  ${isActive ? '' : 'hover:opacity-80'}
                `}
                style={{
                  width: isExpanded ? 120 : 100,
                  height: isExpanded ? 80 : 60,
                  boxShadow: isActive ? `0 0 0 2px rgba(0,0,0,0.7), 0 0 0 4px ${primaryColor}` : undefined
                }}
              >
                {/* Thumbnail image */}
                {!hasError ? (
                  <img
                    src={panorama.imageUrl}
                    alt={panorama.name}
                    className="w-full h-full object-cover"
                    onError={() => handleThumbnailError(panorama.id)}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">No preview</span>
                  </div>
                )}

                {/* Scene number badge */}
                <div
                  className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: isActive ? primaryColor : 'rgba(0,0,0,0.6)' }}
                >
                  {index + 1}
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}

                {/* Name (only when expanded) */}
                {isExpanded && (
                  <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-xs truncate">{panorama.name}</p>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Progress dots (collapsed view) */}
      {!isExpanded && panoramas.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {panoramas.map((panorama, index) => (
            <button
              key={panorama.id}
              onClick={() => onNavigate(panorama.id)}
              className={`
                w-2 h-2 rounded-full transition-all duration-200
                ${panorama.id === currentPanoramaId
                  ? 'w-4'
                  : 'bg-white/50 hover:bg-white/70'
                }
              `}
              style={{
                backgroundColor: panorama.id === currentPanoramaId ? primaryColor : undefined
              }}
              title={panorama.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}
