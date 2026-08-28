'use client'

import { MapPin, Globe, Clock, CheckCircle, ArrowRight, MessageCircle, FileText, BarChart3 } from 'lucide-react'

type Tab = 'overview' | 'feedback' | 'forms' | 'website' | 'analytics' | 'settings'

interface OverviewTabProps {
  project: any
  onNavigate: (tab: Tab) => void
}

export function OverviewTab({ project, onNavigate }: OverviewTabProps) {
  const mapMarkerCount = project.mapMarkers?.length || 0
  const publicPinCount = project.publicPins?.length || 0
  const formCount = project.feedbackForms?.length || 0

  // Calculate pending items
  const pendingComments = project.publicPins?.filter((p: any) => !p.approved)?.length || 0

  // Get recent activity
  const recentComments = (project.publicPins || [])
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)

  const metrics = [
    {
      label: 'Map Markers',
      value: mapMarkerCount,
      icon: MapPin,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      onClick: () => onNavigate('feedback'),
    },
    {
      label: 'Public Comments',
      value: publicPinCount,
      icon: MessageCircle,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      onClick: () => onNavigate('feedback'),
      badge: pendingComments > 0 ? `${pendingComments} pending` : undefined,
    },
    {
      label: 'Forms',
      value: formCount,
      icon: FileText,
      color: 'bg-slate-500',
      bgColor: 'bg-slate-50',
      textColor: 'text-slate-700',
      onClick: () => onNavigate('forms'),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Project Overview</h2>
        <p className="text-sm text-slate-600">At-a-glance summary of your consultation project</p>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl p-4 flex items-center justify-between ${
        project.embedEnabled ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            project.embedEnabled ? 'bg-green-100' : 'bg-amber-100'
          }`}>
            <Globe size={20} className={project.embedEnabled ? 'text-green-600' : 'text-amber-600'} />
          </div>
          <div>
            <p className={`font-medium ${project.embedEnabled ? 'text-green-900' : 'text-amber-900'}`}>
              {project.embedEnabled ? 'Public Embedding Enabled' : 'Public Embedding Disabled'}
            </p>
            <p className={`text-sm ${project.embedEnabled ? 'text-green-700' : 'text-amber-700'}`}>
              {project.embedEnabled
                ? 'Your consultation map is live and collecting feedback'
                : 'Enable embedding to start collecting public feedback'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('website')}
          className={`text-sm font-medium flex items-center gap-1 ${
            project.embedEnabled ? 'text-green-700 hover:text-green-800' : 'text-amber-700 hover:text-amber-800'
          }`}
        >
          {project.embedEnabled ? 'View Embed Settings' : 'Enable Now'}
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <button
              key={metric.label}
              onClick={metric.onClick}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${metric.bgColor} flex items-center justify-center`}>
                  <Icon size={20} className={metric.textColor} />
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
              <p className="text-sm text-slate-600">{metric.label}</p>
              {metric.badge && (
                <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  <Clock size={12} />
                  {metric.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Recent Comments */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-medium text-slate-900">Recent Public Comments</h3>
          <button
            onClick={() => onNavigate('feedback')}
            className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            View all <ArrowRight size={14} />
          </button>
        </div>
        {recentComments.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recentComments.map((comment: any) => (
              <div key={comment.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  {comment.approved ? (
                    <CheckCircle size={14} className="text-green-500" />
                  ) : (
                    <Clock size={14} className="text-amber-500" />
                  )}
                  <span className="text-xs text-slate-500">
                    {new Date(comment.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  {comment.name && (
                    <span className="text-xs font-medium text-slate-700">{comment.name}</span>
                  )}
                </div>
                <p className="text-sm text-slate-700 line-clamp-2">{comment.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <MessageCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No public comments yet</p>
            {!project.embedEnabled && (
              <button
                onClick={() => onNavigate('website')}
                className="mt-2 text-sm text-brand-600 hover:text-brand-700"
              >
                Enable embedding to collect feedback
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-medium text-slate-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate('feedback')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
          >
            Add Map Marker
          </button>
          <button
            onClick={() => onNavigate('forms')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
          >
            Create Feedback Form
          </button>
          <button
            onClick={() => onNavigate('analytics')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
          >
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 size={14} />
              View AI Analytics
            </span>
          </button>
          {pendingComments > 0 && (
            <button
              onClick={() => onNavigate('feedback')}
              className="px-4 py-2 bg-amber-100 hover:bg-amber-200 rounded-lg text-sm font-medium text-amber-700 transition-colors"
            >
              Review {pendingComments} Pending Comment{pendingComments > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
