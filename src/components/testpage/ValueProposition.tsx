'use client';

import { motion } from 'framer-motion';

export default function ValueProposition() {
  return (
    <section className="pt-24 lg:pt-32 pb-16 lg:pb-20 relative bg-[#0B2818]">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <span className="text-sm font-medium text-[#16A34A] uppercase tracking-wider mb-4 block">
            What We Do
          </span>
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-semibold mb-6 tracking-tight leading-tight text-white">
            Our <span className="text-[#16A34A]">tools</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Interactive digital tools that help developers, councils, and energy companies run more inclusive and effective community engagement.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
