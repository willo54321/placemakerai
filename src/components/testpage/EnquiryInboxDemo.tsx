'use client'

import { useEffect, useRef, useState } from 'react'
import { Inbox, ArrowDownLeft, ArrowUpRight, CheckCheck, Send } from 'lucide-react'

/**
 * The enquiry inbox demo: a scripted, looping re-enactment of the enquiries
 * desk — a public enquiry lands, a staff reply types itself out and sends by
 * email (delivery ticks), and the enquiry moves New → Open. Mirrors the real
 * thread view's bubbles and palette.
 *
 * Same conventions as the other demos: Stripe easing, loops while mounted,
 * reduced motion renders the finished frame.
 */

const EASE = 'cubic-bezier(0.19, 1, 0.22, 1)'

const ENQUIRY =
  'We’re worried about parking on Elm Rise once the new homes are occupied. Is there a survey, and where can we see the plans?'
const REPLY =
  'Thanks Sarah — parking is being reviewed with the highways team, and your comment is logged for the committee report. The plans are on the project page.'

export default function EnquiryInboxDemo() {
  // 1 enquiry shown · 2 reply typing · 3 reply sent (status → open)
  const [phase, setPhase] = useState(0)
  const [typed, setTyped] = useState('')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase(3)
      setTyped(REPLY)
      return
    }
    let cancelled = false
    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)) }
    const run = () => {
      if (cancelled) return
      timers.current.forEach(clearTimeout)
      timers.current = []
      setPhase(1)
      setTyped('')
      at(1400, () => {
        setPhase(2)
        let i = 0
        const typer = setInterval(() => {
          i += 2
          setTyped(REPLY.slice(0, i))
          if (i >= REPLY.length) clearInterval(typer)
        }, 22)
        timers.current.push(typer as unknown as ReturnType<typeof setTimeout>)
      })
      at(4700, () => { setPhase(3); setTyped('') })
      at(9000, run)
    }
    run()
    return () => { cancelled = true; timers.current.forEach(clearTimeout) }
  }, [])

  const sent = phase >= 3

  return (
    <div className="relative w-full aspect-[4/3] bg-white select-none overflow-hidden" aria-label="Demo: replying to a public enquiry by email from the inbox">
      <div className="absolute inset-0 p-4 sm:p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-slate-900 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-[#475569] flex items-center justify-center">
              <Inbox size={10} className="text-white" />
            </span>
            Enquiries
          </p>
          <span
            className="inline-flex items-center text-[9px] font-medium rounded-full px-2 py-0.5 border"
            style={{
              color: sent ? '#15803D' : '#B45309',
              backgroundColor: sent ? '#F0FDF4' : '#FFFBEB',
              borderColor: sent ? '#BBF7D0' : '#FDE68A',
              transition: `all 0.5s ${EASE}`,
            }}
          >
            {sent ? 'Open' : 'New'}
          </span>
        </div>

        {/* Subject + sender */}
        <div className="mb-2.5">
          <p className="text-[11px] font-semibold text-slate-900 leading-tight">Parking on Elm Rise</p>
          <p className="text-[9px] text-slate-500">Sarah Thompson · sarah.t@email.com</p>
        </div>

        {/* Conversation */}
        <div className="flex-1 min-h-0 space-y-2 overflow-hidden">
          {/* Inbound original */}
          <div className="flex justify-start">
            <div className="max-w-[86%] rounded-2xl bg-slate-100 text-slate-800 px-3 py-2">
              <div className="flex items-center gap-1 text-[8px] text-slate-500 mb-0.5">
                <ArrowDownLeft size={9} /> <span className="font-medium">Sarah Thompson</span>
                <span className="opacity-70">· enquiry</span>
              </div>
              <p className="text-[9.5px] leading-relaxed">{ENQUIRY}</p>
            </div>
          </div>

          {/* Outbound reply — appears once sent */}
          <div
            className="flex justify-end"
            style={{
              opacity: sent ? 1 : 0,
              transform: sent ? 'translateY(0)' : 'translateY(8px)',
              transition: `opacity 0.5s ${EASE}, transform 0.5s ${EASE}`,
            }}
          >
            <div className="max-w-[86%] rounded-2xl bg-[#16A34A] text-white px-3 py-2">
              <div className="flex items-center gap-1 text-[8px] text-green-50 mb-0.5">
                <ArrowUpRight size={9} /> <span className="font-medium">You</span>
              </div>
              <p className="text-[9.5px] leading-relaxed">{REPLY}</p>
              <div className="flex items-center gap-1 justify-end mt-0.5 text-[8px] text-green-100">
                <span>just now</span>
                <CheckCheck size={10} />
              </div>
            </div>
          </div>
        </div>

        {/* Reply composer */}
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-1.5 flex items-end gap-1.5">
          <div className="flex-1 min-h-[26px] text-[9.5px] text-slate-700 leading-relaxed px-1.5 py-1">
            {phase === 2 ? (
              <>
                {typed}
                <span className="inline-block w-px h-[10px] bg-[#16A34A] ml-px align-middle" />
              </>
            ) : (
              <span className="text-slate-300">Reply to Sarah…</span>
            )}
          </div>
          <span
            className="inline-flex items-center gap-1 text-[9px] font-medium text-white rounded-md px-2 py-1 shrink-0"
            style={{
              backgroundColor: phase === 2 ? '#16A34A' : '#94A3B8',
              transition: `background-color 0.4s ${EASE}`,
            }}
          >
            <Send size={9} /> Send
          </span>
        </div>
      </div>
    </div>
  )
}
