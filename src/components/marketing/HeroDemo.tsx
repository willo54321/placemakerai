'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The homepage hero: the embed experience in fast-forward. Real DOM animation
 * (no video, no map library above the fold) — pins land in sentiment colours,
 * the response counter ticks, heat blooms, the analysis panel fades in. The
 * brand switcher re-skins it live to make "your brand, your site" something
 * the visitor does with their hands.
 */

interface Preset {
  name: string
  url: string
  accent: string
  accentSoft: string
  font: string
  streetLabels: boolean
}

const PRESETS: Preset[] = [
  {
    name: 'Riverside Council',
    url: 'riverside.gov.uk/have-your-say',
    accent: '#16A34A',
    accentSoft: '#EAF7EF',
    font: "'DM Sans', system-ui, sans-serif",
    streetLabels: true,
  },
  {
    name: 'Harbour City',
    url: 'harbourcity.co.uk/masterplan',
    accent: '#1D4ED8',
    accentSoft: '#EDF2FE',
    font: 'Georgia, serif',
    streetLabels: false,
  },
  {
    name: 'Fenwick Estates',
    url: 'fenwickestates.com/meadow-lane',
    accent: '#9F1239',
    accentSoft: '#FBEFF2',
    font: "'Trebuchet MS', system-ui, sans-serif",
    streetLabels: true,
  },
]

// [x, y, sentiment] within the 460x330 SVG viewport. Opposition lines the
// southern road, support clusters north-east — the pattern the analysis
// section then "finds".
const PINS: Array<[number, number, 'p' | 'n' | 'g']> = [
  [150, 245, 'n'], [205, 255, 'n'], [255, 248, 'n'], [305, 252, 'n'],
  [122, 210, 'n'], [175, 230, 'g'],
  [318, 108, 'p'], [345, 130, 'p'], [298, 132, 'p'], [332, 92, 'g'],
  [210, 150, 'g'], [252, 170, 'n'], [180, 120, 'p'], [232, 116, 'g'],
]

const SENTIMENT_FILL = { p: '#10b981', n: '#ef4444', g: '#94a3b8' }

const THEMES = [
  { name: 'Traffic & parking', count: 41, tone: '#ef4444' },
  { name: 'Green space', count: 28, tone: '#10b981' },
  { name: 'School capacity', count: 19, tone: '#ef4444' },
]

