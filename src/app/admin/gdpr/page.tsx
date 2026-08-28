'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, Download, Trash2, Shield, MapPin, FileText, Mail } from 'lucide-react'
import { toast } from 'sonner'

interface SubjectData {
  email: string
  searchedAt: string
  counts: { pins: number; enquiries: number; formResponses: number }
  pins: Array<{
    id: string
    comment: string
    name: string | null
    category: string
    approved: boolean
    createdAt: string
    project: { name: string }
  }>
  enquiries: Array<{
    id: string
    submitterName: string
    subject: string
    message: string
    createdAt: string
    project: { name: string }
  }>
  formResponses: Array<{
    id: string
    data: Record<string, unknown>
    submittedAt: string
    form: { name: string; Project: { name: string } | null }
  }>
}

export default function GdprPage() {
  const { data: session, status } = useSession()
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<SubjectData | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (status === 'unauthenticated') redirect('/login')

  if (status !== 'loading' && session?.user?.systemRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-4">You don't have permission to access this page.</p>
          <Link href="/projects" className="btn-primary">
            <ArrowLeft size={18} />
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/gdpr?email=${encodeURIComponent(email.trim())}`)
      if (!res.ok) throw new Error((await res.json()).error || 'Search failed')
      setResult(await res.json())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const exportJson = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `subject-access-${result.email}-${result.searchedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const eraseAll = async () => {
    if (!result) return
    const total = result.counts.pins + result.counts.enquiries + result.counts.formResponses
    if (
      !confirm(
        `Permanently delete all ${total} records for ${result.email}? This cannot be undone. ` +
          'If the requester wants a copy of their data, export it first.'
      )
    )
      return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/gdpr', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: result.email }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erasure failed')
      const { deleted } = await res.json()
      toast.success(
        `Erased ${deleted.pins} pins, ${deleted.enquiries} enquiries, ${deleted.formResponses} form responses`
      )
      setResult(null)
      setEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erasure failed')
    } finally {
      setDeleting(false)
    }
  }

  const total = result
    ? result.counts.pins + result.counts.enquiries + result.counts.formResponses
    : 0

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/admin/users" className="text-slate-500 hover:text-slate-900">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">GDPR Requests</h1>
            <p className="text-sm text-slate-500">
              Find, export, or erase everything held for an email address
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <form onSubmit={search} className="card p-4 flex gap-3 mb-8">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="requester@example.com"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <button type="submit" disabled={loading} className="btn-primary">
            <Search size={18} />
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {result && (
          <div className="space-y-6">
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">
                  {total} record{total === 1 ? '' : 's'} for {result.email}
                </p>
                <p className="text-sm text-slate-500">
                  {result.counts.pins} map comments · {result.counts.enquiries} enquiries ·{' '}
                  {result.counts.formResponses} form responses
                </p>
              </div>
              {total > 0 && (
                <div className="flex gap-2">
                  <button onClick={exportJson} className="btn-secondary">
                    <Download size={16} />
                    Export JSON
                  </button>
                  <button
                    onClick={eraseAll}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    {deleting ? 'Erasing…' : 'Erase All'}
                  </button>
                </div>
              )}
            </div>

            {result.pins.length > 0 && (
              <section className="card p-4">
                <h2 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-green-600" /> Map comments
                </h2>
                <ul className="space-y-2">
                  {result.pins.map((p) => (
                    <li key={p.id} className="text-sm bg-slate-50 rounded-lg p-3">
                      <span className="text-slate-500">
                        {p.project.name} · {new Date(p.createdAt).toLocaleDateString('en-GB')} ·{' '}
                        {p.approved ? 'published' : 'unpublished'}
                        {p.name ? ` · as "${p.name}"` : ''}
                      </span>
                      <p className="text-slate-800 mt-1">{p.comment}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.enquiries.length > 0 && (
              <section className="card p-4">
                <h2 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <Mail size={16} className="text-green-600" /> Enquiries
                </h2>
                <ul className="space-y-2">
                  {result.enquiries.map((e) => (
                    <li key={e.id} className="text-sm bg-slate-50 rounded-lg p-3">
                      <span className="text-slate-500">
                        {e.project.name} · {new Date(e.createdAt).toLocaleDateString('en-GB')} · from{' '}
                        {e.submitterName}
                      </span>
                      <p className="text-slate-800 mt-1 font-medium">{e.subject}</p>
                      <p className="text-slate-700">{e.message}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.formResponses.length > 0 && (
              <section className="card p-4">
                <h2 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-green-600" /> Form responses
                </h2>
                <ul className="space-y-2">
                  {result.formResponses.map((r) => (
                    <li key={r.id} className="text-sm bg-slate-50 rounded-lg p-3">
                      <span className="text-slate-500">
                        {r.form.Project?.name ? `${r.form.Project.name} · ` : ''}
                        {r.form.name} · {new Date(r.submittedAt).toLocaleDateString('en-GB')}
                      </span>
                      <pre className="text-slate-800 mt-1 whitespace-pre-wrap font-sans">
                        {Object.entries(r.data)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join('\n')}
                      </pre>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
