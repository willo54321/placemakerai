import { Mail } from 'lucide-react'

export default function VerifyPage() {
  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Check your email</h1>
        <p className="text-slate-600 mb-6">
          We sent you a sign-in link. Click the link in your email to continue.
        </p>
        <p className="text-sm text-slate-500">
          The link will expire in 24 hours. If you don&apos;t see the email, check your spam folder.
        </p>
      </div>
    </div>
  )
}
