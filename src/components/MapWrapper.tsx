'use client';

import dynamic from 'next/dynamic';
import { forwardRef } from 'react';
import type { InteractiveMapRef } from './InteractiveMap';

// Simple dynamic import with no SSR - matches how EmbedMap works
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DynamicMap = dynamic<any>(
  () => import('./InteractiveMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-gray-500">Loading map...</div>
      </div>
    )
  }
);

// NOTE: This wrapper is superseded — map.tsx imports InteractiveMap via
// next/dynamic directly. It also has the same forwardRef-into-dynamic flaw as
// the old map.tsx: next/dynamic does NOT forward refs in Next 14, so the `ref`
// passed here never reaches InteractiveMap and the imperative API
// (fitToOverlay) is a no-op. For consumers that need the imperative API, pass
// `apiRef` (a normal prop InteractiveMap populates) instead of `ref`. The
// `ref` passthrough is retained only for backward-compat / non-imperative use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const InteractiveMap = forwardRef<InteractiveMapRef, any>((props, ref) => (
  <DynamicMap {...props} ref={ref} />
));

InteractiveMap.displayName = 'InteractiveMapWrapper';

export default InteractiveMap;
export { calculateDrawingMetrics } from '@/lib/map-utils';
export type { MapMarker, MapDrawing, ImageOverlay, GeoLayer, InteractiveMapRef } from './InteractiveMap';
