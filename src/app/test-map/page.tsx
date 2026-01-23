// Server component - forces dynamic rendering
export const dynamic = 'force-dynamic'

import EmbedMap from '../embed/[id]/EmbedMap'

export default function TestMapPage() {
  // Use the ACTUAL EmbedMap component that works on /embed/[id]
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test - Using actual EmbedMap component</h1>
      <p className="mb-4">This renders the exact same EmbedMap component that works on /embed/[id]</p>

      <div style={{ width: '100%', height: '500px', border: '2px solid blue' }}>
        <EmbedMap
          center={[51.5074, -0.1278]}
          zoom={12}
          overlays={[]}
          pins={[]}
          pendingPin={null}
          pendingShape={null}
          drawMode={null}
          isAddingPin={false}
          onMapClick={() => {}}
          onShapeComplete={() => {}}
          onVote={async () => {}}
          mapType="roadmap"
          votedPins={new Set()}
        />
      </div>
    </div>
  )
}
