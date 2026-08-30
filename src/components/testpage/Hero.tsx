'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import InteractiveDots from './InteractiveDots';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Interactive Dot Background */}
      <InteractiveDots />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/80" />

      <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.15] tracking-[-0.02em] mb-6 text-[#0B2818]"
        >
          Digital solutions for
          <br />
          <motion.span
            className="gradient-text"
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              backgroundImage: 'linear-gradient(90deg, #16A34A, #15803D, #16A34A, #15803D)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            public engagement
          </motion.span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl text-[#595959] max-w-2xl mx-auto mb-8 leading-relaxed"
        >
          <span className="font-semibold text-[#0B2818]">placemaker.ai</span> is a strategic engagement platform for development and infrastructure projects. Simple digital tools for inclusive community engagement.
        </motion.p>

        {/* Audience Tags */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="flex flex-wrap justify-center gap-3 mb-10"
        >
          {[
            'Major Residential Schemes',
            'Infrastructure & Energy',
            'Regeneration Programmes',
            'Local Authority Consultations',
          ].map((tag) => (
            <span
              key={tag}
              className="px-4 py-1.5 text-sm font-medium text-[#0B2818] bg-white/80 border border-[rgba(22,9,62,0.1)] rounded-full"
            >
              {tag}
            </span>
          ))}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a href="#services" className="btn-primary text-base group">
            Explore Services
            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </a>
          <a href="#contact" className="btn-secondary text-base">
            Get in Touch
          </a>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-gray-300 flex items-start justify-center p-2"
        >
          <motion.div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        </motion.div>
      </motion.div>
    </section>
  );
}
