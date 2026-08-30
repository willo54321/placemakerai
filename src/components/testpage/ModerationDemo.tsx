'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Clock, Trash2, ThumbsUp, MessageCircle, ThumbsDown } from 'lucide-react'

/**
 * The approval-flow demo: a scripted, looping re-enactment of the real
 * Map Feedback moderation queue (projects/[id]/feedback-pins.tsx). Two
 * pending submissions sit in the queue; the cursor approves each in turn —
 * status chip flips, counts update, the product's real toast fires, and
 * upvotes start arriving once the comment is live on the public map.
 *
 * Same rig as MapPinDemo: fixed 480x360 stage scaled to the container,
 * Stripe marketing easing, IntersectionObserver start, reduced-motion
 * renders the finished frame.
 */

const EASE = 'cubic-bezier(0.19, 1, 0.22, 1)'
const STAGE_W = 480
const STAGE_H = 360

interface QueueRow {
  id: number
  name: string
  category: string
  color: string
  bg: string
  icon: typeof MessageCircle
  comment: string
  time: string
}

// The same fictional cast as the hero feed — consistent world.
const ROWS: QueueRow[] = [
  {
    id: 1,
    name: 'Margaret H.',
    category: 'Positive',
    color: '#059669',
    bg: '#D1FAE5',
    icon: ThumbsUp,
    comment: 'Please keep the mature oaks along this footpath — they screen the whole close.',
    time: 'Today, 09:14',
  },
  {
    id: 2,
    name: 'Tom W.',
    category: 'Negative',
    color: '#DC2626',
    bg: '#FEE2E2',
    icon: ThumbsDown,
    comment: 'The four-storey block would overshadow every garden on Elm Rise. Too tall for this street.',
    time: 'Today, 10:02',
  },
  {
    id: 3,
    name: 'Priya K.',
    category: 'Comment',
    color: '#4F46E5',
    bg: '#E0E7FF',
    icon: MessageCircle,
    comment: 'Parking on Weald Road is already impossible on match days — where will visitors go?',
    time: 'Today, 10:31',
  },
]

// Stage geometry: header 0-48, rows of 104px below.
const HEADER_H = 48
const ROW_H = 104
const approveTarget = (rowIndex: number) => ({
  x: 447,
  y: HEADER_H + rowIndex * ROW_H + 38,
})

