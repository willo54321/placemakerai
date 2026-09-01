'use client';

import { motion } from 'framer-motion';

export default function ValueProposition() {
  return (
    <section className="pt-16 lg:pt-20 pb-0 relative bg-[#0B2818]">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-left"
        >
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-semibold mb-6 tracking-tight leading-tight text-white">
            Our <span className="text-[#16A34A]">tools</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl leading-relaxed">
            Interactive digital tools that help developers, councils, and energy companies run more inclusive and effective community engagement.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
