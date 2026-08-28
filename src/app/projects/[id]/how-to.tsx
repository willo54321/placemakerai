'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, PlayCircle, Mail, HelpCircle } from 'lucide-react'

type Role = 'CLIENT' | 'ADMIN' | 'SUPER_ADMIN'

/** One step of an interactive guide: which tab/sub-tab to show, what to spotlight. */
export interface GuideStep {
  tab: 'overview' | 'feedback' | 'forms' | 'website' | 'analytics' | 'settings' | 'howto'
  subTab?: 'map' | 'responses'
  target: string | null
  title: string
  body: string
}

interface Guide {
  id: string
  title: string
  minRole: Role
  steps: string[]
  tip?: string
}

// Interactive spotlight versions of the guides (where the target UI lives on
// this dashboard — the /admin ones stay text-only).
export const WALKTHROUGHS: Record<string, GuideStep[]> = {
  approve: [
    {
      tab: 'feedback',
      subTab: 'responses',
      target: '[data-tour="subtab-responses"]',
      title: 'Open the Responses tab',
      body: 'Map Feedback has two views — the map itself, and this Responses list where every public comment arrives.',
    },
    {
      tab: 'feedback',
      subTab: 'responses',
      target: '[data-tour="pins-list"]',
      title: 'The moderation queue',
      body: 'Each comment has an amber "Pending" or green "Approved" label. Pending comments are invisible to the public until you approve them.',
    },
    {
      tab: 'feedback',
      subTab: 'responses',
      target: '[data-tour="pin-approve"]',
      title: 'The green tick publishes',
      body: 'Click it on a pending comment and it appears on the public map straight away.',
    },
    {
      tab: 'feedback',
      subTab: 'responses',
      target: '[data-tour="pin-unapprove"]',
      title: 'The amber clock un-publishes',
      body: 'Changed your mind? This takes an approved comment off the public map — nothing is deleted, it just goes back to Pending.',
    },
  ],
  delete: [
    {
      tab: 'feedback',
      subTab: 'responses',
      target: '[data-tour="subtab-responses"]',
      title: 'Find the comment under Responses',
      body: 'All comments live in this list, whatever their status.',
    },
    {
      tab: 'feedback',
      subTab: 'responses',
      target: '[data-tour="pin-delete"]',
      title: 'The red bin deletes permanently',
      body: 'You will be asked to confirm, and the comment is read back to you first. This cannot be undone — if you only want it off the public map, use the amber clock instead.',
    },
  ],
  'find-new': [
    {
      tab: 'overview',
      target: '[data-tour="activity-feed"]',
      title: 'Everything new lands here',
      body: 'The Activity list shows every map comment, form response, and enquiry, newest first. Click "Review" or "View" on any item to jump straight to it. When comments are waiting, an "awaiting review" link appears at the top.',
    },
  ],
  analysis: [
    {
      tab: 'analytics',
      target: '[data-tour="run-analysis"]',
      title: 'One click runs the analysis',
      body: 'Click this button and wait about a minute — stay on the page. It re-uses saved results, so it only costs time when there is new feedback to analyse.',
    },
    {
      tab: 'analytics',
      target: null,
      title: 'What you get',
      body: 'Overall sentiment, the main themes people raise, material planning considerations, headline statistics, and a written summary you can lift into reports.',
    },
  ],
  preview: [
    {
      tab: 'feedback',
      target: '[data-tour="preview-public"]',
      title: 'Preview opens the public page',
      body: 'This opens the live consultation map in a new tab — exactly what residents see. Only approved comments are visible there.',
    },
  ],
  markers: [
    {
      tab: 'feedback',
      subTab: 'map',
      target: '[data-tour="subtab-map"]',
      title: 'Open the Map Editor',
      body: 'This view is where you set up the map residents will see.',
    },
    {
      tab: 'feedback',
      subTab: 'map',
      target: null,
      title: 'Markers, areas, and routes',
      body: 'Use "Add Marker" to place labelled points (like the site entrance), and the drawing tools to outline areas or routes. Everything you add appears on the public map.',
    },
  ],
  forms: [
    {
      tab: 'forms',
      target: '[data-tour="create-form"]',
      title: 'Create a form',
      body: 'This opens a window where you name the form and click "Add Field" for each question — text answers, multiple choice, ratings, and more.',
    },
    {
      tab: 'forms',
      target: null,
      title: 'Share it and watch responses arrive',
      body: 'Once saved, copy the form’s public link and share it anywhere — email, social media, your website. Responses appear under the form and feed the AI analysis automatically.',
    },
  ],
  embed: [
    {
      tab: 'website',
      target: '[data-tour="embed-copy"]',
      title: 'Copy the embed code',
      body: 'One small block of code. Paste it into your website — or just email it to whoever manages the site; nothing else is needed.',
    },
  ],
  styling: [
    {
      tab: 'website',
      target: '[data-tour="embed-styling"]',
      title: 'Make it match your brand',
      body: 'Set your accent colour and font, hide street labels, or default to satellite view. Changes apply to the live public map.',
    },
  ],
}

