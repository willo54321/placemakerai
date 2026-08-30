import type { Metadata } from 'next'
import { MapPin, FileText, Sparkles, ArrowRight, Check } from 'lucide-react'
import { HeroDemo } from '@/components/marketing/HeroDemo'

export const metadata: Metadata = {
  title: 'Placemaker — consultation that runs on your website, not ours',
  description:
    'Embed interactive map feedback, custom forms and AI analysis into the website you already have. No new domain, no migration, no vendor lock-in.',
}

const PLATFORM_URL = 'https://platform.placemakerai.io'
const CONTACT =
  'mailto:william.neale@secnewgate.co.uk?subject=Placemaker%20demo%20request'

const EMBED_SNIPPET = `<iframe
  src="${PLATFORM_URL}/embed/your-project"
  width="100%" height="640"
  style="border:0"></iframe>`

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-cream-100 text-slate-900">
      {/* Nav */}
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <MapPin size={17} className="text-white" />
          </span>
          <span className="font-semibold text-lg">Placemaker</span>
        </div>
        <nav className="ml-auto hidden sm:flex items-center gap-6 text-sm text-slate-600">
          <a href="#platform" className="hover:text-slate-900">Platform</a>
          <a href="#how" className="hover:text-slate-900">How it works</a>
          <a href="#analysis" className="hover:text-slate-900">AI analysis</a>
        </nav>
        <a
          href={PLATFORM_URL}
          className="text-sm font-semibold text-brand-700 hover:text-brand-800 whitespace-nowrap"
        >
          Sign in
        </a>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight text-balance">
            Consultation that runs on{' '}
            <span className="text-brand-600">your website</span>, not ours.
          </h1>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-xl">
            Placemaker embeds interactive map feedback, custom forms and AI
            analysis into the site your residents already know. No new domain,
            no migration, no retraining anyone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={CONTACT}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Book a demo
              <ArrowRight size={17} />
            </a>
            <a
              href={PLATFORM_URL}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Go to the platform
            </a>
          </div>
          <p className="mt-5 text-sm text-slate-500">
            Live in ten minutes: create a project, paste one line into your site.
          </p>
        </div>
        <HeroDemo />
      </section>

      {/* Three products */}
      <section id="platform" className="bg-white border-y border-slate-200 scroll-mt-6">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            Three ways in, one analysis.
          </h2>
          <p className="mt-3 text-slate-600 max-w-2xl">
            Every response — a pin on the map, a form submission, an enquiry —
            lands in the same place and gets read by the same analysis.
          </p>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              {
                icon: MapPin,
                title: 'Map feedback',
                body: 'Residents drop pins, draw routes and outline areas on an interactive map of the site — with moderation before anything appears publicly.',
              },
              {
                icon: FileText,
                title: 'Custom forms',
                body: 'Build consultation forms with drag and drop, embed them anywhere, or point an existing website form at our API.',
              },
              {
                icon: Sparkles,
                title: 'AI analysis',
                body: 'Every response is classified — stance, themes, material planning considerations — then counted. Campaign letters are detected automatically.',
              },
            ].map(product => (
              <div key={product.title} className="rounded-2xl border border-slate-200 p-6">
                <span className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
                  <product.icon size={20} className="text-brand-600" />
                </span>
                <h3 className="font-semibold text-lg mb-2">{product.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{product.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <ol className="mt-8 space-y-6">
              {[
                ['Create your project', 'Draw the site boundary, set your colours and typography, choose what feedback to collect.'],
                ['Paste one line into your site', 'The consultation renders inside your pages, in your brand. Residents never leave your website.'],
                ['Read the analysis', 'Stance, themes, material considerations and organised campaigns — counted across every response, ready for a committee report.'],
              ].map(([title, body], index) => (
                <li key={title} className="flex gap-4">
                  <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="rounded-2xl bg-slate-900 p-6 shadow-xl">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                The entire integration
              </p>
              <pre className="text-sm text-emerald-300 font-mono leading-relaxed overflow-x-auto">
                {EMBED_SNIPPET}
              </pre>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              That&apos;s it. No plugin, no subdomain, no DNS ticket.
            </p>
          </div>
        </div>
      </section>

      {/* AI analysis, shown not claimed */}
      <section id="analysis" className="bg-white border-y border-slate-200 scroll-mt-6">
        <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-balance">
              AI you can put in front of a planning committee.
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Most tools summarise a sample and call it insight. Placemaker
              classifies <em>every</em> response, then counts — so each figure
              traces back to the residents behind it.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Stance and themes counted across the whole consultation, not estimated from a sample',
                'Material planning considerations separated from non-material objections',
                'Template letters and organised campaigns detected the moment copies arrive',
                'Geographic patterns significance-tested before they reach a report',
              ].map(point => (
                <li key={point} className="flex gap-3 text-sm text-slate-700">
                  <Check size={17} className="text-brand-600 flex-shrink-0 mt-0.5" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-cream-50 p-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">
              Sample analysis output
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>412 responses classified</span>
                  <span>52% object · 27% neutral · 21% support</span>
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden">
                  <span className="bg-red-500" style={{ width: '52%' }} />
                  <span className="bg-slate-300" style={{ width: '27%' }} />
                  <span className="bg-emerald-500" style={{ width: '21%' }} />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                <span className="font-semibold">&ldquo;Flooding &amp; drainage&rdquo;</span> is
                raised in 64% of responses around Willow Close (58 of 91),
                against 9% elsewhere — 7.1× more common.
                <span className="text-xs text-slate-400 ml-1">p&nbsp;=&nbsp;0.0004</span>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-4 text-sm">
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 mr-2">
                  CAMPAIGN
                </span>
                <span className="text-slate-700">
                  214 responses are copies of one template letter — 137 with
                  personal additions.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight">Built for</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {[
            ['Local authorities', 'Statutory and pre-application consultation on your own .gov.uk site, with analysis your committee can trust.'],
            ['Developers & applicants', 'Show engagement done properly — and know exactly how much opposition is material before determination.'],
            ['Consultancies', 'Run every client consultation from one place, embedded in each client’s site under each client’s brand.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl bg-white border border-slate-200 p-6">
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Honest stage + closing CTA */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            In alpha, onboarding pilot projects now.
          </h2>
          <p className="mt-3 text-slate-300 max-w-xl mx-auto">
            Get in early: pilot pricing, direct access to the people building
            it, and a real say in what ships next.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={CONTACT}
              className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Book a demo
              <ArrowRight size={17} />
            </a>
            <a
              href={PLATFORM_URL}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Go to the platform
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <span>© {new Date().getFullYear()} Placemaker</span>
        <a href="/privacy" className="hover:text-slate-700">Privacy</a>
        <a href={CONTACT} className="hover:text-slate-700 ml-auto">Contact</a>
      </footer>
    </div>
  )
}