export default function ModerationDemo() {
  const [approved, setApproved] = useState<Record<number, boolean>>({ 1: true })
  const [votes, setVotes] = useState<Record<number, number>>({ 1: 12 })
  const [toast, setToast] = useState(false)
  const [clicking, setClicking] = useState(false)
  const [cursor, setCursor] = useState({ x: 452, y: 346, visible: true })
  const [scale, setScale] = useState(1)
  const [reduced, setReduced] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const at = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms))
  }

  const clickAt = (ms: number) => {
    at(ms, () => setClicking(true))
    at(ms + 220, () => setClicking(false))
  }

  // Keep the stage scaled to the container width.
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
      setApproved({ 1: true, 2: true, 3: true })
      setVotes({ 1: 12, 2: 4 })
      setCursor(c => ({ ...c, visible: false }))
      return
    }

    const node = containerRef.current
    if (!node) return
    let cancelled = false

    const runTimeline = () => {
      if (cancelled) return
      timers.current.forEach(clearTimeout)
      timers.current = []
      setApproved({ 1: true })
      setVotes({ 1: 12 })
      setToast(false)
      setCursor({ x: 452, y: 346, visible: true })

      // Approve Tom W.'s objection — moderation is about publishing, not filtering.
      at(700, () => setCursor({ ...approveTarget(1), visible: true }))
      clickAt(2000)
      at(2100, () => {
        setApproved(a => ({ ...a, 2: true }))
        setToast(true)
      })
      at(4300, () => setToast(false))

      // Then Priya K.'s comment.
      at(4800, () => setCursor({ ...approveTarget(2), visible: true }))
      clickAt(6000)
      at(6100, () => {
        setApproved(a => ({ ...a, 3: true }))
        setToast(true)
      })
      at(8300, () => {
        setToast(false)
        setCursor({ x: 452, y: 346, visible: false })
      })

      // Live on the public map: upvotes start arriving on Tom's comment.
      ;[9000, 9600, 10300, 11100].forEach((ms, i) => {
        at(ms, () => setVotes(v => ({ ...v, 2: i + 1 })))
      })

      at(13800, runTimeline) // loop
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          runTimeline()
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

  const pendingCount = ROWS.filter(r => !approved[r.id]).length
  const approvedCount = ROWS.length - pendingCount

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none overflow-hidden bg-white"
      style={{ aspectRatio: '4 / 3' }}
      aria-label="Demo: approving pending map feedback before it appears on the public map"
    >
      <div
        className="absolute top-0 left-0"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {/* Header — as in the product's Map Feedback tab */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 border-b border-slate-100"
          style={{ height: HEADER_H }}
        >
          <div>
            <p className="text-[12px] font-semibold text-slate-900 leading-tight">Map Feedback (3)</p>
            <p className="text-[8.5px] text-slate-400 leading-tight">New submissions are hidden until you approve them</p>
          </div>
          <div className="flex gap-2 text-[10px] font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <span className="text-amber-600" style={{ transition: `opacity 0.3s ${EASE}` }}>
              {pendingCount} pending
            </span>
            <span className="text-green-600">{approvedCount} approved</span>
          </div>
        </div>

        {/* Queue rows */}
        {ROWS.map((row, index) => {
          const isApproved = !!approved[row.id]
          const Icon = row.icon
          const voteCount = votes[row.id] ?? 0
          return (
            <div
              key={row.id}
              className="absolute left-0 right-0 flex items-start gap-2.5 px-4 pt-3 border-b border-slate-100"
              style={{
                top: HEADER_H + index * ROW_H,
                height: ROW_H,
                backgroundColor: isApproved ? '#FFFFFF' : 'rgba(255, 251, 235, 0.6)',
                transition: `background-color 0.6s ${EASE}`,
              }}
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: row.bg }}
              >
                <Icon size={13} style={{ color: row.color }} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-[8.5px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: row.bg, color: row.color }}
                  >
                    {row.category}
                  </span>

                  {/* Status chip: Pending ⇄ Approved, cross-fading in place */}
                  <span className="relative inline-flex" style={{ width: 58, height: 15 }}>
                    <span
                      className="absolute inset-0 inline-flex items-center gap-0.5 text-[8.5px] font-semibold px-1.5 rounded-full bg-amber-100 text-amber-700"
                      style={{ opacity: isApproved ? 0 : 1, transition: `opacity 0.4s ${EASE}` }}
                    >
                      <Clock size={8} /> Pending
                    </span>
                    <span
                      className="absolute inset-0 inline-flex items-center gap-0.5 text-[8.5px] font-semibold px-1.5 rounded-full bg-green-100 text-green-700"
                      style={{
                        opacity: isApproved ? 1 : 0,
                        transform: isApproved ? 'scale(1)' : 'scale(0.85)',
                        transition: `opacity 0.4s ${EASE}, transform 0.4s ${EASE}`,
                      }}
                    >
                      <CheckCircle size={8} /> Approved
                    </span>
                  </span>

                  <span className="text-[9px] font-medium text-slate-600">{row.name}</span>
                  <span className="text-[8px] text-slate-400">{row.time}</span>

                  {voteCount > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[8.5px] text-slate-500 ml-auto"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      <ThumbsUp size={8} /> {voteCount}
                    </span>
                  )}
                </div>
                <p className="text-[9.5px] text-slate-700 leading-snug mt-1.5 pr-1">{row.comment}</p>
              </div>

              {/* Actions — approve / delete, as in the product */}
              <div className="flex flex-col gap-1 shrink-0 mt-1">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    color: isApproved ? '#D1D5DB' : '#16A34A',
                    backgroundColor: isApproved ? 'transparent' : 'rgba(220, 252, 231, 0.55)',
                    transition: `color 0.4s ${EASE}, background-color 0.4s ${EASE}`,
                  }}
                >
                  <CheckCircle size={14} />
                </span>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400/70">
                  <Trash2 size={13} />
                </span>
              </div>
            </div>
          )
        })}

        {/* Toast — the product's real approval toast */}
        <div
          className="absolute left-1/2 flex items-center gap-1.5 bg-slate-900 text-white rounded-lg px-3 py-2 shadow-xl"
          style={{
            top: 10,
            transform: `translateX(-50%) translateY(${toast ? 0 : -6}px)`,
            opacity: toast ? 1 : 0,
            transition: `opacity 0.4s ${EASE}, transform 0.4s ${EASE}`,
            zIndex: 30,
          }}
        >
          <CheckCircle size={11} className="text-[#4ADE80] shrink-0" />
          <span className="text-[9.5px] font-medium whitespace-nowrap">
            Approved — now visible on the public map
          </span>
        </div>

        {/* Cursor */}
        {!reduced && (
          <div
            className="absolute z-20"
            style={{
              left: 0,
              top: 0,
              transition: `transform 1.15s ${EASE}, opacity 0.4s ${EASE}`,
              transform: `translate(${cursor.x}px, ${cursor.y}px) scale(${clicking ? 0.82 : 1})`,
              opacity: cursor.visible ? 1 : 0,
            }}
          >
            <svg width="17" height="20" viewBox="0 0 17 20">
              <path d="M1 1l5.2 15.6 2.5-6 6.2-2.2L1 1Z" fill="#1e293b" stroke="#fff" strokeWidth="1.4" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
