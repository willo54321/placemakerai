'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { X } from 'lucide-react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

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

interface VideoPanelProps {
  hotspot: PanoramaHotspot
  onClose: () => void
  primaryColor: string
}

export default function VideoPanel({ hotspot, onClose, primaryColor }: VideoPanelProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null)

  useEffect(() => {
    // Animate modal in
    if (modalRef.current && overlayRef.current) {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' }
      )
      gsap.fromTo(
        modalRef.current,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.2)' }
      )
    }

    // Initialize Video.js player
    if (videoRef.current && hotspot.videoUrl) {
      const player = videojs(videoRef.current, {
        controls: true,
        autoplay: false,
        preload: 'auto',
        fluid: true,
        responsive: true,
        sources: [
          {
            src: hotspot.videoUrl,
            type: getVideoType(hotspot.videoUrl)
          }
        ]
      })

      playerRef.current = player
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [hotspot.videoUrl])

  const getVideoType = (url: string): string => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'video/youtube'
    }
    if (url.includes('vimeo.com')) {
      return 'video/vimeo'
    }
    if (url.endsWith('.mp4')) {
      return 'video/mp4'
    }
    if (url.endsWith('.webm')) {
      return 'video/webm'
    }
    if (url.endsWith('.m3u8')) {
      return 'application/x-mpegURL'
    }
    return 'video/mp4'
  }

  const handleClose = () => {
    // Pause video before closing
    if (playerRef.current) {
      playerRef.current.pause()
    }

    if (modalRef.current && overlayRef.current) {
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in'
      })
      gsap.to(modalRef.current, {
        scale: 0.9,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
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
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl mx-4 bg-gray-900 rounded-xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: primaryColor }}
        >
          <h3 className="text-white font-semibold">
            {hotspot.title || 'Video'}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative bg-black">
          <div data-vjs-player>
            <video
              ref={videoRef}
              className="video-js vjs-big-play-centered vjs-theme-city"
              playsInline
            />
          </div>
        </div>

        {/* Description (if any) */}
        {hotspot.content && (
          <div className="px-4 py-3 bg-gray-800">
            <p className="text-gray-300 text-sm">{hotspot.content}</p>
          </div>
        )}
      </div>

      {/* Custom Video.js styles */}
      <style>{`
        .video-js {
          width: 100%;
          height: auto;
          aspect-ratio: 16/9;
        }
        .video-js .vjs-big-play-button {
          background-color: ${primaryColor};
          border: none;
          border-radius: 50%;
          width: 80px;
          height: 80px;
          line-height: 80px;
          margin-top: -40px;
          margin-left: -40px;
        }
        .video-js .vjs-big-play-button:hover {
          background-color: ${primaryColor};
          filter: brightness(1.1);
        }
        .video-js .vjs-play-progress,
        .video-js .vjs-volume-level {
          background-color: ${primaryColor};
        }
        .video-js .vjs-control-bar {
          background: rgba(0,0,0,0.7);
        }
      `}</style>
    </div>
  )
}
