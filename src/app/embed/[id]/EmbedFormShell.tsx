import type { CSSProperties, ReactNode } from 'react'
import { prisma } from '@/lib/db'
import { embedTheme } from '@/lib/embed-theme'

// Shared server-side loading + theming for the standalone form embeds
// (/embed/{id}/enquiry, /embed/{id}/subscribe). Styling comes from the
// project's embed settings so the form sits inside the client's own site.

export async function loadEmbedFormProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, embedEnabled: true, embedPrimaryColor: true, embedFontFamily: true },
  })
}

type EmbedFormProject = NonNullable<Awaited<ReturnType<typeof loadEmbedFormProject>>>

export function EmbedFormShell({ project, children }: { project: EmbedFormProject; children: ReactNode }) {
  const theme = embedTheme(project)
  return (
    <>
      <link href={theme.fontUrl} rel="stylesheet" />
      <div
        className="min-h-screen bg-white py-6 px-4"
        style={{ fontFamily: `'${theme.fontFamily}', sans-serif`, '--embed-primary': theme.primaryColor } as CSSProperties}
      >
        {children}
      </div>
    </>
  )
}

export function EmbedFormUnavailable() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <p className="text-slate-600 text-center">This form isn’t available at the moment.</p>
    </div>
  )
}
