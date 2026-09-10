import { EmbedExperience } from '../EmbedExperience'

// Dedicated tour embed: /embed/{projectId}/tour[?tour={tourId}]
// The tour opens automatically and the feedback chrome stays hidden.
export default function TourEmbedPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tour?: string }
}) {
  return <EmbedExperience projectId={params.id} tourMode initialTourId={searchParams.tour} />
}
