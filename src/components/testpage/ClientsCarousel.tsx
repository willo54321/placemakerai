'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const clients = [
  { name: 'Vistry Homes', logo: '/logos/vistry-logo-dark.svg' },
  { name: 'GLP', logo: '/logos/glp-logo-green.svg' },
  { name: 'Brockwell Energy', logo: '/logos/brockwell-energy-logo.svg' },
  { name: 'Church of England', logo: '/logos/church-of-england-logo.svg' },
  { name: 'Royal Mail', logo: '/logos/royal-mail.png' },
];

export default function ClientsCarousel() {
  return (
    <section id="clients-carousel" className="py-12 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center text-sm text-gray-500 font-medium mb-8"
        >
          Trusted by leading developers and energy companies
        </motion.p>
      </div>

      {/* Logo carousel - full width */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none" />

        <div className="group/logos flex items-center gap-16 w-max animate-scroll">
          {[...clients, ...clients, ...clients, ...clients, ...clients, ...clients].map((client, index) => (
            <div
              key={`${client.name}-${index}`}
              className="flex-shrink-0 h-12 w-40 relative transition-all duration-300 group-hover/logos:opacity-40 group-hover/logos:grayscale hover:!opacity-100 hover:!grayscale-0"
            >
              <Image
                src={client.logo}
                alt={client.name}
                fill
                className="object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
