'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

// The embed map's popup card (EmbedMap.tsx), as a reusable component so the
// admin maps present pins identically: white card anchored above the pin,
// first sentence as the title, ALL-CAPS category pill, photo, read-more.
export function MapPinPopup({
  pill,
  statusPill,
  comment,
  photoUrl,
  meta,
  actionLabel,
  onAction,
  onClose,
}: {
  pill: { label: string; color: string }
  statusPill?: { label: string; color: string }
  comment: string
  photoUrl?: string | null
  meta?: string
  actionLabel?: string
  onAction?: () => void
  onClose: () => void
}) {
  const [showFullComment, setShowFullComment] = useState(false)

  const sentences = comment.split(/(?<=[.!?])\s+/)
  const title = sentences[0] || comment
  const description = sentences.length > 1 ? sentences.slice(1).join(' ') : ''
  const isLongDesc = description.length > 120
  const truncatedDesc = isLongDesc ? description.slice(0, 120).trimEnd() + '…' : description

  return (
    <div
      className="bg-white rounded-xl shadow-2xl p-4 relative"
      style={{
        width: '320px',
        maxWidth: 'calc(100vw - 32px)',
        fontFamily: "'DM Sans', sans-serif",
        transform: 'translate(-50%, calc(-100% - 60px))',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close popup"
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10"
      >
        <X size={16} className="text-gray-500" />
      </button>

      <div className="flex items-start justify-between gap-3 mb-2 pr-8">
        <h3 className="text-base font-semibold text-gray-900 leading-tight flex-1">{title}</h3>
        <div className="flex flex-col gap-1 items-end">
          <span
            className="text-xs font-bold text-white px-3 py-1 rounded-full whitespace-nowrap"
            style={{ backgroundColor: pill.color }}
          >
            {pill.label}
          </span>
          {statusPill && (
            <span
              className="text-xs font-bold text-white px-3 py-1 rounded-full whitespace-nowrap"
              style={{ backgroundColor: statusPill.color }}
            >
              {statusPill.label}
            </span>
          )}
        </div>
      </div>

      {photoUrl && (
        <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="block mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Photo attached to this report"
            className="w-full max-h-36 object-cover rounded-lg border border-gray-200"
          />
        </a>
      )}

      {description && (
        <div className="mb-2">
          <p className="text-sm text-gray-500 leading-relaxed max-h-40 overflow-y-auto">
            {showFullComment || !isLongDesc ? description : truncatedDesc}
          </p>
          {isLongDesc && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowFullComment(v => !v) }}
              className="mt-1 text-xs font-medium text-brand-600 hover:underline"
            >
              {showFullComment ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {meta && <p className="text-sm text-gray-400">{meta}</p>}

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 text-sm font-medium text-brand-600 hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
