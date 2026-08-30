'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
import MapPinDemo from './MapPinDemo';
import FeedbackFlowDemo from './FeedbackFlowDemo';
import FormBuilderDemo from './FormBuilderDemo';

const services = [
  {
    number: '01',
    title: 'Interactive Maps',
    subtitle: 'Location linked feedback with visual context',
    description: 'placemaker.ai enables communities to provide feedback directly linked to specific locations, creating a visual way to understand how concerns, ideas, and support relate to physical places within your project.',
    secondaryDescription: '',
    
    features: [
      { name: 'Pins, Lines & Polygons', detail: 'Respondents drop pins, draw routes, or outline areas. Each submission is categorised with automatic area and distance calculations.' },
      { name: 'Community Voting & Moderation', detail: 'The public upvotes feedback they agree with, surfacing what matters most. Approve submissions before they go live.' },
      { name: 'Layers & Overlays', detail: 'Add site boundaries, planning zones, and architectural renders. Rotate, resize, and toggle visibility.' },
    ],
    modal: {
      intro:
        'The map is where residents already think about your project — in streets, junctions, footpaths and boundaries. placemaker.ai turns that spatial instinct into structured, analysable feedback.',
      sections: [
        {
          title: 'Every kind of spatial feedback',
          body: 'Visitors drop pins for a spot, draw lines for routes and desire paths, or outline whole areas. Each submission carries a category — positive, negative, question or comment — plus a written comment of up to 2,000 characters, with area and distance calculated automatically for drawn shapes.',
        },
        {
          title: 'Moderation before anything goes public',
          body: 'Nothing appears on the public map until you approve it. Submissions queue for review, and once live, residents can upvote the feedback they agree with — so the strength of feeling around an issue is visible, not guessed.',
        },
        {
          title: 'Your site plan, in context',
          body: 'Upload GeoJSON boundaries and planning zones, overlay architectural renders or masterplans, and rotate, resize and toggle them. Street labels can be hidden for cleaner presentation, and the whole embed inherits your colours and typography.',
        },
        {
          title: 'It lives on your website',
          body: 'The map embeds into your existing site with a single line of code — no separate consultation portal, no new domain, nothing for residents to learn. Every pin then feeds the same AI analysis as your forms and enquiries.',
        },
      ],
    },
  },
  {
    number: '02',
    title: 'Custom Feedback Forms',
    subtitle: 'Build bespoke forms without writing code',
    description: 'placemaker.ai lets you build bespoke consultation forms without writing code. Create unlimited forms, connect external websites via API, and collect responses with GDPR consent tracked automatically on every submission.',
    secondaryDescription: '',
    features: [
      { name: 'Drag-and-Drop Builder', detail: 'Eight field types including text, dropdowns, checkboxes, and ratings. Reorder fields, mark as required, and preview instantly.' },
      { name: 'API Integration', detail: 'Connect any website with a single endpoint. Auto-detects field names and builds the schema on the fly.' },
      { name: 'Built-In Compliance', detail: 'GDPR consent mandatory on every submission. Timestamps recorded automatically, mailing opt-in kept separate.' },
      { name: 'Smart Responses', detail: 'View submissions in expandable cards with automatic name and email detection. Click any email to start a conversation.' },
    ],
  },
  {
    number: '03',
    title: 'AI-Powered Analysis',
    subtitle: 'From raw feedback to executive summaries',
    description: 'Automated sentiment analysis, theme extraction, and material vs non-material consideration classification.',
    secondaryDescription: 'Generates executive summaries and recommendations from raw feedback, saving hours of manual review while ensuring nothing is missed.',
  },
  {
    number: '04',
    title: 'Stakeholder Relationship Management',
    subtitle: 'All of your stakeholder feedback in one place',
    description: 'Every channel lands in the same project: public enquiries, map comments, and form responses. One database, one moderation queue, and one AI analysis across everything — so nothing said anywhere gets missed.',
    secondaryDescription: '',
    features: [
      { name: 'Public Enquiries', detail: 'A branded enquiry form embeds on your site; submissions feed straight into the project.' },
      { name: 'Map Comments', detail: 'Every pin, line, and polygon comment sits alongside the rest of the feedback.' },
      { name: 'Form Responses', detail: 'In-platform forms and external website forms via API, collected with GDPR consent.' },
      { name: 'One AI Analysis', detail: 'Stance, themes, and material considerations counted across every channel in a single pass.' },
    ],
  },
  {
    number: '05',
    title: 'Construction Reporting',
    subtitle: 'Dedicated issue reporting for live sites',
    description: 'Purpose-built reporting mode for construction phases covering noise, dust, traffic, damage, and safety.',
    secondaryDescription: 'Give neighbours an easy way to report issues directly to your team, with automatic categorisation and response tracking.',
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
          className="sticky top-0 h-screen flex items-center"
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
                  {/* Number */}
                  <span className="text-6xl font-light text-white/20 block mb-4">
                    {service.number}
                  </span>

                  {/* Title */}
                  <h2 className="text-3xl lg:text-4xl font-semibold text-white mb-3 leading-tight">
                    {service.title}
                  </h2>

                  {/* Subtitle */}
                  <p className="text-base text-white/50 leading-relaxed mb-4">
                    {service.subtitle}
                  </p>

                  {/* Description */}
                  <p className="text-sm text-white/70 leading-relaxed mb-4">
                    {service.description}
                  </p>
                  {service.secondaryDescription && (
                    <p className="text-sm text-white/50 leading-relaxed mb-4">
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
                  ) : (
                    <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-white/10 flex items-center justify-center border border-white/10">
                      <span className="text-white/30 text-sm">{service.title} screenshot</span>
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
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto relative"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`${open.title} details`}
            >
              <button
                onClick={() => setOpenModal(null)}
                className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8 sm:p-10">
                <span className="text-sm font-medium text-[#16A34A] uppercase tracking-wider">
                  {open.number}
                </span>
                <h3 className="text-2xl sm:text-3xl font-semibold text-[#0B2818] mt-1 mb-2 tracking-tight">
                  {open.title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-8">{open.modal.intro}</p>

                <div className="space-y-6">
                  {open.modal.sections.map((section) => (
                    <div key={section.title} className="border-t border-slate-100 pt-5">
                      <h4 className="font-semibold text-[#0B2818] mb-1.5">{section.title}</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">{section.body}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-9 flex flex-col sm:flex-row gap-3">
                  <a href="#contact" onClick={() => setOpenModal(null)} className="btn-primary text-sm justify-center">
                    Get in Touch
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <button onClick={() => setOpenModal(null)} className="btn-secondary text-sm justify-center">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
