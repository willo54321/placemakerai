'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Play, ThumbsUp, ThumbsDown, MessageCircle, CheckCircle, AlertCircle } from 'lucide-react'

export interface TourStopHighlight {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface TourStopData {
  id: string
  order: number
  title: string
  description: string
  imageUrl: string | null
  videoUrl: string | null
  latitude: number
  longitude: number
  zoom: number
  highlight: TourStopHighlight | null
  showOverlays: string[] | null
}

export interface TourData {
  id: string
  name: string
  description: string | null
  stops: TourStopData[]
}

export interface TourResponse {
  id: string
  comment: string
  name: string | null
  createdAt: string
}

interface TourPlayerProps {
  tours: TourData[]
  tour: TourData | null
  stopIndex: number // -1 = intro screen
  onTourSelect: (tourId: string) => void
  onStopIndexChange: (index: number) => void
  onClose: () => void
  responsesByStop: Map<string, TourResponse[]>
  canRespond: boolean
  onSubmitResponse: (stop: TourStopData, data: { category: string; comment: string; name: string }) => Promise<void>
}

const RESPONSE_CATEGORIES = [
  { id: 'positive', label: 'Positive', icon: ThumbsUp },
  { id: 'comment', label: 'Comment', icon: MessageCircle },
  { id: 'negative', label: 'Negative', icon: ThumbsDown },
]

// Convert a YouTube/Vimeo link to an embeddable player URL (null = not embeddable)
function getVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch' && parsed.searchParams.get('v')) {
        return `https://www.youtube-nocookie.com/embed/${parsed.searchParams.get('v')}`
      }
      const shorts = parsed.pathname.match(/^\/(shorts|embed)\/([\w-]+)/)
      if (shorts) return `https://www.youtube-nocookie.com/embed/${shorts[2]}`
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0]
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`
    }
    if (host === 'vimeo.com') {
      const id = parsed.pathname.match(/^\/(\d+)/)
      if (id) return `https://player.vimeo.com/video/${id[1]}`
    }
    if (host === 'player.vimeo.com' || host === 'youtube-nocookie.com') return url
  } catch {
    return null
  }
  return null
}

