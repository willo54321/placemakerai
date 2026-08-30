'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MapPinDemo from './MapPinDemo';
import FeedbackFlowDemo from './FeedbackFlowDemo';

const EASE = [0.19, 1, 0.22, 1] as const;

const services = [
  {
    number: '01',
    title: 'Interactive Maps',
    subtitle: 'Location linked feedback with visual context',
    description: 'placemaker.ai enables communities to provide feedback directly linked to specific locations, creating a visual way to understand how concerns, ideas, and support relate to physical places within your project.',
    features: [
      { name: 'Pins, Lines & Polygons', detail: 'Respondents drop pins, draw routes, or outline areas. Each submission is categorised with automatic area and distance calculations.' },
      { name: 'Community Voting & Moderation', detail: 'The public upvotes feedback they agree with, surfacing what matters most. Approve submissions before they go live.' },
      { name: 'Layers & Overlays', detail: 'Add site boundaries, planning zones, and architectural renders. Rotate, resize, and toggle visibility.' },
    ],
  },
  {
    number: '02',
    title: 'Custom Feedback Forms',
    subtitle: 'Build bespoke forms without writing code',
    description: 'placemaker.ai lets you build bespoke consultation forms without writing code. Create unlimited forms, connect external websites via API, and collect responses with GDPR consent tracked automatically on every submission.',
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
] as const;

export default function Services() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // One pinned screen; scroll position through the tall section decides which
  // service is showing. Left text swipes, right visual crossfades.
  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = el.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = Math.min(Math.max(-rect.top / scrollable, 0), 0.9999);
      setActive(Math.floor(progress * services.length));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const jumpTo = (index: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const scrollable = el.offsetHeight - window.innerHeight;
    const top = el.offsetTop + (scrollable * (index + 0.5)) / services.length;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const service = services[active];

  return (
    <section
      id="services"
      ref={sectionRef}
      className="relative"
      style={{ height: `${services.length * 100}vh` }}
    >
      <div
        className="sticky top-0 h-screen flex items-center overflow-hidden"
        style={{
          backgroundColor: active % 2 === 0 ? '#0B2818' : '#1a0b45',
          transition: 'background-color 0.7s ease',
        }}
      >
        {/* Step rail */}
        <div className="hidden lg:flex flex-col gap-3 absolute left-6 top-1/2 -translate-y-1/2 z-10">
          {services.map((entry, index) => (
            <button
              key={entry.number}
              onClick={() => jumpTo(index)}
              aria-label={`Go to ${entry.title}`}
              className="text-[11px] font-medium tabular-nums transition-all duration-300 text-left"
              style={{
                color: index === active ? '#4ADE80' : 'rgba(255,255,255,0.25)',
              }}
            >
              {entry.number}
            </button>
          ))}
        </div>

        <div className="w-full py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left — text swipes upward on change */}
              <div className="relative min-h-[380px] flex items-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={service.number}
                    initial={{ opacity: 0, y: 48 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -48 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="w-full"
                  >
                    <span className="text-6xl font-light text-white/20 block mb-4">
                      {service.number}
                    </span>
                    <h2 className="text-3xl lg:text-4xl font-semibold text-white mb-3 leading-tight">
                      {service.title}
                    </h2>
                    <p className="text-base text-white/50 leading-relaxed mb-4">
                      {service.subtitle}
                    </p>
                    <p className="text-sm text-white/70 leading-relaxed mb-4">
                      {service.description}
                    </p>
                    {'secondaryDescription' in service && service.secondaryDescription && (
                      <p className="text-sm text-white/50 leading-relaxed mb-4">
                        {service.secondaryDescription}
                      </p>
                    )}
                    {'features' in service && service.features && (
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {service.features.map(feature => (
                          <div key={feature.name} className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                            <h4 className="text-xs font-medium text-white mb-1">{feature.name}</h4>
                            <p className="text-[11px] text-white/50 leading-relaxed">{feature.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Right — pinned visual crossfades to match. Demos stay mounted
                  so the Google map loads once and animations keep their state. */}
              <div className="relative aspect-[4/3] w-full">
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: active === 0 ? 1 : 0,
                    transition: 'opacity 0.5s ease',
                    pointerEvents: 'none',
                  }}
                >
                  <MapPinDemo />
                </div>
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: active === 3 ? 1 : 0,
                    transition: 'opacity 0.5s ease',
                    pointerEvents: 'none',
                  }}
                >
                  <FeedbackFlowDemo />
                </div>
                {[1, 2, 4].map(index => (
                  <div
                    key={index}
                    className="absolute inset-0 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center"
                    style={{
                      opacity: active === index ? 1 : 0,
                      transition: 'opacity 0.5s ease',
                      pointerEvents: 'none',
                    }}
                  >
                    <span className="text-white/30 text-sm">{services[index].title} demo</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
