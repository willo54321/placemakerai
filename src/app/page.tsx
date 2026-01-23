import { redirect } from 'next/navigation'

export default function Home() {
  // Middleware handles the redirect based on auth status
  // This is a fallback in case middleware doesn't catch it
  redirect('/projects')
}
