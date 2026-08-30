'use client'

import { useEffect, useRef, useState } from 'react'
import { GripVertical, Type, AlignLeft, ChevronDown, CheckSquare, Star } from 'lucide-react'

/**
 * Service 02 demo: building a feedback form, re-enacted. The cursor drags
 * field types from the palette onto the canvas, labels type themselves in,
 * Required gets toggled, and Publish adds the automatic GDPR consent row —
 * mirroring the product's drag-and-drop builder. Stripe easing throughout,
 * fixed 480x360 stage scaled to the container, loops.
 */

const EASE = 'cubic-bezier(0.19, 1, 0.22, 1)'
const STAGE_W = 480
const STAGE_H = 360

const PALETTE = [
  { icon: Type, label: 'Short answer' },
  { icon: AlignLeft, label: 'Long answer' },
  { icon: ChevronDown, label: 'Dropdown' },
  { icon: CheckSquare, label: 'Checkboxes' },
  { icon: Star, label: 'Rating' },
]

const LABEL_1 = 'Your name'
const LABEL_2 = 'What do you think of the proposals?'

const ORDER = [
  'idle', 'toP1', 'drag1', 'type1', 'toP2', 'drag2', 'type2',
  'toReq', 'toPub', 'published', 'rest',
] as const
type Phase = (typeof ORDER)[number]

const after = (phase: Phase, target: Phase) =>
  ORDER.indexOf(phase) >= ORDER.indexOf(target)

