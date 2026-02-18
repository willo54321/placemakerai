'use client'

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Play, MapPin } from 'lucide-react'
import Image from 'next/image'

interface HighlightGeometry {
  type: 'Polygon'
  coordinates: number[][][]
}

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
  stops: TourStop[]
}

interface TourPlayerProps {
  tour: Tour
  onNavigate: (lat: number, lng: number, zoom: number, highlight: HighlightGeometry | null) => void
  onClose: () => void
  onFeedback?: (stopId: string) => void
}

export function TourPlayer({ tour, onNavigate, onClose, onFeedback }: TourPlayerProps) {
  const [currentStopIndex, setCurrentStopIndex] = useState(-1) // -1 = intro screen
  const [isAnimating, setIsAnimating] = useState(false)

  const currentStop = currentStopIndex >= 0 ? tour.stops[currentStopIndex] : null
  const isIntro = currentStopIndex === -1
  const isLastStop = currentStopIndex === tour.stops.length - 1
  const isFirstStop = currentStopIndex === 0

  useEffect(() => {
    if (currentStop) {
      setIsAnimating(true)
      onNavigate(currentStop.latitude, currentStop.longitude, currentStop.zoom, currentStop.highlight)
      // Reset animation state after transition
      const timer = setTimeout(() => setIsAnimating(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [currentStopIndex, currentStop, onNavigate])

  const handleStart = () => {
    setCurrentStopIndex(0)
  }

  const handleNext = () => {
    if (currentStopIndex < tour.stops.length - 1) {
      setCurrentStopIndex(prev => prev + 1)
    } else {
      // Tour complete - show intro/summary
      setCurrentStopIndex(-1)
    }
  }

  const handlePrevious = () => {
    if (currentStopIndex > 0) {
      setCurrentStopIndex(prev => prev - 1)
    }
  }

  const handleGoToStop = (index: number) => {
    setCurrentStopIndex(index)
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-xl shadow-2xl overflow-hidden z-20 max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-green-600 text-white">
        <div className="flex items-center gap-2">
          <MapPin size={18} />
          <span className="font-medium">{tour.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {!isIntro && (
            <span className="text-sm text-green-100">
              {currentStopIndex + 1} / {tour.stops.length}
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-green-700 rounded transition-colors"
            aria-label="Close tour"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {!isIntro && (
        <div className="h-1 bg-green-100">
          <div
            className="h-full bg-green-600 transition-all duration-500"
            style={{ width: `${((currentStopIndex + 1) / tour.stops.length) * 100}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isIntro ? (
          // Intro/Welcome Screen
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Play size={28} className="text-green-600 ml-1" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{tour.name}</h2>
            {tour.description && (
              <p className="text-slate-600 mb-4">{tour.description}</p>
            )}
            <p className="text-sm text-slate-500 mb-6">
              This tour has {tour.stops.length} stop{tour.stops.length !== 1 ? 's' : ''} to explore
            </p>
            <button
              onClick={handleStart}
              className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Play size={18} />
              Start Tour
            </button>

            {/* Stop Preview List */}
            <div className="mt-6 text-left">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Tour Stops
              </h3>
              <div className="space-y-1">
                {tour.stops.map((stop, idx) => (
                  <button
                    key={stop.id}
                    onClick={() => handleGoToStop(idx)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <span className="w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </span>
                    <span className="truncate">{stop.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : currentStop ? (
          // Stop Content
          <div className="flex flex-col">
            {/* Stop Image */}
            {currentStop.imageUrl && (
              <div className="relative h-40 bg-slate-100">
                <Image
                  src={currentStop.imageUrl}
                  alt={currentStop.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}

            {/* Stop Info */}
            <div className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <span className="flex-shrink-0 w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {currentStopIndex + 1}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{currentStop.title}</h3>
              </div>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                {currentStop.description}
              </p>

              {/* Feedback Button */}
              {onFeedback && (
                <button
                  onClick={() => onFeedback(currentStop.id)}
                  className="mt-4 w-full py-2 border-2 border-green-600 text-green-700 font-medium rounded-lg hover:bg-green-50 transition-colors"
                >
                  Leave Feedback
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Navigation Footer */}
      {!isIntro && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handlePrevious}
            disabled={isFirstStop || isAnimating}
            className="flex items-center gap-1 px-3 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Stop dots */}
          <div className="flex gap-1">
            {tour.stops.map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleGoToStop(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentStopIndex
                    ? 'bg-green-600'
                    : idx < currentStopIndex
                    ? 'bg-green-300'
                    : 'bg-slate-300'
                }`}
                aria-label={`Go to stop ${idx + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={isAnimating}
            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <span>{isLastStop ? 'Finish' : 'Next'}</span>
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

// Start Tour Button Component
export function StartTourButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-white text-green-700 border-2 border-green-600 rounded-lg shadow-lg hover:bg-green-50 transition-colors font-medium"
    >
      <Play size={18} />
      Take the Tour
    </button>
  )
}
