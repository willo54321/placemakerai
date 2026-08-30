import type { Metadata } from 'next'
import './testpage.css'
import Navigation from '@/components/testpage/Navigation'
import Hero from '@/components/testpage/Hero'
import ClientsCarousel from '@/components/testpage/ClientsCarousel'
import ValueProposition from '@/components/testpage/ValueProposition'
import Services from '@/components/testpage/Services'
import CaseStudies from '@/components/testpage/CaseStudies'
import ContactForm from '@/components/testpage/ContactForm'
import Footer from '@/components/testpage/Footer'

// Homepage starter, ported from the original consultation-services marketing
// site (~/Documents/consultation-services). Served at /testpage on the
// marketing domain for editing; promote over /holding when it's right.
export const metadata: Metadata = {
  title: 'Placemaker | Digital Stakeholder Engagement',
  description:
    'Digital stakeholder engagement tools for planning and development projects. Interactive feedback maps, custom feedback forms, and AI-powered analysis.',
  robots: { index: false, follow: false },
}

export default function TestHomePage() {
  return (
    <main className="testpage-root min-h-screen">
      <Navigation />
      <Hero />
      <ClientsCarousel />
      <ValueProposition />
      <Services />

      {/* Light section that overlaps out of dark */}
      <div className="relative z-10 -mt-12 rounded-t-[3rem] bg-[#F7F6F4] pt-16 lg:pt-20">
        <CaseStudies />
      </div>

      <ContactForm />
      <Footer />
    </main>
  )
}