export function TourPlayer({
  tours,
  tour,
  stopIndex,
  onTourSelect,
  onStopIndexChange,
  onClose,
  responsesByStop,
  canRespond,
  onSubmitResponse,
}: TourPlayerProps) {
  const stop = tour && stopIndex >= 0 ? tour.stops[stopIndex] : null
  const isLastStop = tour ? stopIndex === tour.stops.length - 1 : false

  // Response form state (reset when moving between stops)
  const [formOpen, setFormOpen] = useState(false)
  const [category, setCategory] = useState('comment')
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [gdprConsent, setGdprConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [respondedStops, setRespondedStops] = useState<Set<string>>(new Set())

  const headingRef = useRef<HTMLHeadingElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFormOpen(false)
    setCategory('comment')
    setComment('')
    setSubmitError(null)
    contentRef.current?.scrollTo({ top: 0 })
    if (stopIndex >= 0) headingRef.current?.focus()
  }, [stopIndex, tour?.id])

  // Arrow-key navigation between stops (ignored while typing)
  useEffect(() => {
    if (!tour || stopIndex < 0) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'ArrowRight' && stopIndex < tour.stops.length - 1) onStopIndexChange(stopIndex + 1)
      if (e.key === 'ArrowLeft' && stopIndex > 0) onStopIndexChange(stopIndex - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tour, stopIndex, onStopIndexChange])

  const handleSubmit = async () => {
    if (!stop || !comment.trim() || !gdprConsent || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmitResponse(stop, { category, comment: comment.trim(), name: name.trim() })
      setRespondedStops(prev => new Set(prev).add(stop.id))
      setFormOpen(false)
      setComment('')
    } catch {
      setSubmitError('Failed to submit your response. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const panelClasses =
    'absolute z-20 bg-white shadow-2xl flex flex-col overflow-hidden ' +
    'inset-x-0 bottom-0 max-h-[62vh] rounded-t-2xl ' +
    'sm:inset-x-auto sm:left-4 sm:top-4 sm:bottom-4 sm:max-h-none sm:w-[380px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl'

  // ---- Tour picker (multiple active tours, none selected) ----
  if (!tour) {
    return (
      <div className={panelClasses}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-lg text-gray-900">Tours</h2>
          <button
            onClick={onClose}
            aria-label="Close tours"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <X size={16} /> Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {tours.map(t => (
            <button
              key={t.id}
              onClick={() => onTourSelect(t.id)}
              className="w-full text-left p-4 rounded-xl hover:bg-gray-50 border border-gray-100 mb-2 transition-colors"
            >
              <p className="font-medium text-gray-900">{t.name}</p>
              {t.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>}
              <p className="text-xs text-gray-400 mt-2">{t.stops.length} stop{t.stops.length !== 1 ? 's' : ''}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ---- Intro screen ----
  if (!stop) {
    return (
      <div className={panelClasses}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          {tours.length > 1 ? (
            <button
              onClick={() => onTourSelect('')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft size={16} /> All tours
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            aria-label="Leave tour"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <X size={16} /> Leave tour
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <h2 className="text-xl font-bold text-gray-900">{tour.name}</h2>
          {tour.description && (
            <p className="text-gray-600 mt-2 leading-relaxed whitespace-pre-wrap">{tour.description}</p>
          )}
          <button
            onClick={() => onStopIndexChange(0)}
            className="mt-5 w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Play size={18} />
            Start tour
          </button>
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {tour.stops.length} stop{tour.stops.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-1">
              {tour.stops.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => onStopIndexChange(idx)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold bg-brand-50 text-brand-600">
                    {idx + 1}
                  </span>
                  <span className="truncate">{s.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- Stop screen ----
  const responses = responsesByStop.get(stop.id) || []
  const videoEmbedUrl = stop.videoUrl ? getVideoEmbedUrl(stop.videoUrl) : null
  const hasResponded = respondedStops.has(stop.id)

  return (
    <div className={panelClasses}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm text-gray-500 truncate mr-3">{tour.name}</span>
        <button
          onClick={onClose}
          aria-label="Leave tour"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0"
        >
          <X size={16} /> Leave tour
        </button>
      </div>

      {/* Progress */}
      <div className="h-1 bg-gray-100" role="presentation">
        <div
          className="h-full bg-brand-600 transition-all duration-500"
          style={{ width: `${((stopIndex + 1) / tour.stops.length) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto" aria-live="polite">
        {stop.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stop.imageUrl} alt={stop.title} className="w-full h-44 object-cover bg-gray-100" />
        )}
        <div className="p-5">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold bg-brand-600 text-white">
              {stopIndex + 1}
            </span>
            <span className="text-xs text-gray-400">
              Stop {stopIndex + 1} of {tour.stops.length}
            </span>
          </div>
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold text-gray-900 mt-3 outline-none">
            {stop.title}
          </h2>
          <p className="text-gray-600 mt-2 leading-relaxed whitespace-pre-wrap">{stop.description}</p>

          {videoEmbedUrl && (
            <div className="mt-4 aspect-video rounded-xl overflow-hidden bg-gray-100">
              <iframe
                src={videoEmbedUrl}
                title={`Video: ${stop.title}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {stop.videoUrl && !videoEmbedUrl && (
            <a
              href={stop.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm text-brand-600 hover:underline"
            >
              Watch video
            </a>
          )}

          {/* Responses */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {responses.length === 0 ? 'No responses' : `${responses.length} response${responses.length !== 1 ? 's' : ''}`}
            </p>
            {responses.length > 0 && (
              <div className="mt-3 space-y-3">
                {responses.map(r => (
                  <div key={r.id} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.comment}</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {r.name || 'Anonymous'}
                      {' · '}
                      {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {canRespond && hasResponded && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">
                  Thank you — your response will appear here once it has been reviewed.
                </p>
              </div>
            )}

            {canRespond && !hasResponded && !formOpen && (
              <button
                onClick={() => setFormOpen(true)}
                className="mt-3 w-full py-2.5 border-2 border-brand-500 text-brand-600 font-medium rounded-xl hover:bg-brand-50 transition-colors"
              >
                Add a response
              </button>
            )}

            {canRespond && !hasResponded && formOpen && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2" role="radiogroup" aria-label="Type of response">
                  {RESPONSE_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      role="radio"
                      aria-checked={category === cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-xs font-medium transition-colors ${
                        category === cat.id
                          ? 'border-brand-500 bg-brand-50 text-brand-600'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <cat.icon size={14} />
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Your thoughts on this part of the proposal"
                    rows={3}
                    maxLength={2000}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none text-sm"
                  />
                  <p className="text-xs text-gray-400 text-right">{comment.length}/2000</p>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Name (optional)"
                  maxLength={100}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                />
                <div className="flex items-start gap-2">
                  <input
                    id="tour-gdpr"
                    type="checkbox"
                    checked={gdprConsent}
                    onChange={e => setGdprConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-600"
                  />
                  <label htmlFor="tour-gdpr" className="text-xs text-gray-600">
                    I consent to my feedback being displayed publicly and processed by the project team. *{' '}
                    <a href="/privacy" target="_blank" className="text-brand-600 hover:underline">
                      Privacy Policy
                    </a>
                  </label>
                </div>
                {submitError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{submitError}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setFormOpen(false); setSubmitError(null) }}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!comment.trim() || !gdprConsent || submitting}
                    className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => onStopIndexChange(stopIndex - 1)}
          disabled={stopIndex === 0}
          className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={18} />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {tour.stops.length <= 8 ? (
          <div className="flex">
            {tour.stops.map((_, idx) => (
              <button
                key={idx}
                onClick={() => onStopIndexChange(idx)}
                className="p-1.5 flex items-center justify-center"
                aria-label={`Go to stop ${idx + 1}`}
                aria-current={idx === stopIndex ? 'step' : undefined}
              >
                <span
                  className={`w-2 h-2 rounded-full block transition-colors ${
                    idx === stopIndex ? 'bg-brand-600' : idx < stopIndex ? 'bg-brand-300' : 'bg-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-500">{stopIndex + 1} / {tour.stops.length}</span>
        )}

        <button
          onClick={() => (isLastStop ? onClose() : onStopIndexChange(stopIndex + 1))}
          className="flex items-center gap-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors"
        >
          <span>{isLastStop ? 'Finish' : 'Next'}</span>
          {!isLastStop && <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  )
}

export function StartTourButton({ onClick, multiple }: { onClick: () => void; multiple: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-brand-500 text-brand-600 rounded-lg shadow-lg font-medium hover:bg-brand-50 transition-colors"
    >
      <Play size={18} />
      {multiple ? 'Explore the tours' : 'Take the tour'}
    </button>
  )
}