interface GuideSection {
  heading: string
  guides: Guide[]
}

const SECTIONS: GuideSection[] = [
  {
    heading: 'Everyday tasks',
    guides: [
      {
        id: 'approve',
        title: 'Approve a comment so it appears on the public map',
        minRole: 'ADMIN',
        steps: [
          'Click "Map Feedback" in the left-hand menu, then the "Responses" tab near the top.',
          'Comments waiting for a decision have an amber "Pending" label.',
          'Click the green tick next to a comment to publish it — it appears on the public map straight away.',
          'Changed your mind? Click the amber clock on a published comment to take it off the map again. Nothing is lost — it just goes back to Pending.',
        ],
        tip: 'The Overview screen shows "X awaiting review" whenever comments are waiting. Clicking it brings you straight to the queue.',
      },
      {
        id: 'delete',
        title: 'Permanently remove a comment',
        minRole: 'ADMIN',
        steps: [
          'In "Map Feedback" → "Responses", find the comment.',
          'Click the red bin icon next to it.',
          'A confirmation box reads the comment back to you — check it is the right one, because deletion cannot be undone.',
          'If you only want it off the public map, use the amber clock (unapprove) instead — that is reversible.',
        ],
      },
      {
        id: 'find-new',
        title: 'See what feedback has just come in',
        minRole: 'CLIENT',
        steps: [
          'The "Overview" screen shows an Activity list — every map comment, form response, and enquiry, newest first.',
          'Click "Review" or "View" next to any item to jump straight to it.',
        ],
      },
      {
        id: 'analysis',
        title: 'Run the AI analysis',
        minRole: 'CLIENT',
        steps: [
          'Click "AI Analytics" in the left-hand menu.',
          'Click "Run Analysis" (or "Re-analyze" if one has run before). It takes about a minute — stay on the page.',
          'You will see overall sentiment, the main themes people raise, material planning considerations, and a written summary you can use in reports.',
          'When new feedback arrives after an analysis, a banner offers to re-run it. Results are saved, so viewing them again is instant.',
        ],
        tip: 'Vote counts on comments are indicative — treat the written comments and themes as the substance for reports.',
      },
      {
        id: 'preview',
        title: 'See exactly what residents see',
        minRole: 'CLIENT',
        steps: [
          'Click "Map Feedback" in the left-hand menu.',
          'In the green banner at the top, click "Preview" — the public consultation map opens in a new tab.',
          'This is the live page: only approved comments are visible, and anything a resident submits there is real feedback.',
        ],
      },
    ],
  },
  {
    heading: 'Setting up your consultation',
    guides: [
      {
        id: 'markers',
        title: 'Add markers, areas, and routes to your map',
        minRole: 'ADMIN',
        steps: [
          'Click "Map Feedback" → the "Map Editor" tab.',
          'Use "Add Marker" to place a labelled point (e.g. the site entrance), clicking the map where it should go.',
          'Use the drawing tools to outline areas (e.g. the site boundary) or routes, and give each one a label.',
          'Everything you add here appears on the public map for residents.',
        ],
      },
      {
        id: 'forms',
        title: 'Build a feedback form',
        minRole: 'ADMIN',
        steps: [
          'Click "Feedback Forms" in the left-hand menu, then "Create Form".',
          'Give the form a name residents will understand (e.g. "Phase 2 Consultation Survey").',
          'Click "Add Field" for each question — text answers, multiple choice, ratings, and more.',
          'Click "Create Form" to save. Open the form to copy its public link — share that link anywhere: email, social media, or your website.',
          'Responses appear under the form as they arrive, and feed into the AI analysis automatically.',
        ],
      },
      {
        id: 'embed',
        title: 'Put the map on your website',
        minRole: 'ADMIN',
        steps: [
          'Click "Website" in the left-hand menu.',
          'Click the copy button next to the embed code — it is one small block of code.',
          'Paste it into your website page, or simply email it to whoever manages your website. No other setup is needed on their side.',
        ],
        tip: 'Not confident with websites? Forward the code to your web team with "please add this to the consultation page" — that is genuinely all they need.',
      },
      {
        id: 'styling',
        title: 'Change how the public map looks',
        minRole: 'ADMIN',
        steps: [
          'Click "Website" in the left-hand menu and scroll to the styling options.',
          'You can set the accent colour to match your organisation, change the font, hide street labels, or default to satellite view.',
          'Changes apply to the live public map — refresh the Preview to check the result.',
        ],
      },
    ],
  },
  {
    heading: 'Administration',
    guides: [
      {
        id: 'colleagues',
        title: 'Add a colleague and set their password',
        minRole: 'SUPER_ADMIN',
        steps: [
          'Go to User Management (your avatar menu, or /admin/users), and click "Add User".',
          'Enter their email and name, and set a password for them (minimum 8 characters).',
          'Choose their access: "Admin" on a project lets them moderate and configure it; "Client" is view-only.',
          'Share the password with them directly — they can sign in immediately at the login page.',
          'To reset a password later, edit the user and fill in "Set New Password".',
        ],
      },
      {
        id: 'gdpr',
        title: "Handle a resident's data request (GDPR)",
        minRole: 'SUPER_ADMIN',
        steps: [
          'Go to User Management → "GDPR Requests" (or /admin/gdpr).',
          'Enter the email address the resident used — the search covers map comments, form responses, enquiries, and accounts.',
          'For a copy-of-my-data request: click "Export JSON" and send them the file.',
          'For a deletion request: export first if they also want a copy, then click "Erase All" — it removes everything permanently in one step.',
        ],
      },
    ],
  },
]

