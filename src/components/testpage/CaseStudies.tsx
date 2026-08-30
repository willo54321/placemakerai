'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { caseStudies } from './case-studies-data';

export default function CaseStudies() {
  const [expandedId, setExpandedId] = useState<string>(caseStudies[0]?.slug ?? '');

  const toggle = (slug: string) => {
    setExpandedId(slug === expandedId ? '' : slug);
  };

  return (
    <section id="case-studies" className="py-28 lg:py-36 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        {/* Section Header — Stripe subsection-header-grid: 12-col, title left, description right */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 gap-4 mb-6 sm:mb-8 lg:mb-12"
        >
          {/* Title — spans 6 cols on desktop */}
          <div className="col-span-4 sm:col-span-8 lg:col-span-6 flex flex-col gap-2 lg:gap-6">
            <h2
              className="text-[20px] sm:text-[22px] lg:text-[26px] font-light tracking-[-0.01em] leading-[1.09] max-w-[30ch]"
              style={{ textWrap: 'balance' }}
            >
              Case <span className="gradient-text">Studies</span>
            </h2>
            {/* CTA below title on desktop */}
            <div className="hidden lg:block mt-0">
              <a href="#contact" className="btn-primary text-sm inline-flex group">
                Start a Project
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </div>
          </div>

          {/* Description — right side on desktop (cols 8 to end) */}
          <div className="col-span-4 sm:col-span-8 lg:col-span-5 lg:col-start-8 lg:pt-[5.5px]">
            <p
              className="text-[16px] sm:text-[18px] font-light text-gray-500 leading-[1.4] max-w-[50ch]"
              style={{ textWrap: 'pretty' }}
            >
              See how developers and landowners are using our tools to run
              better consultations and build community support.
            </p>
          </div>

          {/* Mobile CTA */}
          <div className="col-span-4 sm:col-span-8 lg:hidden mt-4">
            <a href="#contact" className="btn-primary text-sm inline-flex group">
              Start a Project
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>
        </motion.div>

        {/* Accordion — Stripe customer-stories */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
        >
          {caseStudies.map((study, index) => {
            const isExpanded = expandedId === study.slug;

            return (
              <AccordionItem
                key={study.slug}
                study={study}
                index={index}
                isExpanded={isExpanded}
                isFirst={index === 0}
                onToggle={() => toggle(study.slug)}
              />
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function AccordionItem({
  study,
  index,
  isExpanded,
  isFirst,
  onToggle,
}: {
  study: (typeof caseStudies)[0];
  index: number;
  isExpanded: boolean;
  isFirst: boolean;
  onToggle: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(0);

  useEffect(() => {
    if (isExpanded && contentRef.current) {
      setMaxHeight(contentRef.current.scrollHeight);
    } else {
      setMaxHeight(0);
    }
  }, [isExpanded]);

  return (
    <div
      className="relative"
      style={{ ['--idx' as string]: index }}
    >
      {/* Dashed separator — Stripe: 1px dashed border-quiet */}
      {!isFirst && (
        <div className="h-px border-t border-dashed border-[#e5edf5]" />
      )}

      {/* Summary row — Stripe: flex, items-center, cursor-pointer, margin-block: 16px */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-4 py-4 text-left group/summary ${
          isExpanded ? 'cursor-default' : 'cursor-pointer'
        }`}
      >
        {/* Logo — Stripe: 40×40 icon */}
        <div className="w-10 h-10 relative flex-shrink-0 self-start rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
          <Image
            src={study.logo}
            alt={study.client}
            fill
            className="object-contain p-1"
          />
        </div>

        {/* Headline — Stripe: hds-heading--sm (18px mobile, 22px desktop), weight 300 */}
        <h3 className={`flex-1 font-light tracking-[-0.01em] leading-[1.22] text-[18px] sm:text-[20px] lg:text-[22px] transition-colors duration-300 ${
          isExpanded ? 'text-gray-900' : 'text-gray-900 group-hover/summary:text-[#16A34A]'
        }`}>
          {study.headline}
        </h3>

        {/* Action button — Stripe: 40×40 default, expands to show text on open */}
        <div className="hidden sm:block flex-shrink-0 self-start">
          {isExpanded ? (
            <Link
              href="#contact"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[#0B2818] text-white text-sm font-medium hover:bg-[#0B2818]/90 transition-all duration-[400ms] ease-[cubic-bezier(.3,0,.2,1)]"
            >
              Discuss a project like this
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#16A34A] border border-emerald-50 flex items-center justify-center group-hover/summary:bg-[#0B2818] group-hover/summary:text-white group-hover/summary:border-[#0B2818] transition-all duration-[400ms] ease-[cubic-bezier(.3,0,.2,1)]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6.87988 5.125H11.75v1.75H6.87988v4.875h-1.75V6.875H.25v-1.75h4.87988V.25h1.75z" fill="currentColor" />
              </svg>
            </div>
          )}
        </div>
      </button>

      {/* Expanded content — Stripe: max-height animation, 0.5s cubic-bezier(.65,0,.35,1) */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(.65,0,.35,1)]"
        style={{
          maxHeight: `${maxHeight}px`,
          visibility: isExpanded ? 'visible' : 'hidden',
          transitionProperty: 'max-height, visibility',
          transitionDelay: isExpanded ? '0s, 0s' : '0s, 0.5s',
        }}
      >
        {/* Image — Stripe: rounded-md (8px), overflow hidden */}
        <div className="rounded-lg overflow-hidden relative bg-gray-100 mb-4">
          <Image
            src={study.image}
            alt={`${study.project} consultation`}
            width={1232}
            height={530}
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Stats grid — only show if results exist */}
        {study.results && study.results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr] gap-4 pt-4 pb-6 lg:pt-6 lg:pb-12 pr-4">
            {study.results.map((result, i) => (
              <div key={result.label} className={`${i === 2 ? 'sm:col-span-2 lg:col-span-1' : ''}`} style={{ textWrap: 'pretty' }}>
                <div className="text-[16px] font-light text-gray-500 leading-[1.4]">
                  <span className="font-normal text-gray-900">{result.value}</span>{' '}
                  {result.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile read-story link */}
        <div className="sm:hidden mb-6">
          <Link
            href="#contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0B2818] text-white text-sm font-medium"
          >
            Read the case study
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
