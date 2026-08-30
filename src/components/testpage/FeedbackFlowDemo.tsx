'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'

/**
 * Service 04 visual, in the style of Stripe's architecture diagrams:
 * dot-grid ground, a top band holding solid channel chips (plus dashed
 * ghost slots), dotted right-angle connectors dropping org-chart style
 * into the central engine tile, then straight down to actionable
 * insights.
 *
 * Animates in on first view — band, chips, connectors, engine, output —
 * one build, no loop. Reduced motion renders the finished frame.
 */

const EASE = 'cubic-bezier(0.19, 1, 0.22, 1)'

const CHANNELS = [
  { label: 'Public enquiries', delay: 0.25 },
  { label: 'Map comments', delay: 0.4 },
  { label: 'Form responses', delay: 0.55 },
]

const LINE = 'rgba(134, 239, 172, 0.30)'

export default function FeedbackFlowDemo() {
  const [on, setOn] = useState(false)
  const [reduced, setReduced] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true)
      setOn(true)
      return
    }
    const node = containerRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setOn(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Fade/slide helper with a staggered delay; instant under reduced motion.
  const enter = (delay: number, shift = 'translateY(8px)'): React.CSSProperties => ({
    opacity: on ? 1 : 0,
    transform: on ? 'none' : shift,
    transition: reduced ? 'none' : `opacity 0.6s ${EASE} ${delay}s, transform 0.7s ${EASE} ${delay}s`,
  })

  return (
    <div ref={containerRef} className="relative aspect-[4/3] w-full select-none" aria-label="Diagram: enquiries, map comments and form responses flowing into the AI analysis engine, producing actionable insights">
      <svg viewBox="0 0 480 360" className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="dot-grid" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.05)" />
          </pattern>
          <radialGradient id="engine-glow">
            <stop offset="0" stopColor="rgba(22,163,74,0.30)" />
            <stop offset="1" stopColor="rgba(22,163,74,0)" />
          </radialGradient>
        </defs>

        {/* dot-grid ground */}
        <rect width="480" height="360" fill="url(#dot-grid)" />

        {/* engine glow */}
        <circle cx="240" cy="192" r="105" fill="url(#engine-glow)" style={enter(1.5, 'none')}>
          <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* dotted right-angle connectors — build top-down */}
        <g stroke={LINE} strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round" fill="none">
          <g style={enter(0.85, 'translateY(-6px)')}>
            <path d="M 122 72 L 122 104" />
            <path d="M 240 72 L 240 104" />
            <path d="M 368 72 L 368 104" />
          </g>
          <path d="M 122 104 L 368 104" style={enter(1.05, 'none')} />
          <path d="M 240 104 L 240 140" style={enter(1.25, 'translateY(-6px)')} />
          <path d="M 240 240 L 240 272" style={enter(1.95, 'translateY(-6px)')} />
        </g>
      </svg>

      {/* Top band holding the channel chips */}
      <div
        className="absolute rounded-xl border border-white/[0.07] bg-white/[0.04] flex items-center justify-between px-2.5"
        style={{
          left: '6.5%',
          right: '6.5%',
          top: `${(19 / 360) * 100}%`,
          height: `${(53 / 360) * 100}%`,
          ...enter(0, 'translateY(-10px)'),
        }}
      >
        <span className="hidden sm:block w-8 h-7 rounded-lg border border-dashed border-white/15 shrink-0" style={enter(0.7, 'none')} />
        {CHANNELS.map(channel => (
          <span
            key={channel.label}
            className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-medium text-white whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, #16A34A, #15803D)',
              ...enter(channel.delay, 'translateY(6px) scale(0.94)'),
            }}
          >
            {channel.label}
          </span>
        ))}
        <span className="hidden sm:block w-8 h-7 rounded-lg border border-dashed border-white/15 shrink-0" style={enter(0.7, 'none')} />
      </div>

      {/* Engine tile */}
      <div
        className="absolute flex flex-col items-center gap-1"
        style={{ left: '50%', top: `${(194 / 360) * 100}%`, transform: 'translate(-50%, -50%)' }}
      >
        <div
          className="w-[52px] h-[52px] rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #14532D)',
            boxShadow: '0 0 36px rgba(22,163,74,0.45)',
            opacity: on ? 1 : 0,
            transform: on ? 'scale(1)' : 'scale(0.6)',
            transition: reduced ? 'none' : `opacity 0.55s ${EASE} 1.5s, transform 0.7s ${EASE} 1.5s`,
          }}
        >
          <Sparkles size={22} className="text-white" />
        </div>
        <span className="text-[10.5px] font-medium text-white/80 whitespace-nowrap" style={enter(1.7, 'translateY(4px)')}>
          AI analysis engine
        </span>
      </div>

      {/* Bottom row: insights chip flanked by ghost slots */}
      <div
        className="absolute flex items-center justify-center gap-3"
        style={{ left: '50%', top: `${(292 / 360) * 100}%`, transform: 'translate(-50%, -50%)' }}
      >
        <span className="w-9 h-8 rounded-lg border border-dashed border-white/15 shrink-0" style={enter(2.35, 'none')} />
        <span
          className="rounded-lg px-3 py-2 text-[10.5px] font-medium text-white whitespace-nowrap"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #15803D)',
            ...enter(2.2, 'translateY(6px) scale(0.94)'),
          }}
        >
          Actionable insights
        </span>
        <span className="w-9 h-8 rounded-lg border border-dashed border-white/15 shrink-0" style={enter(2.35, 'none')} />
      </div>
    </div>
  )
}
