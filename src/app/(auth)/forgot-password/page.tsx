import Link from 'next/link'
import { MapPin, Mail } from 'lucide-react'

// Email delivery isn't configured yet, so password resets are handled
// manually by the administrator. When Resend is set up, restore the
// self-service form (see git history) and the /api/auth/forgot-password flow.
export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Placemaker.ai</h1>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Forgot your password?</h2>
          <p className="text-slate-600 mb-6">
            No problem — email us and we&apos;ll reset it for you, usually within a few hours.
          </p>

          <a
            href="mailto:william.neale@secnewgate.co.uk?subject=Placemaker.ai%20password%20reset"
            className="inline-flex items-center justify-center gap-2 w-full bg-brand-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-brand-700 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            <Mail className="w-5 h-5" />
            william.neale@secnewgate.co.uk
          </a>

          <p className="text-sm text-slate-500 mt-4">
            Include the email address you sign in with.
          </p>

          <p className="text-center text-sm text-slate-500 mt-6">
            Remembered it?{' '}
            <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
