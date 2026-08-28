import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import CookieConsent from '@/components/CookieConsent'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Placemaker.ai',
  description: 'Interactive maps, feedback forms, and AI-powered analysis for public consultation on planning projects',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={dmSans.className}>
        <Providers>{children}</Providers>
        <CookieConsent />
      </body>
    </html>
  )
}
