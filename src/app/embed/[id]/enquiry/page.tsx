import { EmbedFormShell, EmbedFormUnavailable, loadEmbedFormProject } from '../EmbedFormShell'
import { EnquiryForm } from './EnquiryForm'

// Enquiry form embed: /embed/{projectId}/enquiry
export default async function EnquiryFormPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const project = await loadEmbedFormProject(params.id)
  if (!project || !project.embedEnabled) return <EmbedFormUnavailable />

  return (
    <EmbedFormShell project={project}>
      <EnquiryForm projectId={project.id} projectName={project.name} />
    </EmbedFormShell>
  )
}