export function HeroDemo() {
  const [preset, setPreset] = useState<Preset>(PRESETS[0])
  const [started, setStarted] = useState(false)
  const [instant, setInstant] = useState(false)
  const [responses, setResponses] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Start on scroll-into-view; reduced motion renders the resting frame.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInstant(true)
      setStarted(true)
      setResponses(112)
      return
    }
    const node = containerRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Counter ticks up while the pins land.
  useEffect(() => {
    if (!started || instant) return
    let current = 0
    const timer = setInterval(() => {
      current += Math.ceil((112 - current) / 9)
      setResponses(Math.min(current, 112))
      if (current >= 112) clearInterval(timer)
    }, 130)
    return () => clearInterval(timer)
  }, [started, instant])

  const pinDelay = (index: number) => (instant ? '0s' : `${0.3 + index * 0.16}s`)
  const lateDelay = (seconds: number) => (instant ? '0s' : `${seconds}s`)

  return (
    <div ref={containerRef} style={{ fontFamily: preset.font }}>
      {/* Browser chrome — the embed lives inside the client's own site */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
          <span className="ml-3 text-xs text-slate-500 bg-white border border-slate-200 rounded-md px-3 py-1 flex-1 max-w-xs truncate">
            {preset.url}
          </span>
        </div>

        <div className="relative">
          {/* Site header in the client's brand — not ours */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg flex-shrink-0" style={{ backgroundColor: preset.accent }} />
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-tight">{preset.name}</p>
              <p className="text-[11px] text-slate-400">Meadow Lane — have your say</p>
            </div>
            <span
              className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full tabular-nums transition-colors"
              style={{ backgroundColor: preset.accentSoft, color: preset.accent }}
            >
              {responses} responses
            </span>
          </div>

          {/* The map */}
          <div className="relative">
            <svg viewBox="0 0 460 330" className="block w-full h-auto" aria-hidden="true">
              <rect width="460" height="330" fill="#F4F4F1" />
              <path d="M0 262 L460 246" stroke="#d8d8d2" strokeWidth="12" fill="none" />
              <path d="M84 330 L98 170 L106 40" stroke="#deded8" strokeWidth="8" fill="none" />
              <path d="M330 330 L342 190 L420 120" stroke="#e2e2dc" strokeWidth="6" fill="none" />
              <g
                style={{ opacity: preset.streetLabels ? 1 : 0, transition: 'opacity 0.4s' }}
                fill="#a3a39b"
                fontSize="9"
                fontFamily="system-ui"
              >
                <text x="215" y="272" transform="rotate(-2 215 272)">Meadow Lane</text>
                <text x="66" y="140" transform="rotate(-84 66 140)">Willow Close</text>
              </g>
              {/* red-line boundary in the client's accent */}
              <path
                d="M120 232 L128 92 L222 62 L364 84 L352 222 Z"
                fill={preset.accent}
                fillOpacity="0.06"
                stroke={preset.accent}
                strokeWidth="2"
                strokeDasharray="7 4"
                style={{ transition: 'stroke 0.4s, fill 0.4s' }}
              />

              {/* heat blooms under the pins */}
              <g
                className="hero-fade"
                style={{ animationDelay: lateDelay(2.9), filter: 'blur(14px)', opacity: 0 }}
              >
                <ellipse cx="225" cy="248" rx="88" ry="24" fill="#ef4444" opacity="0.28" />
                <ellipse cx="322" cy="112" rx="46" ry="34" fill="#10b981" opacity="0.3" />
              </g>

              {/* pins land one at a time */}
              {PINS.map(([x, y, sentiment], index) => (
                <g
                  key={index}
                  className="hero-pin"
                  style={{ animationDelay: pinDelay(index), opacity: 0, transformOrigin: `${x}px ${y}px` }}
                >
                  <circle cx={x} cy={y} r="6" fill={SENTIMENT_FILL[sentiment]} stroke="#fff" strokeWidth="2" />
                </g>
              ))}
            </svg>

            {/* analysis panel fades in over the map */}
            <div
              className="hero-fade absolute bottom-3 left-3 right-3 sm:right-auto sm:w-72 bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg p-3.5"
              style={{ animationDelay: lateDelay(3.4), opacity: 0 }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                AI analysis — counted, not estimated
              </p>
              <div className="flex h-1.5 rounded-full overflow-hidden mb-2.5">
                <span className="bg-red-500" style={{ width: '52%' }} />
                <span className="bg-slate-300" style={{ width: '27%' }} />
                <span className="bg-emerald-500" style={{ width: '21%' }} />
              </div>
              <div className="space-y-1.5">
                {THEMES.map((theme, index) => (
                  <div
                    key={theme.name}
                    className="hero-fade flex items-center gap-2 text-xs text-slate-700"
                    style={{ animationDelay: lateDelay(3.7 + index * 0.25), opacity: 0 }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: theme.tone }} />
                    <span className="flex-1">{theme.name}</span>
                    <span className="text-slate-400 tabular-nums">{theme.count}</span>
                  </div>
                ))}
              </div>
              <p
                className="hero-fade text-[11px] text-slate-500 border-l-2 pl-2 mt-2.5 italic"
                style={{ animationDelay: lateDelay(4.6), opacity: 0, borderColor: preset.accent }}
              >
                &ldquo;Traffic objections concentrate along the southern frontage — 3.4× the site-wide rate.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Brand switcher */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 mr-1">Same platform, your brand:</span>
        {PRESETS.map(option => (
          <button
            key={option.name}
            onClick={() => setPreset(option)}
            className={`text-sm font-medium px-3.5 py-1.5 rounded-full border transition-all ${
              preset.name === option.name
                ? 'text-white shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
            style={
              preset.name === option.name
                ? { backgroundColor: option.accent, borderColor: option.accent }
                : undefined
            }
          >
            {option.name}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes heroPinDrop {
          0% { opacity: 0; transform: translateY(-14px) scale(0.6); }
          70% { opacity: 1; transform: translateY(2px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        ${started ? `
        .hero-pin { animation: heroPinDrop 0.45s ease-out forwards; }
        .hero-fade { animation: heroFadeIn 0.6s ease-out forwards; }
        ` : ''}
        @media (prefers-reduced-motion: reduce) {
          .hero-pin, .hero-fade { animation-duration: 0.01s !important; animation-delay: 0s !important; }
        }
      `}</style>
    </div>
  )
}
