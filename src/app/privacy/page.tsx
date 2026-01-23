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
          <p className="text-slate-600 mb-6">
            Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">1. Introduction</h2>
            <p className="text-slate-600 mb-4">
              This Privacy Policy explains how we collect, use, store, and protect your personal data when you use our consultation platform. We are committed to protecting your privacy and ensuring your personal data is handled in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">2. Data We Collect</h2>
            <p className="text-slate-600 mb-4">We may collect the following personal data:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li><strong>Contact Information:</strong> Name, email address, phone number, organisation</li>
              <li><strong>Feedback Data:</strong> Comments, opinions, and responses submitted through feedback forms and interactive maps</li>
              <li><strong>Location Data:</strong> Geographic coordinates when you place pins on consultation maps (only when you choose to do so)</li>
              <li><strong>Communication Data:</strong> Enquiries, messages, and correspondence you send us</li>
              <li><strong>Technical Data:</strong> Browser type, device information, and cookies (with your consent)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">3. How We Use Your Data</h2>
            <p className="text-slate-600 mb-4">We use your personal data for the following purposes:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li>To process and respond to your consultation feedback</li>
              <li>To respond to enquiries and provide customer support</li>
              <li>To send updates about consultations you've participated in (with your consent)</li>
              <li>To analyse feedback and improve our consultation processes</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">4. Legal Basis for Processing</h2>
            <p className="text-slate-600 mb-4">We process your personal data under the following legal bases:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li><strong>Consent:</strong> When you actively opt-in to receive communications or submit feedback</li>
              <li><strong>Legitimate Interests:</strong> To conduct consultations and analyse feedback for planning purposes</li>
              <li><strong>Legal Obligation:</strong> When required to comply with planning regulations or other laws</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">5. Data Sharing</h2>
            <p className="text-slate-600 mb-4">
              We may share anonymised and aggregated feedback data with local planning authorities, councils, and stakeholders involved in the consultation process. We will never sell your personal data to third parties.
            </p>
            <p className="text-slate-600 mb-4">
              Your feedback comments may be published in consultation reports, but personal contact details will be removed unless you have given explicit consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">6. Data Retention</h2>
            <p className="text-slate-600 mb-4">
              We retain your personal data for as long as necessary to fulfil the purposes for which it was collected, typically for the duration of the consultation process plus any statutory retention period required for planning applications (usually 6 years after completion).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">7. Your Rights</h2>
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
            <h2 className="text-xl font-semibold text-slate-900 mb-4">8. Cookies</h2>
            <p className="text-slate-600 mb-4">
              We use essential cookies to make our site work. These cookies are necessary for the basic functionality of the platform and cannot be disabled.
            </p>
            <p className="text-slate-600 mb-4">
              With your consent, we may also use analytics cookies to understand how visitors interact with our site. You can manage your cookie preferences at any time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">9. Data Security</h2>
            <p className="text-slate-600 mb-4">
              We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, alteration, disclosure, or destruction. This includes encrypted data transmission (HTTPS), secure database storage, and access controls.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">10. Contact Us</h2>
            <p className="text-slate-600 mb-4">
              If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us:
            </p>
            <p className="text-slate-600 mb-4">
              Email: <a href="mailto:privacy@placemakerai.io" className="text-green-600 hover:text-green-700">privacy@placemakerai.io</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">11. Complaints</h2>
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
