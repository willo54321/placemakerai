'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Check } from 'lucide-react';
import MapPinDemo from './MapPinDemo';
import ModerationDemo from './ModerationDemo';
import AnalysisDemo from './AnalysisDemo';
import {
  MiniShapesDemo,
  MiniVotingDemo,
  MiniLayersDemo,
  MiniApiDemo,
  MiniComplianceDemo,
  MiniSecureDemo,
  MiniSentimentDemo,
  MiniThemesDemo,
  MiniMaterialDemo,
  MiniMatrixDemo,
  MiniStanceDemo,
  MiniEngagementLogDemo,
  MiniAuditTrailDemo,
  MiniSharedInboxDemo,
  MiniReplyEmailDemo,
  MiniThreadHistoryDemo,
  MiniFeedsAiDemo,
} from './MiniFeatureDemos';

const MINI_DEMOS: Record<string, () => JSX.Element> = {
  'Pins, Lines & Polygons': MiniShapesDemo,
  'Community Voting & Moderation': MiniVotingDemo,
  'Layers & Overlays': MiniLayersDemo,
  'API Integration': MiniApiDemo,
  'Built-In Compliance': MiniComplianceDemo,
  'Secure Response Storage': MiniSecureDemo,
  'Sentiment Analysis': MiniSentimentDemo,
  'Theme Extraction': MiniThemesDemo,
  'Material Considerations': MiniMaterialDemo,
  'Power / interest matrix': MiniMatrixDemo,
  'Stance tracking': MiniStanceDemo,
  'Engagement log': MiniEngagementLogDemo,
  'Consultation audit trail': MiniAuditTrailDemo,
  'Shared inbox': MiniSharedInboxDemo,
  'Reply by email': MiniReplyEmailDemo,
  'Full thread history': MiniThreadHistoryDemo,
  'Feeds AI analysis': MiniFeedsAiDemo,
};
import FeedbackFlowDemo from './FeedbackFlowDemo';
import FormBuilderDemo from './FormBuilderDemo';
import StakeholderCrmDemo from './StakeholderCrmDemo';
import EnquiryInboxDemo from './EnquiryInboxDemo';

