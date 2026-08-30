'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, Inbox, Mail } from 'lucide-react'
import { fetchJson } from '@/lib/fetch-json'
import { Spinner } from '@/components/Spinner'

interface ContactMessage {
  id: string
  name: string
  email: string
  organization: string | null
  projectType: string | null
  message: string
  createdAt: string
}

export default function AdminMessagesPage() {
  const { data: session } = useSession()

  const { data: messages, isLoading, error } = useQuery<ContactMessage[]>({
    queryKey: ['admin-messages'],
    queryFn: () => fetchJson('/api/admin/messages'),
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
    <div className="max-w-4xl mx-auto p-6 lg:p-8">
      <div className="mb-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft size={16} />
          Back to projects
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2.5">
          <Inbox className="text-brand-600" size={24} />
          Contact messages
        </h1>
        <p className="text-slate-500 mt-1">
          Start a Project submissions from the marketing homepage. No email delivery is configured —
          this page is the inbox.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {Boolean(error) && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">Failed to load messages.</p>
      )}

      {messages && messages.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500">No messages yet.</p>
        </div>
      )}

      <div className="space-y-4">
        {messages?.map(message => (
          <div key={message.id} className="card p-5">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold text-slate-900">{message.name}</span>
              <a href={`mailto:${message.email}`} className="text-sm text-brand-600 hover:underline">
                {message.email}
              </a>
              {message.organization && (
                <span className="text-sm text-slate-500">· {message.organization}</span>
              )}
              {message.projectType && (
                <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {message.projectType}
                </span>
              )}
              <span className="text-xs text-slate-400 ml-auto">
                {new Date(message.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{message.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
