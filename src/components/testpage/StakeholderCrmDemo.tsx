'use client'

import { useEffect, useRef, useState } from 'react'
import { Users } from 'lucide-react'

/**
 * The stakeholder CRM demo: a scripted, looping re-enactment of the stakeholder
 * tracker — contacts plot onto the power/interest matrix by influence and
 * interest, coloured by stance, while the engagement log counts up. Mirrors the
 * real matrix's quadrants and stance palette.
 *
 * Same conventions as the other demos: Stripe easing, loops while mounted,
 * reduced motion renders the finished frame.
 */

const EASE = 'cubic-bezier(0.19, 1, 0.22, 1)'

const STANCE = { supporter: '#16A34A', opposed: '#DC2626', neutral: '#64748B', undecided: '#D97706' } as const

type St = keyof typeof STANCE
type Person = { name: string; influence: number; interest: number; stance: St }

const PEOPLE: Person[] = [
  { name: 'Cllr Hussain', influence: 5, interest: 4, stance: 'neutral' },
  { name: 'Residents’ Assoc.', influence: 4, interest: 5, stance: 'opposed' },
  { name: 'GLA / Docks team', influence: 5, interest: 3, stance: 'supporter' },
  { name: 'Heritage Society', influence: 3, interest: 5, stance: 'undecided' },
  { name: 'Local Traders', influence: 3, interest: 4, stance: 'supporter' },
  { name: 'Cyclists Group', influence: 2, interest: 4, stance: 'neutral' },
]

const QUADRANTS = [
  { label: 'Keep satisfied', pos: 'top-0 left-0', bg: 'rgba(251,191,36,0.10)' },
  { label: 'Manage closely', pos: 'top-0 right-0', bg: 'rgba(22,163,74,0.12)' },
  { label: 'Monitor', pos: 'bottom-0 left-0', bg: 'rgba(148,163,184,0.10)' },
  { label: 'Keep informed', pos: 'bottom-0 right-0', bg: 'rgba(37,99,235,0.10)' },
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
  // 1 matrix grid · 2 stakeholders plot in · 3 register + engagements count
  const [phase, setPhase] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPhase(3); return }
    let cancelled = false
    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)) }
    const run = () => {
      if (cancelled) return
      timers.current.forEach(clearTimeout)
      timers.current = []
      setPhase(1)
      at(700, () => setPhase(2))
      at(2600, () => setPhase(3))
      at(9000, run)
    }
    run()
    return () => { cancelled = true; timers.current.forEach(clearTimeout) }
  }, [])

  const engagements = useCountUp(34, phase >= 3)

  return (
    <div className="relative w-full aspect-[4/3] bg-white select-none overflow-hidden" aria-label="Demo: stakeholders plotted on a power and interest matrix, coloured by stance">
      <div className="absolute inset-0 p-4 sm:p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-slate-900 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-[#16A34A] flex items-center justify-center">
              <Users size={10} className="text-white" />
            </span>
            Stakeholders
          </p>
          <span className="text-[9px] font-medium text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {PEOPLE.length} tracked
          </span>
        </div>

        <div className="flex-1 min-h-0 flex gap-3">
          {/* Power / interest matrix */}
          <div className="flex items-stretch gap-1.5">
            <span className="text-[7px] font-medium text-slate-400 [writing-mode:vertical-rl] rotate-180 self-center">Influence →</span>
            <div className="flex flex-col">
              <div className="relative aspect-square h-full max-h-full w-[150px] rounded-lg border border-slate-200 overflow-hidden">
                {QUADRANTS.map(q => (
                  <div
                    key={q.label}
                    className={`absolute w-1/2 h-1/2 ${q.pos} p-1`}
                    style={{ background: q.bg, opacity: phase >= 1 ? 1 : 0, transition: `opacity 0.5s ${EASE}` }}
                  >
                    <span className="text-[6px] font-semibold text-slate-500 uppercase tracking-wide leading-none">{q.label}</span>
                  </div>
                ))}
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
                {PEOPLE.map((p, i) => {
                  const x = ((p.interest - 0.5) / 5) * 100
                  const y = (1 - (p.influence - 0.5) / 5) * 100
                  const shown = phase >= 2
                  return (
                    <span
                      key={p.name}
                      className="absolute h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        background: STANCE[p.stance],
                        transform: `translate(-50%, -50%) scale(${shown ? 1 : 0})`,
                        opacity: shown ? 1 : 0,
                        transition: `transform 0.5s ${EASE} ${i * 110}ms, opacity 0.4s ${EASE} ${i * 110}ms`,
                      }}
                    />
                  )
                })}
              </div>
              <span className="text-[7px] font-medium text-slate-400 text-center mt-1">Interest →</span>
            </div>
          </div>

          {/* Register + engagement log */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div
              className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2 mb-2"
              style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'translateY(0)' : 'translateY(6px)', transition: `opacity 0.5s ${EASE}, transform 0.5s ${EASE}` }}
            >
              <p className="text-[8px] font-medium text-slate-400 uppercase tracking-wide">Engagements logged</p>
              <p className="text-[17px] font-bold text-slate-900 leading-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{engagements}</p>
            </div>
            <div className="space-y-1 overflow-hidden">
              {PEOPLE.slice(0, 4).map((p, i) => (
                <div
                  key={p.name}
                  className="flex items-center gap-1.5 rounded-md border border-slate-100 px-1.5 py-1"
                  style={{
                    opacity: phase >= 2 ? 1 : 0,
                    transform: phase >= 2 ? 'translateX(0)' : 'translateX(8px)',
                    transition: `opacity 0.4s ${EASE} ${i * 110}ms, transform 0.4s ${EASE} ${i * 110}ms`,
                  }}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: STANCE[p.stance] }} />
                  <span className="text-[8.5px] font-medium text-slate-700 truncate flex-1">{p.name}</span>
                  <span className="text-[7px] capitalize text-slate-400">{p.stance}</span>
                </div>
              ))}
            </div>
            {/* legend */}
            <div className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 pt-1.5">
              {(['supporter', 'neutral', 'opposed', 'undecided'] as St[]).map(s => (
                <span key={s} className="inline-flex items-center gap-1 text-[7px] text-slate-500 capitalize">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STANCE[s] }} /> {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