const services = [
  {
    number: '01',
    title: 'Interactive Maps',
    subtitle: 'Location linked feedback with visual context',
    description: 'placemaker.ai enables communities to provide feedback directly linked to specific locations, creating a visual way to understand how concerns, ideas, and support relate to physical places within your project.',
    secondaryDescription: '',
    modal: {
      headline: 'Feedback, pinned to the places it’s about',
      intro:
        'The map is where residents already think about your project — in streets, junctions, footpaths and boundaries. placemaker.ai turns that spatial instinct into structured, analysable feedback.',
      bullets: [
        'Collect pins, drawn routes and outlined areas — each categorised, with distances and areas calculated automatically',
        'Moderate every submission before it goes public, then let residents upvote what they agree with',
        'Overlay site boundaries, planning zones and architectural renders in your own branding',
        'Embeds into the website you already have with a single line of code — every pin feeds the same AI analysis as your forms and enquiries',
      ],
      footnote: 'No separate consultation portal, no new domain, nothing for residents to learn.',
      featureCards: [
        { name: 'Pins, Lines & Polygons', detail: 'Respondents drop pins, draw routes, or outline areas. Each submission is categorised with automatic area and distance calculations.' },
        { name: 'Community Voting & Moderation', detail: 'The public upvotes feedback they agree with, surfacing what matters most. Approve submissions before they go live.' },
        { name: 'Layers & Overlays', detail: 'Add site boundaries, planning zones, and architectural renders. Rotate, resize, and toggle visibility.' },
      ],
    },
  },
  {
    number: '02',
    title: 'Custom Feedback Forms',
    subtitle: 'Build bespoke forms without writing code',
    description: 'placemaker.ai lets you build bespoke consultation forms without writing code. Create unlimited forms, connect external websites via API, and collect responses with GDPR consent tracked automatically on every submission.',
    secondaryDescription: '',
    modal: {
      headline: 'Build bespoke forms without writing code',
      intro:
        'placemaker.ai lets you build bespoke consultation forms without writing code. Create unlimited forms, connect external websites via API, and collect responses with GDPR consent tracked automatically on every submission.',
      bullets: [
        'Eight field types — text, dropdowns, checkboxes and ratings — with drag-and-drop reordering and instant preview',
        'Connect any website with a single endpoint that auto-detects field names and builds the schema on the fly',
        'GDPR consent mandatory on every submission — timestamps recorded automatically, mailing opt-in kept separate',
        'Every response stored in a secure database with GDPR consent recorded — personal data visible only to your project team',
      ],
      footnote: 'Every form lives at its own shareable link — or posts in from your existing website.',
      featureCards: [
        { name: 'API Integration', detail: 'Connect any website with a single endpoint. Auto-detects field names and builds the schema on the fly.' },
        { name: 'Built-In Compliance', detail: 'GDPR consent mandatory on every submission. Timestamps recorded automatically, mailing opt-in kept separate.' },
        { name: 'Secure Response Storage', detail: 'Every submission is stored in a secure database with GDPR consent recorded — personal data stays protected and visible only to your project team.' },
      ],
    },
  },
  {
    number: '03',
    title: 'AI-Powered Analysis',
    subtitle: 'From raw feedback to executive summaries',
    description: 'Automated sentiment analysis, theme extraction, and material vs non-material consideration classification.',
    secondaryDescription: 'Generates executive summaries and recommendations from raw feedback, saving hours of manual review while ensuring nothing is missed.',
    modal: {
      headline: 'From raw feedback to executive summaries',
      intro:
        'Automated sentiment analysis, theme extraction, and material vs non-material consideration classification. placemaker.ai generates executive summaries from raw feedback, saving hours of manual review while ensuring nothing is missed.',
      bullets: [
        'Every response classified for stance — support, objection and mixed positions counted, not estimated',
        'Themes extracted and quantified across map comments, form responses and enquiries in one pass',
        'Material planning considerations separated from non-material automatically',
        'Executive summaries written from the evidence — hours of manual review done in minutes',
      ],
      footnote: 'One analysis across every channel — map pins, form responses and public enquiries.',
      featureCards: [
        { name: 'Sentiment Analysis', detail: 'Each response is classified as support, objection, mixed or neutral — so headline figures are counts of real responses, not estimates.' },
        { name: 'Theme Extraction', detail: 'Recurring topics are identified and quantified, showing exactly how many responses raise traffic, housing, green space and more.' },
        { name: 'Material Considerations', detail: 'Feedback is separated into material and non-material planning considerations, ready for officer reports and committee.' },
      ],
    },
  },
  {
    number: '05',
    title: 'Stakeholder CRM',
    subtitle: 'Track every contact, meeting and position',
    description: 'Keep a live register of the people and organisations you engage — councillors, residents’ groups, businesses and statutory bodies. Map each by influence and interest, record their stance, and log every meeting, call and email so your consultation has a defensible audit trail.',
    secondaryDescription: '',
    modal: {
      headline: 'Every stakeholder, mapped and logged',
      intro:
        'Keep a live register of the people and organisations you engage. Map each by influence and interest, track where they stand, and log every meeting, call and email — so your consultation has a defensible audit trail.',
      bullets: [
        'Plot every contact on a power / interest matrix — manage closely, keep satisfied, or simply keep informed',
        'Mark each stakeholder supporter, opposed, neutral or undecided, and watch positions shift as you engage',
        'Log every meeting, call, email and letter against the contact, each one time-stamped',
        'Produce a who-engaged-when-and-how record, ready for the statement of community involvement',
      ],
      footnote: 'A consultation audit trail, not a sales pipeline.',
      featureCards: [
        { name: 'Power / interest matrix', detail: 'Plot every stakeholder by influence and interest to see who to manage closely, keep satisfied, or simply keep informed.' },
        { name: 'Stance tracking', detail: 'Mark each contact supporter, opposed, neutral or undecided — and watch positions shift as engagement progresses.' },
        { name: 'Engagement log', detail: 'Record every meeting, call, email and letter against the contact, building a time-stamped audit trail.' },
        { name: 'Consultation audit trail', detail: 'Show exactly who you engaged, when, and how — ready for the statement of community involvement.' },
      ],
    },
  },
  {
    number: '06',
    title: 'Enquiry Management System',
    subtitle: 'Reply to the public from one shared desk',
    description: 'Public enquiries submitted from your site land in a shared inbox. Read the full conversation, reply by email in a click, and track each enquiry from new to closed — and every message still feeds the same AI analysis as your map and forms.',
    secondaryDescription: '',
    modal: {
      headline: 'Every public enquiry, answered from one place',
      intro:
        'A branded enquiry form embeds on your site and every submission lands in a shared inbox. Read the full thread, reply by email in a click, and move each enquiry from new to closed — while the text still feeds the same AI analysis as your map and forms.',
      bullets: [
        'Every public enquiry in one desk — filterable by new, open and closed, with unread tracking',
        'Reply by email straight from the platform; the enquirer’s response comes back to your inbox',
        'The original enquiry and every reply logged together, with a delivery status on each message',
        'Enquiry text analysed for sentiment and themes alongside map comments and form responses',
      ],
      footnote: 'Public enquiries are a data channel and a conversation — not a separate silo.',
      featureCards: [
        { name: 'Shared inbox', detail: 'Every public enquiry in one desk, filterable by new, open and closed, with unread tracking.' },
        { name: 'Reply by email', detail: 'Answer from the platform; the reply is emailed to the enquirer and their response comes back to your inbox.' },
        { name: 'Full thread history', detail: 'The original enquiry and every reply logged together, with a delivery status on each message.' },
        { name: 'Feeds AI analysis', detail: 'Enquiry text is analysed for sentiment and themes alongside map comments and form responses.' },
      ],
    },
  },
  {
    number: '04',
    title: 'Every Channel, One Analysis',
    subtitle: 'All your stakeholder feedback in one place',
    description: 'Every channel lands in the same project: public enquiries, map comments, and form responses. One database, one moderation queue, and one AI analysis across everything — so nothing said anywhere gets missed.',
    secondaryDescription: '',
    features: [
      { name: 'Public Enquiries', detail: 'A branded enquiry form embeds on your site; submissions feed straight into the project.' },
      { name: 'Map Comments', detail: 'Every pin, line, and polygon comment sits alongside the rest of the feedback.' },
      { name: 'Form Responses', detail: 'In-platform forms and external website forms via API, collected with GDPR consent.' },
      { name: 'One AI Analysis', detail: 'Stance, themes, and material considerations counted across every channel in a single pass.' },
    ],
  },
];