export function HowToTab({
  isAdmin,
  isSuperAdmin,
  onReplayTour,
  onStartGuide,
}: {
  isAdmin: boolean
  isSuperAdmin: boolean
  onReplayTour: () => void
  onStartGuide: (steps: GuideStep[]) => void
}) {
  const [openGuide, setOpenGuide] = useState<string | null>(null)

  const roleAllows = (minRole: Role) =>
    minRole === 'CLIENT' || (minRole === 'ADMIN' && isAdmin) || (minRole === 'SUPER_ADMIN' && isSuperAdmin)

  const visibleSections = SECTIONS.map(section => ({
    ...section,
    guides: section.guides.filter(g => roleAllows(g.minRole)),
  })).filter(section => section.guides.length > 0)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">How to</h2>
          <p className="text-sm text-slate-600">
            Step-by-step guides for the things you&apos;ll do most. No technical knowledge needed.
          </p>
        </div>
        <button
          onClick={onReplayTour}
          className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium rounded-lg border border-green-200 shrink-0"
        >
          <PlayCircle size={16} />
          Replay the tour
        </button>
      </div>

      {visibleSections.map(section => (
        <div key={section.heading}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {section.heading}
          </h3>
          <div className="space-y-2">
            {section.guides.map(guide => {
              const isOpen = openGuide === guide.id
              return (
                <div key={guide.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setOpenGuide(isOpen ? null : guide.id)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-medium text-slate-800">{guide.title}</span>
                    {isOpen ? (
                      <ChevronDown size={18} className="text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      {WALKTHROUGHS[guide.id] && (
                        <button
                          onClick={() => onStartGuide(WALKTHROUGHS[guide.id])}
                          className="mb-3 flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg"
                        >
                          <PlayCircle size={16} />
                          Show me — walk through it on screen
                        </button>
                      )}
                      <ol className="space-y-2 list-none">
                        {guide.steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-sm text-slate-700">
                            <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                      {guide.tip && (
                        <p className="mt-3 text-sm text-slate-500 bg-slate-50 rounded-lg p-3 flex gap-2">
                          <HelpCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
                          <span>{guide.tip}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center gap-3">
        <Mail size={18} className="text-slate-400 shrink-0" />
        <p className="text-sm text-slate-600">
          Still stuck? Email{' '}
          <a href="mailto:william.neale@secnewgate.co.uk" className="text-green-700 font-medium hover:underline">
            william.neale@secnewgate.co.uk
          </a>{' '}
          and we&apos;ll help you out.
        </p>
      </div>
    </div>
  )
}
