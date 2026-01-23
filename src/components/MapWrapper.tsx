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

// Simple passthrough - no extra wrappers, observers, or state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const InteractiveMap = forwardRef<InteractiveMapRef, any>((props, ref) => (
  <DynamicMap {...props} ref={ref} />
));

InteractiveMap.displayName = 'InteractiveMapWrapper';

export default InteractiveMap;
export { calculateDrawingMetrics } from '@/lib/map-utils';
export type { MapMarker, MapDrawing, ImageOverlay, GeoLayer, InteractiveMapRef } from './InteractiveMap';
