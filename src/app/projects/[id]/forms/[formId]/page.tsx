'use client'

import { Suspense, use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Plus, X } from 'lucide-react'
import { fetchJson } from '@/lib/fetch-json'
import { Spinner } from '@/components/Spinner'
import { FormCharts } from '@/components/FormCharts'
import { FormResponseList, type NumberedResponse } from '@/components/FormResponseList'
import {
  applyFilters, describeFilters, filterQuestions, hasActiveFilters, type FormField, type ResponseFilters,
} from '@/lib/form-charts'

interface FormWithResponses {
  id: string
  name: string
  fields: FormField[]
  responses: Array<{ id: string; data: Record<string, unknown>; submittedAt: string }>
}

const EMPTY: ResponseFilters = { answers: {} }
const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
      {detail && <p className="text-sm text-slate-500 mt-0.5">{detail}</p>}
    </div>
  )
}

export default function FormResultsPage(props: { params: Promise<{ id: string; formId: string }> }) {
  const { id: projectId, formId } = use(props.params)
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Spinner size="lg" /></div>}>
      <FormResults projectId={projectId} formId={formId} />
    </Suspense>
  )
}

function FormResults({ projectId, formId }: { projectId: string; formId: string }) {
  const searchParams = useSearchParams()
  const focusResponseId = searchParams.get('response')
  const [view, setView] = useState<'charts' | 'responses'>(focusResponseId ? 'responses' : 'charts')
  const [filters, setFilters] = useState<ResponseFilters>(EMPTY)

  const { data: form, isLoading, error } = useQuery<FormWithResponses>({
    queryKey: ['form-responses', formId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/forms/${formId}`),
  })

  const fields = useMemo(() => form?.fields ?? [], [form])
  const all = useMemo(() => form?.responses ?? [], [form])
  const questions = useMemo(() => filterQuestions(fields, all), [fields, all])
  const filtered = useMemo(() => applyFilters(fields, all, filters), [fields, all, filters])
  const filterNote = useMemo(() => describeFilters(filters, questions), [filters, questions])
  const active = hasActiveFilters(filters)

  // Stable numbers from submission order across all responses, newest shown first
  const numbered = useMemo<NumberedResponse[]>(() => {
    const order = new Map(
      all.slice().sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()).map((r, i) => [r.id, i + 1])
    )
    return filtered
      .map(r => ({ ...r, data: r.data as Record<string, any>, responseNumber: order.get(r.id)! }))
      .sort((a, b) => b.responseNumber - a.responseNumber)
  }, [all, filtered])

  const span = (rows: Array<{ submittedAt: string }>) => {
    if (rows.length === 0) return null
    const times = rows.map(r => new Date(r.submittedAt).getTime())
    return { first: new Date(Math.min(...times)), last: new Date(Math.max(...times)) }
  }
  const allSpan = span(all)
  const shownSpan = span(filtered)

  const setAnswer = (key: string, value: string) => setFilters(f => {
    const current = f.answers[key] ?? []
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    return { ...f, answers: { ...f.answers, [key]: next } }
  })
  const addQuestion = (key: string) => setFilters(f => ({ ...f, answers: { ...f.answers, [key]: f.answers[key] ?? [] } }))
  const removeQuestion = (key: string) => setFilters(f => {
    const answers = { ...f.answers }
    delete answers[key]
    return { ...f, answers }
  })
  const shownQuestions = questions.filter(q => q.key in filters.answers)
  const addable = questions.filter(q => !(q.key in filters.answers))

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Spinner size="lg" /></div>
  }
  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <p className="text-slate-600">Couldn’t load this form.</p>
        <Link href={`/projects/${projectId}?tab=forms`} className="text-sm text-blue-700 hover:underline">Back to feedback forms</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <Link href={`/projects/${projectId}?tab=forms`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} aria-hidden="true" />
          Feedback forms
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold text-slate-900">{form.name}</h1>
          {all.length > 0 && (
            <a
              href={`/api/projects/${projectId}/forms/${formId}/export`}
              className="flex items-center gap-1.5 text-sm text-slate-700 px-3 py-2 bg-white hover:bg-slate-50 rounded-lg border border-slate-200"
            >
              <Download size={14} aria-hidden="true" />
              {active ? 'Export CSV (all responses)' : 'Export CSV'}
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="Responses"
            value={active ? `${filtered.length} of ${all.length}` : String(all.length)}
            detail={active ? 'match the filters' : null}
          />
          <SummaryCard
            label="Collected"
            value={shownSpan ? (shownSpan.first.toDateString() === shownSpan.last.toDateString() ? fmtDay(shownSpan.first) : `${fmtDay(shownSpan.first)} – ${fmtDay(shownSpan.last)}`) : '—'}
          />
          <SummaryCard
            label="Latest response"
            value={shownSpan ? fmtDay(shownSpan.last) : '—'}
            detail={shownSpan ? shownSpan.last.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null}
          />
        </div>

        {all.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-end gap-4 flex-wrap">
              <label className="text-sm text-slate-600">
                <span className="block mb-1">From</span>
                <input
                  type="date"
                  value={filters.from ?? ''}
                  min={allSpan ? isoDay(allSpan.first) : undefined}
                  max={filters.to || (allSpan ? isoDay(allSpan.last) : undefined)}
                  onChange={e => setFilters(f => ({ ...f, from: e.target.value || undefined }))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="text-sm text-slate-600">
                <span className="block mb-1">To</span>
                <input
                  type="date"
                  value={filters.to ?? ''}
                  min={filters.from || (allSpan ? isoDay(allSpan.first) : undefined)}
                  max={allSpan ? isoDay(allSpan.last) : undefined}
                  onChange={e => setFilters(f => ({ ...f, to: e.target.value || undefined }))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                />
              </label>
              {addable.length > 0 && (
                <label className="text-sm text-slate-600">
                  <span className="block mb-1">Filter by answer</span>
                  <span className="relative inline-flex items-center">
                    <Plus size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" aria-hidden="true" />
                    <select
                      value=""
                      onChange={e => { if (e.target.value) addQuestion(e.target.value) }}
                      className="rounded-lg border border-slate-200 pl-7 pr-8 py-1.5 text-sm max-w-xs"
                    >
                      <option value="">Choose a question…</option>
                      {addable.map(q => <option key={q.key} value={q.key}>{q.title}</option>)}
                    </select>
                  </span>
                </label>
              )}
              {(active || shownQuestions.length > 0) && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY)}
                  className="text-sm text-slate-500 hover:text-slate-800 hover:underline pb-2"
                >
                  Clear filters
                </button>
              )}
            </div>

            {shownQuestions.map(q => (
              <div key={q.key} className="border-t border-slate-100 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-800">{q.title}</p>
                  <button type="button" onClick={() => removeQuestion(q.key)} className="text-slate-400 hover:text-slate-600" aria-label={`Remove filter: ${q.title}`}>
                    <X size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {q.values.map(v => {
                    const on = (filters.answers[q.key] ?? []).includes(v)
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setAnswer(q.key, v)}
                        className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                          on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {all.length === 0 ? (
          <p className="text-center text-slate-500 py-16">No responses yet.</p>
        ) : (
          <div>
            <div className="flex gap-1 border-b border-slate-200 mb-5" role="tablist" aria-label="Results views">
              {([['charts', 'Charts'], ['responses', `Responses (${filtered.length})`]] as const).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    view === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {view === 'charts' ? (
              <FormCharts fields={fields} responses={filtered} note={filterNote} />
            ) : (
              <FormResponseList projectId={projectId} formId={formId} fields={fields} responses={numbered} focusResponseId={focusResponseId} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
