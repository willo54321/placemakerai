'use client';

import { motion } from 'framer-motion';
import MapPinDemo from './MapPinDemo';
import FeedbackFlowDemo from './FeedbackFlowDemo';

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
    </section>
  );
}
