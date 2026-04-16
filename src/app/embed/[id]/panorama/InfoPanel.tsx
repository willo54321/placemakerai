'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { X } from 'lucide-react'

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

interface InfoPanelProps {
  hotspot: PanoramaHotspot
  onClose: () => void
  primaryColor: string
}

export default function InfoPanel({ hotspot, onClose, primaryColor }: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Animate panel in
    if (panelRef.current && overlayRef.current) {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' }
      )
      gsap.fromTo(
        panelRef.current,
        { x: '100%', opacity: 0 },
        { x: '0%', opacity: 1, duration: 0.4, ease: 'power3.out' }
      )
    }
  }, [])

  const handleClose = () => {
    if (panelRef.current && overlayRef.current) {
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in'
      })
      gsap.to(panelRef.current, {
        x: '100%',
        opacity: 0,
        duration: 0.3,
        ease: 'power3.in',
        onComplete: onClose
      })
    } else {
      onClose()
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-40 bg-black/30"
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ backgroundColor: primaryColor }}
        >
          <h3 className="text-white font-semibold text-lg">
            {hotspot.title || 'Information'}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)' }}>
          {hotspot.imageUrl && (
            <img
              src={hotspot.imageUrl}
              alt={hotspot.title || 'Image'}
              className="w-full rounded-lg mb-4 object-cover"
              style={{ maxHeight: '300px' }}
            />
          )}

          {hotspot.content && (
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: hotspot.content }}
            />
          )}

          {!hotspot.content && !hotspot.imageUrl && (
            <p className="text-gray-500 italic">No additional information available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
