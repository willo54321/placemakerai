import { EmbedExperience } from './EmbedExperience'

export default async function EmbedPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <EmbedExperience projectId={params.id} />
}
