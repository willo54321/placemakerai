'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, CheckCircle } from 'lucide-react'

/**
 * The AI analysis demo: a scripted, looping re-enactment of the analytics
 * dashboard populating after a run — the classifier counts every response
 * (counted, not estimated), themes quantify, and the executive summary
 * writes itself. Mirrors the real analytics tab's structure and palette.
 *
 * Same conventions as the other demos: Stripe easing, loops while mounted,
 * reduced motion renders the finished frame.
 */

const EASE = 'cubic-bezier(0.19, 1, 0.22, 1)'

const SENTIMENTS = [
  { label: 'Support', count: 18, color: '#16A34A', bg: '#F0FDF4' },
  { label: 'Object', count: 21, color: '#DC2626', bg: '#FEF2F2' },
  { label: 'Mixed', count: 5, color: '#D97706', bg: '#FFFBEB' },
  { label: 'Neutral', count: 3, color: '#64748B', bg: '#F8FAFC' },
]

const THEMES = [
  { label: 'Traffic & parking', count: 21, width: '100%' },
  { label: 'Housing mix', count: 14, width: '67%' },
  { label: 'Green space', count: 12, width: '57%' },
]

const SUMMARY =
  'Opposition centres on traffic and overshadowing along Elm Rise; support focuses on housing delivery and re-use of the brownfield site.'

/** Count from 0 to target while active. */
function useCountUp(target: number, active: boolean, ms = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) {
      setValue(0)
      return
    }
    const steps = 18
    let step = 0
    const timer = setInterval(() => {
      step++
      setValue(Math.round((target * step) / steps))
      if (step >= steps) clearInterval(timer)
    }, ms / steps)
    return () => clearInterval(timer)
  }, [active, target, ms])
  return value
}

function SentimentTile({ label, count, color, bg, active }: (typeof SENTIMENTS)[number] & { active: boolean }) {
  const value = useCountUp(count, active)
  return (
    <div
      className="rounded-lg border border-slate-100 px-2.5 py-2"
      style={{
        backgroundColor: bg,
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(6px)',
        transition: `opacity 0.5s ${EASE}, transform 0.5s ${EASE}`,
      }}
    >
      <p className="text-[8.5px] font-medium text-slate-500">{label}</p>
      <p className="text-[17px] font-bold leading-tight" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
    </div>
  )
}

export default function AnalysisDemo() {
  // 1 processing · 2 sentiment counted · 3 themes quantified · 4 summary typing
  const [phase, setPhase] = useState(0)
  const [typed, setTyped] = useState('')
  const [progress, setProgress] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase(4)
      setTyped(SUMMARY)
      setProgress(100)
      return
    }
    let cancelled = false
    const at = (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, ms))
    }
    const run = () => {
      if (cancelled) return
      timers.current.forEach(clearTimeout)
      timers.current = []
      setPhase(1)
      setTyped('')
      setProgress(0)

      at(150, () => setProgress(100)) // bar fills over the processing phase
      at(2100, () => setPhase(2))
      at(3600, () => setPhase(3))
      at(5100, () => {
        setPhase(4)
        let i = 0
        const typer = setInterval(() => {
          i += 2
          setTyped(SUMMARY.slice(0, i))
          if (i >= SUMMARY.length) clearInterval(typer)
        }, 24)
        timers.current.push(typer as unknown as ReturnType<typeof setTimeout>)
      })
      at(13500, run)
    }
    run()
    return () => {
      cancelled = true
      timers.current.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="relative w-full aspect-[4/3] bg-white select-none overflow-hidden" aria-label="Demo: AI analysis counting sentiment, quantifying themes and writing an executive summary">
      <div className="absolute inset-0 p-4 sm:p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-slate-900 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-[#16A34A] flex items-center justify-center">
              <Sparkles size={10} className="text-white" />
            </span>
            AI Analysis
          </p>
          <span
            className="inline-flex items-center gap-1 text-[9px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5"
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transition: `opacity 0.5s ${EASE}`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <CheckCircle size={9} /> 47 of 47 responses analysed
          </span>
        </div>

        {/* Processing bar */}
        <div
          className="mb-3"
          style={{
            opacity: phase === 1 ? 1 : 0,
            maxHeight: phase === 1 ? 40 : 0,
            transition: `opacity 0.4s ${EASE}, max-height 0.5s ${EASE}`,
            overflow: 'hidden',
          }}
        >
          <p className="text-[9px] text-slate-500 mb-1 flex items-center gap-1.5">
            <span className="animate-spin w-2.5 h-2.5 border-2 border-[#16A34A] border-t-transparent rounded-full" />
            Analysing 47 responses — sentiment, themes, material considerations…
          </p>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#16A34A] rounded-full"
              style={{ width: `${progress}%`, transition: `width 1.9s ${EASE}` }}
            />
          </div>
        </div>

        {/* Sentiment tiles — counted, not estimated */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {SENTIMENTS.map(s => (
            <SentimentTile key={s.label} {...s} active={phase >= 2} />
          ))}
        </div>

        {/* Theme bars */}
        <div
          className="mb-3 space-y-1.5"
          style={{ opacity: phase >= 3 ? 1 : 0, transition: `opacity 0.4s ${EASE}` }}
        >
          <p className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-wide">Top themes</p>
          {THEMES.map(theme => (
            <div key={theme.label} className="flex items-center gap-2">
              <span className="text-[9px] text-slate-600 w-[88px] shrink-0 truncate">{theme.label}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#16A34A]/70"
                  style={{
                    width: phase >= 3 ? theme.width : '0%',
                    transition: `width 1.1s ${EASE}`,
                  }}
                />
              </div>
              <span
                className="text-[9px] font-semibold text-slate-700 w-5 text-right"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {theme.count}
              </span>
            </div>
          ))}
        </div>

        {/* Executive summary — writes itself */}
        <div
          className="flex-1 min-h-0 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5"
          style={{
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? 'translateY(0)' : 'translateY(6px)',
            transition: `opacity 0.5s ${EASE}, transform 0.5s ${EASE}`,
          }}
        >
          <p className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Executive summary</p>
          <p className="text-[10px] text-slate-700 leading-relaxed">
            {typed}
            {phase >= 4 && typed.length < SUMMARY.length && (
              <span className="inline-block w-px h-[10px] bg-[#16A34A] ml-px align-middle" />
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
