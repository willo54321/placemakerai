'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, ScrollText, Activity, HeartPulse, CheckCircle, AlertTriangle, Mail } from 'lucide-react'
import { fetchJson } from '@/lib/fetch-json'
import { Spinner } from '@/components/Spinner'

interface AuditEntry {
  id: string
  projectId: string | null
  projectName: string | null
  userEmail: string | null
  action: string
  targetType: string | null
  targetId: string | null
  detail: Record<string, unknown> | null
  createdAt: string
}

interface UsageRow {
  projectId: string
  projectName: string
  runs: number
  itemsClassified: number
}

interface HealthReport {
  database: string
  failedRuns: Array<{ projectName: string; error: string | null; at: string }>
  stuckRuns: Array<{ projectName: string; status: string; since: string }>
  newMessages24h: number
}

interface AuditPayload {
  entries: AuditEntry[]
  usage: UsageRow[]
  usageWindowDays: number
  health: HealthReport
}

const ACTION_STYLES: Record<string, string> = {
  'analysis.run': 'bg-brand-50 text-brand-700',
  'export.download': 'bg-blue-50 text-blue-700',
  'pin.delete': 'bg-red-50 text-red-700',
  'response.delete': 'bg-red-50 text-red-700',
  'enquiry.delete': 'bg-red-50 text-red-700',
}

export default function AdminAuditPage() {
  const { data: session } = useSession()

  const { data, isLoading, error } = useQuery<AuditPayload>({
    queryKey: ['admin-audit'],
    queryFn: () => fetchJson('/api/admin/audit'),
    enabled: !!session,
  })

  if (session && session.user?.systemRole !== 'SUPER_ADMIN') {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-slate-500">
        Super admin access required.
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8">
      <div className="mb-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft size={16} />
          Back to projects
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2.5">
          <ScrollText className="text-brand-600" size={24} />
          Audit log & usage
        </h1>
        <p className="text-slate-500 mt-1">
          Every recorded admin action, newest first, and AI analysis usage per project.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}
      {Boolean(error) && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">Failed to load the audit log.</p>
      )}

      {data && (
        <>
          {/* System health */}
          <div className="card p-6 mb-8">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <HeartPulse size={18} className="text-brand-600" />
              System health
            </h2>

            {data.health.failedRuns.length === 0 && data.health.stuckRuns.length === 0 ? (
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3 flex items-center gap-2">
                <CheckCircle size={15} className="shrink-0" />
                All systems normal — database reachable, no failed or stuck analysis runs.
              </p>
            ) : (
              <div className="space-y-2">
                {data.health.failedRuns.map((run, index) => (
                  <div key={`failed-${index}`} className="text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-start gap-2.5">
                    <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-red-800">
                      <span className="font-semibold">{run.projectName}</span> — analysis run failed
                      {run.error ? `: ${run.error}` : ''}{' '}
                      <span className="text-red-500">
                        ({new Date(run.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {' '}— hit Re-analyze on the project to retry)
                      </span>
                    </span>
                  </div>
                ))}
                {data.health.stuckRuns.map((run, index) => (
                  <div key={`stuck-${index}`} className="text-sm bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 flex items-start gap-2.5">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-amber-800">
                      <span className="font-semibold">{run.projectName}</span> — run stuck in “{run.status}” since{' '}
                      {new Date(run.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {' '}— it will not complete; re-run the analysis.
                    </span>
                  </div>
                ))}
              </div>
            )}

            {data.health.newMessages24h > 0 && (
              <Link
                href="/admin/messages"
                className="mt-3 text-sm text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg px-4 py-3 flex items-center gap-2"
              >
                <Mail size={15} className="text-brand-600 shrink-0" />
                {data.health.newMessages24h} new contact message{data.health.newMessages24h === 1 ? '' : 's'} in the
                last 24 hours — view messages
              </Link>
            )}
          </div>

          {/* Usage summary */}
          <div className="card p-6 mb-8">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-1">
              <Activity size={18} className="text-brand-600" />
              AI analysis usage — last {data.usageWindowDays} days
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Each run classifies every response in the project. Runs are capped at 10 per project per day.
            </p>
            {data.usage.length === 0 ? (
              <p className="text-sm text-slate-400">No analysis runs recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                    <th className="pb-2 font-medium">Project</th>
                    <th className="pb-2 font-medium text-right">Runs</th>
                    <th className="pb-2 font-medium text-right">Responses classified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.usage.map(row => (
                    <tr key={row.projectId}>
                      <td className="py-2 text-slate-700">{row.projectName}</td>
                      <td className="py-2 text-right tabular-nums text-slate-700">{row.runs}</td>
                      <td className="py-2 text-right tabular-nums text-slate-700">
                        {row.itemsClassified.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Trail */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Recent activity</h2>
            {data.entries.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.entries.map(entry => (
                  <div key={entry.id} className="py-2.5 flex items-start gap-3 text-sm">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                        ACTION_STYLES[entry.action] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {entry.action}
                    </span>
                    <span className="flex-1 min-w-0 text-slate-600">
                      {entry.userEmail ?? 'system'}
                      {entry.projectName && <span className="text-slate-400"> · {entry.projectName}</span>}
                      {entry.detail && Object.keys(entry.detail).length > 0 && (
                        <span className="text-slate-400">
                          {' '}
                          ·{' '}
                          {Object.entries(entry.detail)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(', ')}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {new Date(entry.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
