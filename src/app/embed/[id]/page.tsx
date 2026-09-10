import { EmbedExperience } from './EmbedExperience'

export default function EmbedPage({ params }: { params: { id: string } }) {
  return <EmbedExperience projectId={params.id} />
}
