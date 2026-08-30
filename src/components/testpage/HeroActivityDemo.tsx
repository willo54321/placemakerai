'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, FileText, Mail, AlertTriangle, ArrowRight } from 'lucide-react'

/**
 * Hero demo: the product's Activity feed in fast-forward. Fictional responses
 * stream in from every channel; three identical copies arrive in a burst and
 * the duplicate-campaign alert fires — the real overview banner, re-enacted.
 * Loops; reduced motion renders the finished frame.
 */

const EASE = [0.19, 1, 0.22, 1] as const

interface FeedItem {
  id: number
  kind: 'pin' | 'form' | 'enquiry'
  title: string
  detail: string
  duplicate?: boolean
}

const TEMPLATE = 'I object to the proposed development. Local roads and services are already at capacity.'

const ITEMS: FeedItem[] = [
  { id: 1, kind: 'pin', title: 'Map comment from Sarah T.', detail: 'Love the new green link to the riverside path — please keep it lit in winter.' },
  { id: 2, kind: 'form', title: 'Form response from Tom W.', detail: 'The four-storey block would overshadow every garden on Elm Grove. Too tall for this street.' },
  { id: 3, kind: 'enquiry', title: 'Enquiry from David M.', detail: 'Will the community hall stay open during the construction phase?' },
  { id: 4, kind: 'form', title: 'Form response from Grace O.', detail: 'More family homes are badly needed here — good to see a brownfield site being used.' },
  { id: 5, kind: 'pin', title: 'Map comment from Priya K.', detail: 'Parking on Weald Road is already impossible on match days — where will visitors go?' },
  { id: 6, kind: 'form', title: 'Form response from Alan B.', detail: TEMPLATE, duplicate: true },
  { id: 7, kind: 'form', title: 'Form response from Janet R.', detail: TEMPLATE, duplicate: true },
  { id: 8, kind: 'form', title: 'Form response from Chris P.', detail: TEMPLATE, duplicate: true },
]

const ICON = {
  pin: { icon: MessageCircle, bg: '#F3E8FF', color: '#9333EA' },
  form: { icon: FileText, bg: '#DBEAFE', color: '#2563EB' },
  enquiry: { icon: Mail, bg: '#F1F5F9', color: '#475569' },
}

export default function HeroActivityDemo() {
  const [visible, setVisible] = useState<FeedItem[]>([])
  const [alertOn, setAlertOn] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible([...ITEMS.slice(2).reverse()])
      setAlertOn(true)
      return
    }

    const node = containerRef.current
    if (!node) return
    let cancelled = false

    const at = (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, ms))
    }

    const run = () => {
      if (cancelled) return
      timers.current.forEach(clearTimeout)
      timers.current = []
      setVisible([])
      setAlertOn(false)

      // Ordinary responses arrive at an unhurried pace…
      const arrival = [900, 4200, 7500, 10800, 14100, 17000, 17900, 18800]
      ITEMS.forEach((item, index) => {
        at(arrival[index], () =>
          setVisible(current => [item, ...current].slice(0, 5))
        )
      })
      // …then the burst of copies trips the detector.
      at(20200, () => setAlertOn(true))
      at(27500, run)
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          run()
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(node)

    return () => {
      cancelled = true
      observer.disconnect()
      timers.current.forEach(clearTimeout)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative w-full select-none" aria-label="Demo: live activity feed detecting duplicate campaign submissions">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header, as in the product */}
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900">Activity</p>
          <p className="text-[11px] text-slate-400">Latest feedback across the map, forms, and enquiries</p>
        </div>

        {/* Campaign alert — the real overview banner */}
        <AnimatePresence>
          {alertOn && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <div className="m-3 mb-0 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <AlertTriangle size={15} className="text-amber-600" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-900">
                    Alert — 3 identical submissions detected
                  </p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Copies of one template — likely an organised campaign.
                  </p>
                </div>
                <span className="text-[11px] font-medium text-amber-700 flex items-center gap-1 shrink-0 mt-1">
                  Review <ArrowRight size={11} />
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feed */}
        <div className="p-3 space-y-2 min-h-[300px]">
          <AnimatePresence initial={false}>
            {visible.map(item => {
              const style = ICON[item.kind]
              const Icon = style.icon
              const flagged = item.duplicate && alertOn
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="flex items-start gap-2.5 rounded-xl border p-2.5"
                  style={{
                    borderColor: flagged ? '#FDE68A' : '#F1F5F9',
                    backgroundColor: flagged ? '#FFFBEB' : '#FFFFFF',
                    transition: 'background-color 0.5s, border-color 0.5s',
                  }}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: style.bg }}
                  >
                    <Icon size={13} style={{ color: style.color }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-slate-800 truncate">{item.title}</p>
                      {flagged && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 rounded px-1 py-px shrink-0">
                          DUPLICATE
                        </span>
                      )}
                      <span className="text-[10px] text-slate-300 ml-auto shrink-0">just now</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{item.detail}</p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
