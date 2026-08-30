import InteractiveDots from '@/components/testpage/InteractiveDots'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Same interactive dot background as the marketing hero */}
      <InteractiveDots background="#F7F6F4" />
      <div className="relative z-10 w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}