export default function FormBuilderDemo() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [label1, setLabel1] = useState('')
  const [label2, setLabel2] = useState('')
  const [required, setRequired] = useState(false)
  const [clicking, setClicking] = useState(false)
  const [scale, setScale] = useState(1)
  const [reduced, setReduced] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const at = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms))
  }
  const clickAt = (ms: number) => {
    at(ms, () => setClicking(true))
    at(ms + 200, () => setClicking(false))
  }
  const typeInto = (ms: number, text: string, set: (s: string) => void, speed: number) => {
    at(ms, () => {
      let i = 0
      const typer = setInterval(() => {
        i++
        set(text.slice(0, i))
        if (i >= text.length) clearInterval(typer)
      }, speed)
      timers.current.push(typer as unknown as ReturnType<typeof setTimeout>)
    })
  }

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const update = () => setScale(node.clientWidth / STAGE_W)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true)
      setPhase('rest')
      setLabel1(LABEL_1)
      setLabel2(LABEL_2)
      setRequired(true)
      return
    }
    const node = containerRef.current
    if (!node) return
    let cancelled = false

    const run = () => {
      if (cancelled) return
      timers.current.forEach(clearTimeout)
      timers.current = []
      setLabel1('')
      setLabel2('')
      setRequired(false)
      setPhase('idle')

      at(500, () => setPhase('toP1'))
      clickAt(1500)
      at(1600, () => setPhase('drag1'))
      at(2600, () => setPhase('type1'))
      typeInto(2750, LABEL_1, setLabel1, 70)
      at(3900, () => setPhase('toP2'))
      clickAt(4900)
      at(5000, () => setPhase('drag2'))
      at(6000, () => setPhase('type2'))
      typeInto(6150, LABEL_2, setLabel2, 42)
      at(8300, () => setPhase('toReq'))
      clickAt(8950)
      at(9050, () => setRequired(true))
      at(9600, () => setPhase('toPub'))
      clickAt(10300)
      at(10500, () => setPhase('published'))
      at(12800, () => setPhase('rest'))
      at(17200, run)
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          run()
          observer.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(node)

    return () => {
      cancelled = true
      observer.disconnect()
      timers.current.forEach(clearTimeout)
    }
  }, [])

  // Cursor waypoints on the 480x360 stage.
  const cursor: Record<Phase, { x: number; y: number; visible: boolean }> = {
    idle: { x: 450, y: 340, visible: true },
    toP1: { x: 80, y: 88, visible: true },
    drag1: { x: 300, y: 110, visible: true },
    type1: { x: 300, y: 110, visible: true },
    toP2: { x: 80, y: 123, visible: true },
    drag2: { x: 300, y: 186, visible: true },
    type2: { x: 300, y: 186, visible: true },
    toReq: { x: 428, y: 196, visible: true },
    toPub: { x: 422, y: 33, visible: true },
    published: { x: 448, y: 90, visible: false },
    rest: { x: 448, y: 90, visible: false },
  }
  const c = cursor[phase]

  const dragging = phase === 'drag1' || phase === 'drag2'
  const dragLabel = phase === 'drag1' ? 'Short answer' : 'Long answer'
  const field1In = after(phase, 'type1')
  const field2In = after(phase, 'type2')
  const publishedIn = after(phase, 'published')

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full rounded-lg overflow-hidden border border-white/10 select-none bg-[#F7F6F4]"
      aria-label="Demo: building a feedback form with drag and drop"
    >
      <div
        className="absolute top-0 left-0"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      >
        {/* Builder chrome */}
        <div className="absolute inset-2.5 bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-10 border-b border-slate-100">
            <p className="text-[11px] font-semibold text-slate-800">Public Consultation Survey</p>
            <div
              className="rounded-md px-3 py-1 text-[10px] font-semibold text-white"
              style={{
                backgroundColor: publishedIn ? '#15803D' : '#16A34A',
                transition: `transform 0.2s ${EASE}`,
                transform: phase === 'toPub' && clicking ? 'scale(0.95)' : 'scale(1)',
              }}
            >
              {publishedIn ? 'Published ✓' : 'Publish'}
            </div>
          </div>

          <div className="flex h-[calc(100%-40px)]">
            {/* Palette */}
            <div className="w-[128px] border-r border-slate-100 p-2 space-y-1.5">
              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-0.5">
                Field types
              </p>
              {PALETTE.map(item => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1.5"
                >
                  <GripVertical size={9} className="text-slate-300" />
                  <item.icon size={10} className="text-slate-500" />
                  <span className="text-[9px] text-slate-600">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Canvas */}
            <div className="flex-1 p-3 space-y-2">
              {/* Field 1: short answer */}
              <div
                className="rounded-lg border border-slate-200 p-2.5"
                style={{
                  transition: `opacity 0.4s ${EASE}, transform 0.4s ${EASE}`,
                  opacity: field1In ? 1 : 0,
                  transform: field1In ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.97)',
                }}
              >
                <p className="text-[10px] font-medium text-slate-800 mb-1.5">
                  {label1 || ' '}
                  {phase === 'type1' && <span className="demo-caret" />}
                </p>
                <div className="h-6 rounded-md border border-slate-200 bg-slate-50" />
              </div>

              {/* Field 2: long answer with Required toggle */}
              <div
                className="rounded-lg border border-slate-200 p-2.5"
                style={{
                  transition: `opacity 0.4s ${EASE}, transform 0.4s ${EASE}`,
                  opacity: field2In ? 1 : 0,
                  transform: field2In ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.97)',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-[10px] font-medium text-slate-800">
                    {label2 || ' '}
                    {phase === 'type2' && <span className="demo-caret" />}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[8px] text-slate-400">Required</span>
                    <span
                      className="w-6 h-3.5 rounded-full relative"
                      style={{
                        backgroundColor: required ? '#16A34A' : '#E2E8F0',
                        transition: `background-color 0.3s ${EASE}`,
                      }}
                    >
                      <span
                        className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow"
                        style={{
                          left: required ? 12 : 2,
                          transition: `left 0.3s ${EASE}`,
                        }}
                      />
                    </span>
                  </div>
                </div>
                <div className="h-11 rounded-md border border-slate-200 bg-slate-50" />
              </div>

              {/* GDPR row appears on publish — compliance is automatic */}
              <div
                className="rounded-lg border border-dashed p-2 flex items-center gap-1.5"
                style={{
                  borderColor: '#86EFAC',
                  backgroundColor: '#F0FDF4',
                  transition: `opacity 0.5s ${EASE}, transform 0.5s ${EASE}`,
                  opacity: publishedIn ? 1 : 0,
                  transform: publishedIn ? 'translateY(0)' : 'translateY(6px)',
                }}
              >
                <CheckSquare size={10} className="text-green-600 shrink-0" />
                <span className="text-[9px] text-green-800">
                  GDPR consent added automatically — required on every submission
                </span>
              </div>

              {/* drop hint before anything lands */}
              {!field1In && (
                <div className="rounded-lg border-2 border-dashed border-slate-200 h-16 flex items-center justify-center">
                  <span className="text-[9px] text-slate-300">Drag a field type here</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Published toast */}
        <div
          className="absolute left-1/2 bottom-5 bg-slate-900 text-white rounded-lg px-3.5 py-2 shadow-xl"
          style={{
            transition: `opacity 0.4s ${EASE}, transform 0.4s ${EASE}`,
            opacity: phase === 'published' ? 1 : 0,
            transform: phase === 'published' ? 'translate(-50%, 0)' : 'translate(-50%, 8px)',
          }}
        >
          <span className="text-[10px] font-medium">Form published — embed code copied</span>
        </div>

        {/* Drag ghost rides with the cursor */}
        {dragging && (
          <div
            className="absolute z-10 flex items-center gap-1.5 rounded-md border border-green-300 bg-white shadow-lg px-2 py-1.5"
            style={{
              transition: `transform 0.95s ${EASE}`,
              transform: `translate(${c.x + 10}px, ${c.y + 8}px)`,
              opacity: 0.95,
            }}
          >
            <GripVertical size={9} className="text-slate-300" />
            <span className="text-[9px] text-slate-700">{dragLabel}</span>
          </div>
        )}

        {/* Cursor */}
        {!reduced && (
          <div
            className="absolute z-20"
            style={{
              transition: `transform 0.95s ${EASE}`,
              transform: `translate(${c.x}px, ${c.y}px) scale(${clicking ? 0.82 : 1})`,
              opacity: c.visible ? 1 : 0,
            }}
          >
            <svg width="17" height="20" viewBox="0 0 17 20">
              <path d="M1 1l5.2 15.6 2.5-6 6.2-2.2L1 1Z" fill="#1e293b" stroke="#fff" strokeWidth="1.4" />
            </svg>
          </div>
        )}
      </div>

      <style>{`
        @keyframes caretBlink { 50% { opacity: 0; } }
        .demo-caret {
          display: inline-block; width: 1px; height: 9px;
          background: #16A34A; margin-left: 1px; vertical-align: -1px;
          animation: caretBlink 0.9s steps(1) infinite;
        }
      `}</style>
    </div>
  )
}
