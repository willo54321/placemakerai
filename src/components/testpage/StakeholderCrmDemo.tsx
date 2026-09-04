'use client'

import { useEffect, useRef, useState } from 'react'
import { ClipboardList, Users, Phone, Mail, FileText, CalendarDays } from 'lucide-react'

/**
 * The stakeholder engagement-log demo: a scripted, looping re-enactment of the
 * consultation audit trail — meetings, calls, emails and letters logged against
 * each stakeholder stream in newest-first, with a running total. Mirrors the
 * real engagement log's entry types and palette.
 *
 * Same conventions as the other demos: Stripe easing, loops while mounted,
 * reduced motion renders the finished frame.
 */

const EASE = 'cubic-bezier(0.19, 1, 0.22, 1)'

const KIND = {
  meeting: { icon: Users, color: '#16A34A', bg: '#F0FDF4', label: 'Meeting' },
  email: { icon: Mail, color: '#2563EB', bg: '#EFF6FF', label: 'Email' },
  call: { icon: Phone, color: '#7C3AED', bg: '#F5F3FF', label: 'Call' },
  letter: { icon: FileText, color: '#D97706', bg: '#FFFBEB', label: 'Letter' },
  event: { icon: CalendarDays, color: '#0E7C86', bg: '#ECFEFF', label: 'Event' },
} as const

type Kind = keyof typeof KIND

const ENTRIES: { kind: Kind; who: string; summary: string; when: string }[] = [
  { kind: 'meeting', who: 'Residents’ Association', summary: 'Walked through the three plots and the consultation timeline', when: '2d' },
  { kind: 'email', who: 'Heritage Society', summary: 'Sent heritage statement; awaiting comments on Silo D', when: '4d' },
  { kind: 'call', who: 'Cllr Smith', summary: 'Briefed on Phase 1 infrastructure and school places', when: '1w' },
  { kind: 'meeting', who: 'Royal Docks Team', summary: 'Design review of the dock-edge public realm', when: '2w' },
  { kind: 'letter', who: 'Local Traders Forum', summary: 'Confirmed the traders’ liaison group for construction', when: '3w' },
]

function useCountUp(target: number, active: boolean, ms = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) { setValue(0); return }
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

export default function StakeholderCrmDemo() {
  // 1 header · 2 entries stream in
  const [phase, setPhase] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPhase(2); return }
    let cancelled = false
    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)) }
    const run = () => {
      if (cancelled) return
      timers.current.forEach(clearTimeout)
      timers.current = []
      setPhase(1)
      at(500, () => setPhase(2))
      at(9000, run)
    }
    run()
    return () => { cancelled = true; timers.current.forEach(clearTimeout) }
  }, [])

  const logged = useCountUp(34, phase >= 2)

  return (
    <div className="relative w-full aspect-[4/3] bg-white select-none overflow-hidden" aria-label="Demo: a stakeholder engagement log — meetings, calls, emails and letters logged as an audit trail">
      <div className="absolute inset-0 p-4 sm:p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-slate-900 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-[#16A34A] flex items-center justify-center">
              <ClipboardList size={10} className="text-white" />
            </span>
            Engagement log
          </p>
          <span className="text-[9px] font-medium text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {logged} logged
          </span>
        </div>

        {/* Timeline */}
        <div className="flex-1 min-h-0 relative pl-1">
          {/* rail */}
          <div className="absolute left-[13px] top-1 bottom-1 w-px bg-slate-100" />
          <div className="space-y-2.5">
            {ENTRIES.map((e, i) => {
              const meta = KIND[e.kind]
              const Icon = meta.icon
              const shown = phase >= 2
              return (
                <div
                  key={i}
                  className="relative flex items-start gap-2.5"
                  style={{
                    opacity: shown ? 1 : 0,
                    transform: shown ? 'translateY(0)' : 'translateY(8px)',
                    transition: `opacity 0.45s ${EASE} ${i * 150}ms, transform 0.45s ${EASE} ${i * 150}ms`,
                  }}
                >
                  <span
                    className="relative z-10 w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 border-2 border-white"
                    style={{ backgroundColor: meta.bg }}
                  >
                    <Icon size={12} style={{ color: meta.color }} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-900 truncate">{e.who}</span>
                      <span
                        className="text-[7.5px] font-medium rounded px-1 py-px shrink-0"
                        style={{ color: meta.color, backgroundColor: meta.bg }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[8px] text-slate-400 ml-auto shrink-0">{e.when}</span>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-snug mt-0.5 line-clamp-1">{e.summary}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
