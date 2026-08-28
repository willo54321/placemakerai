import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-8"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">Privacy Policy</h1>

        <div className="prose prose-slate max-w-none">
          <p className="text-slate-600 mb-6">Last updated: 28 August 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">1. Introduction</h2>
            <p className="text-slate-600 mb-4">
              Placemaker.ai is a platform for public consultation on planning and development projects. Each consultation on this platform is run by an organisation — such as a council, developer, or their consultants — who decides what feedback to collect and how it is used. Placemaker.ai provides the software they use to collect and analyse it.
            </p>
            <p className="text-slate-600 mb-4">
              This Privacy Policy explains what personal data the platform collects, how it is used, and your rights. We handle personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">2. Data We Collect</h2>
            <p className="text-slate-600 mb-4">
              We only collect personal data you actively choose to submit:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li><strong>Map feedback:</strong> Comments you attach to map pins or drawn shapes, the map location you choose, and — optionally — your name</li>
              <li><strong>Form responses:</strong> Answers you submit through consultation feedback forms, which may include your name and contact details where a form asks for them</li>
              <li><strong>Enquiries:</strong> Your name, email address, and message when you submit an enquiry, plus phone number and organisation if you provide them</li>
              <li><strong>Account data:</strong> For consultation teams using the dashboard — name, email address, and a securely hashed password</li>
              <li><strong>Vote de-duplication:</strong> When you vote on a map comment, we store a hashed (one-way, irreversible) identifier derived from your connection to limit duplicate votes; we do not store your IP address itself alongside your feedback</li>
            </ul>
            <p className="text-slate-600 mb-4">
              Every public submission requires your explicit consent at the point of submission, and we record when that consent was given.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">3. How Your Data Is Used</h2>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li>
                <strong>Public display of map feedback:</strong> Map comments are reviewed by the consultation team before publication. Once approved, your comment — together with your name, if you provided one — is visible to anyone viewing the consultation map. Your email address is never displayed publicly.
              </li>
              <li>
                <strong>Review by the consultation team:</strong> The organisation running the consultation can see your full submissions, including any contact details you provided, in order to understand and respond to public feedback.
              </li>
              <li>
                <strong>AI-assisted analysis:</strong> The text of submissions is analysed to produce sentiment summaries, common themes, and reports for the consultation team (see section 4).
              </li>
              <li>
                <strong>Legal compliance:</strong> Where required by planning regulations or other legal obligations.
              </li>
            </ul>
            <p className="text-slate-600 mb-4">
              We do not send marketing emails, operate mailing lists, or use your contact details for any purpose beyond the consultation you contributed to.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">4. AI-Assisted Analysis</h2>
            <p className="text-slate-600 mb-4">
              To help consultation teams understand large volumes of feedback, the text of submissions is processed by an AI service (provided by Anthropic) to generate summaries, sentiment analysis, and theme identification. This analysis is advisory only: it summarises feedback in aggregate and is not used to make automated decisions about any individual. Under our agreement with the provider, submissions sent for analysis are not used to train AI models.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">5. Legal Basis for Processing</h2>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li><strong>Consent:</strong> You give explicit consent when submitting feedback, forms, or enquiries</li>
              <li><strong>Legitimate interests:</strong> Running consultations and analysing feedback for planning purposes</li>
              <li><strong>Legal obligation:</strong> Compliance with planning regulations and other laws</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">6. Who Can See Your Data</h2>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li>
                <strong>The public:</strong> Approved map comments (with name, if given) are publicly visible. Form responses and enquiries are never publicly visible.
              </li>
              <li>
                <strong>The consultation team:</strong> The organisation running the consultation sees full submissions, including contact details.
              </li>
              <li>
                <strong>Consultation reports:</strong> Feedback may be quoted in consultation reports and planning submissions; contact details are removed unless you have given explicit consent.
              </li>
            </ul>
            <p className="text-slate-600 mb-4">
              We never sell personal data. We use a small number of service providers to operate the platform: our database is hosted with Supabase in the European Union (Frankfurt, Germany), the application is hosted by Vercel, and AI analysis is provided by Anthropic in the United States. Where data is processed outside the UK, transfers are protected by appropriate safeguards, including standard contractual clauses.
            </p>
            <p className="text-slate-600 mb-4">
              The interactive maps are provided by Google Maps. When you view a consultation map, your browser connects directly to Google, which processes your IP address in order to deliver the map. See Google's own privacy policy for how it handles this data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">7. Data Retention</h2>
            <p className="text-slate-600 mb-4">
              We retain personal data for as long as necessary for the consultation it was submitted to, plus any statutory retention period that applies to planning applications (typically 6 years after completion). Data is deleted when the consultation project it belongs to is deleted.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">8. Your Rights</h2>
            <p className="text-slate-600 mb-4">Under UK GDPR, you have the following rights:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li><strong>Right of Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate personal data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your personal data (subject to legal retention requirements)</li>
              <li><strong>Right to Restrict Processing:</strong> Request limitation of how we use your data</li>
              <li><strong>Right to Data Portability:</strong> Request your data in a machine-readable format</li>
              <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
            </ul>
            <p className="text-slate-600 mb-4">
              To exercise any of these rights, please contact us using the details below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">9. Cookies</h2>
            <p className="text-slate-600 mb-4">
              We use only essential cookies, which are required to sign consultation teams in to the dashboard. We do not use analytics, advertising, or tracking cookies, and members of the public can view and respond to consultations without any account or non-essential cookies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">10. Data Security</h2>
            <p className="text-slate-600 mb-4">
              We implement appropriate technical and organisational measures to protect your personal data, including encrypted data transmission (HTTPS), encrypted database storage, hashed passwords, and role-based access controls so that consultation teams can only access their own projects.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">11. Contact Us</h2>
            <p className="text-slate-600 mb-4">
              If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us:
            </p>
            <p className="text-slate-600 mb-4">
              Email: <a href="mailto:privacy@placemakerai.io" className="text-green-600 hover:text-green-700">privacy@placemakerai.io</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">12. Complaints</h2>
            <p className="text-slate-600 mb-4">
              If you are unhappy with how we have handled your personal data, you have the right to lodge a complaint with the Information Commissioner's Office (ICO):
            </p>
            <p className="text-slate-600">
              Website: <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700">ico.org.uk</a><br />
              Telephone: 0303 123 1113
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
