import Link from 'next/link'
import { MapPin, ArrowRight } from 'lucide-react'

// Served on placemakerai.io / www while the marketing site is being built.
// The product lives on platform.placemakerai.io (see middleware).
export default function HoldingPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-xl text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center">
              <MapPin className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-semibold text-white">Placemaker.ai</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-semibold text-white mb-4">
            Better public consultation for planning projects
          </h1>
          <p className="text-slate-400 text-lg mb-10">
            Interactive map feedback, custom feedback forms, and AI-powered
            analysis — all in one place. Our full website is coming soon.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://platform.placemakerai.io"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
            >
              Go to the platform
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="mailto:william.neale@secnewgate.co.uk?subject=Placemaker%20enquiry"
              className="inline-block text-slate-300 hover:text-white font-medium px-6 py-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
            >
              Get in touch
            </a>
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 flex items-center justify-center gap-6 text-sm text-slate-500">
        <Link href="/privacy" className="hover:text-slate-300">
          Privacy
        </Link>
        <a
          href="https://platform.placemakerai.io/login"
          className="hover:text-slate-300"
        >
          Sign in
        </a>
      </footer>
    </div>
  )
}
