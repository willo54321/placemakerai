import { EmbedExperience } from '../EmbedExperience'

// Dedicated tour embed: /embed/{projectId}/tour[?tour={tourId}]
// The tour opens automatically and the feedback chrome stays hidden.
export default async function TourEmbedPage(
  props: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ tour?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return <EmbedExperience projectId={params.id} tourMode initialTourId={searchParams.tour} />
}
