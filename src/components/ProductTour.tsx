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
type SpotRect = { top: number; left: number; width: number; height: number }

export function ProductTour({ steps, onFinish, onStepChange }: ProductTourProps) {
  const [index, setIndex] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [rect, setRect] = useState<SpotRect | null>(null)

  const step = steps[index]

  useEffect(() => {
    onStepChange?.(index)
  }, [index, onStepChange])

  useLayoutEffect(() => {
    const measure = () => {
      if (!step?.targetId) {
        // Welcome/untargeted step: a zero-size spotlight at screen centre —
        // the surrounding box-shadow dims everything, and being a real rect
        // means the SAME element animates smoothly into the first highlight.
        setRect({ top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 })
        return
      }
      const el = document.getElementById(step.targetId)
      if (el) {
        const r = el.getBoundingClientRect()
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
      }
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
  // falling back to below it, clamped to the viewport. The welcome step is
  // centred. Always numeric top/left so position changes animate.
  const cardWidth = 340
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  let cardTop: number
  let cardLeft: number
  if (!step.targetId || !rect) {
    cardLeft = vw / 2 - cardWidth / 2
    cardTop = Math.max(vh / 2 - 150, 16)
  } else {
    cardLeft = rect.left + rect.width + 16
    cardTop = Math.min(Math.max(rect.top - 8, 16), vh - 280)
    if (cardLeft + cardWidth + 16 > vw) {
      cardLeft = Math.min(Math.max(rect.left, 16), vw - cardWidth - 16)
      cardTop = Math.min(rect.top + rect.height + 12, vh - 280)
    }
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Spotlight dimmer: one persistent element, so moves between steps glide */}
      {rect && (
        <div
          className="fixed rounded-lg pointer-events-none transition-all duration-300 ease-in-out"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
          }}
        />
      )}

      {/* Explainer card — numeric top/left + transition so it glides between steps */}
      <div
        className="bg-white rounded-xl shadow-2xl p-5 z-[101] transition-all duration-300 ease-in-out"
        style={{ position: 'fixed', top: cardTop, left: cardLeft, width: cardWidth }}
      >
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
