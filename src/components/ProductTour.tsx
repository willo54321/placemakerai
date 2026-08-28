'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'

export interface TourStep {
  /** DOM id of the element to spotlight; null = centered welcome card */
  targetId: string | null
  title: string
  body: string
}

interface ProductTourProps {
  steps: TourStep[]
  /** Called when the tour ends for any reason (finish or close). */
  onFinish: (dontShowAgain: boolean) => void
  /** Called before each step renders, e.g. to switch the visible tab. */
  onStepChange?: (index: number) => void
}

/**
 * Lightweight spotlight tour — no dependencies. Dims the page, cuts a
 * "hole" around the current step's target via a box-shadow, and anchors an
 * explainer card beside it.
 */
export function ProductTour({ steps, onFinish, onStepChange }: ProductTourProps) {
  const [index, setIndex] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const step = steps[index]

  useEffect(() => {
    onStepChange?.(index)
  }, [index, onStepChange])

  useLayoutEffect(() => {
    const measure = () => {
      if (!step?.targetId) {
        setRect(null)
        return
      }
      const el = document.getElementById(step.targetId)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    // Measure after the step's tab has had a frame to render
    const timer = setTimeout(measure, 60)
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measure)
    }
  }, [step])

  if (!step) return null

  const isLast = index === steps.length - 1

  // Card placement: to the right of the target (sidebar lives on the left),
  // falling back to below it, clamped to the viewport.
  const cardWidth = 340
  let cardStyle: React.CSSProperties
  if (rect) {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    let left = rect.right + 16
    let top = Math.min(Math.max(rect.top - 8, 16), vh - 280)
    if (left + cardWidth + 16 > vw) {
      left = Math.min(Math.max(rect.left, 16), vw - cardWidth - 16)
      top = Math.min(rect.bottom + 12, vh - 280)
    }
    cardStyle = { position: 'fixed', top, left, width: cardWidth }
  } else {
    cardStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: cardWidth,
    }
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Dimmer: spotlight hole when we have a target, full dim otherwise */}
      {rect ? (
        <div
          className="fixed rounded-lg pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/55" />
      )}

      {/* Explainer card */}
      <div className="bg-white rounded-xl shadow-2xl p-5 z-[101]" style={cardStyle}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-slate-900">{step.title}</h3>
          <button
            onClick={() => onFinish(dontShowAgain)}
            aria-label="Close tour"
            className="p-1 -m-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">{step.body}</p>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            Don&apos;t show again
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">
              {index + 1}/{steps.length}
            </span>
            {index > 0 && (
              <button
                onClick={() => setIndex(index - 1)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                aria-label="Previous step"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <button
              onClick={() => (isLast ? onFinish(dontShowAgain) : setIndex(index + 1))}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg"
            >
              {isLast ? 'Finish' : 'Next'}
              {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
