import { EmbedFormShell, EmbedFormUnavailable, loadEmbedFormProject } from '../EmbedFormShell'
import { SubscribeForm } from './SubscribeForm'

// Mailing-list signup embed: /embed/{projectId}/subscribe
export default async function SubscribeFormPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const project = await loadEmbedFormProject(params.id)
  if (!project || !project.embedEnabled) return <EmbedFormUnavailable />

  return (
    <EmbedFormShell project={project}>
      <SubscribeForm projectId={project.id} projectName={project.name} />
    </EmbedFormShell>
  )
}