export default function Services() {
  const [openModal, setOpenModal] = useState<string | null>(null);
  const open = services.find((service) => service.number === openModal);

  // Lock page scroll and close on Escape while the modal is up.
  useEffect(() => {
    if (!openModal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [openModal]);

  return (
    <section id="services">
      {services.map((service, index) => (
        <div
          key={service.number}
          className="lg:sticky lg:top-0 lg:min-h-screen flex items-start"
          style={{
            zIndex: index + 1,
            backgroundColor: index % 2 === 0 ? '#0B2818' : '#1a0b45',
          }}
        >
          <div className="w-full py-20 lg:py-24">
            <div className="max-w-6xl mx-auto px-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                {/* Left side - All text content */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Title */}
                  <h2 className="text-3xl lg:text-4xl font-semibold text-white mb-3 leading-tight">
                    {service.title}
                  </h2>

                  {/* Subtitle */}
                  <p className="text-base text-white/50 leading-relaxed mb-4">
                    {service.subtitle}
                  </p>

                  {/* Description */}
                  <p className="text-sm text-white leading-relaxed mb-4">
                    {service.description}
                  </p>
                  {service.secondaryDescription && (
                    <p className="text-sm text-white/80 leading-relaxed mb-4">
                      {service.secondaryDescription}
                    </p>
                  )}

                  {'modal' in service && service.modal && (
                    <button
                      onClick={() => setOpenModal(service.number)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4ADE80] hover:text-[#86EFAC] transition-colors mb-2 group/learn"
                    >
                      Learn more
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/learn:translate-x-0.5" />
                    </button>
                  )}

                  {/* Features list */}
                  {service.features && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {service.features.map((feature) => (
                        <div key={feature.name} className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                          <h4 className="text-xs font-medium text-white mb-1">{feature.name}</h4>
                          <p className="text-[11px] text-white/50 leading-relaxed">{feature.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Right side - Image */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="flex items-center"
                >
                  {service.number === '01' ? (
                    <MapPinDemo />
                  ) : service.number === '02' ? (
                    <FormBuilderDemo />
                  ) : service.number === '04' ? (
                    <FeedbackFlowDemo />
                  ) : service.number === '05' ? (
                    <div className="w-full rounded-lg overflow-hidden border border-white/10">
                      <StakeholderCrmDemo />
                    </div>
                  ) : service.number === '06' ? (
                    <div className="w-full rounded-lg overflow-hidden border border-white/10">
                      <EnquiryInboxDemo />
                    </div>
                  ) : (
                    <div className="w-full rounded-lg overflow-hidden border border-white/10">
                      <AnalysisDemo />
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Stripe-style feature modal */}
      <AnimatePresence>
        {open && 'modal' in open && open.modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8"
            style={{ backgroundColor: 'rgba(11, 40, 24, 0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setOpenModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto relative"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`${open.title} details`}
            >
              <button
                onClick={() => setOpenModal(null)}
                className="absolute top-5 right-5 sm:top-7 sm:right-7 p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors z-10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8 sm:p-12 lg:p-14">
                {/* Header: headline + CTAs left, benefit checklist right */}
                <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16 items-start pr-10 sm:pr-14">
                  <div>
                    <h3 className="font-heading text-3xl sm:text-4xl font-bold text-[#0B2818] tracking-[-0.02em] leading-[1.1] mb-4">
                      {open.modal.headline}
                    </h3>
                    <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl">
                      {open.modal.intro}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a href="#contact" onClick={() => setOpenModal(null)} className="btn-primary text-sm justify-center">
                        Start a Project
                        <ArrowRight className="w-4 h-4" />
                      </a>
                      <button onClick={() => setOpenModal(null)} className="btn-secondary text-sm justify-center">
                        Close
                      </button>
                    </div>
                    <p className="text-sm text-slate-400 mt-6">{open.modal.footnote}</p>
                  </div>

                  <ul className="space-y-4 lg:mt-2">
                    {open.modal.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-[#16A34A]" strokeWidth={3} />
                        </span>
                        <span className="text-[15px] text-slate-700 leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Product visual on a soft gradient, Stripe-style: the real approval flow */}
                <div
                  className="mt-10 sm:mt-12 rounded-2xl overflow-hidden px-6 pt-8 sm:px-14 sm:pt-12"
                  style={{
                    background:
                      'linear-gradient(115deg, #ECFDF5 0%, #F0FDF4 35%, #FFFFFF 60%, #D1FAE5 100%)',
                  }}
                >
                  <div className="max-w-2xl mx-auto -mb-2 sm:-mb-3 rounded-t-xl overflow-hidden shadow-2xl border border-slate-200/70 border-b-0">
                    {open.number === '01' ? (
                      <ModerationDemo />
                    ) : open.number === '02' ? (
                      <FormBuilderDemo />
                    ) : open.number === '05' ? (
                      <StakeholderCrmDemo />
                    ) : open.number === '06' ? (
                      <EnquiryInboxDemo />
                    ) : (
                      <AnalysisDemo />
                    )}
                  </div>
                </div>

                {/* More to discover — Stripe-style cards, each with a mini product demo */}
                <div className="mt-12 sm:mt-14">
                  <h4 className="font-heading text-2xl sm:text-[26px] font-bold text-[#0B2818] tracking-[-0.02em] mb-7">
                    More to discover
                  </h4>
                  <div className="grid sm:grid-cols-3 gap-6 lg:gap-8">
                    {open.modal.featureCards.map((feature) => {
                      const MiniDemo = MINI_DEMOS[feature.name];
                      return (
                        <div key={feature.name}>
                          <div className="rounded-xl bg-slate-50 border border-slate-100 overflow-hidden aspect-[4/3] mb-4">
                            {MiniDemo && <MiniDemo />}
                          </div>
                          <h5 className="text-[15px] font-semibold text-[#0B2818] mb-1.5">{feature.name}</h5>
                          <p className="text-sm text-slate-600 leading-relaxed">{feature.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
