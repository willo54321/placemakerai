import { EmbedExperience } from '../EmbedExperience'

// Construction-issue reporter embed: /embed/{projectId}/issues
// Same map shell as the feedback embed, with issue categories, required
// contact details, photo evidence and resolved-report display.
export default async function IssuesEmbedPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <EmbedExperience projectId={params.id} issuesMode />
}
