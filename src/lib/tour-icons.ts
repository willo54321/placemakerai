// Tour stop marker icons, shared by the admin editor (picker + map markers),
// the public embed (stop markers) and the tour player (stop badges).
// Paths are authored in the marker-pin coordinate space: glyphs centred on
// (18, 16). Render standalone with viewBox="6 4 24 24".

export const TOUR_STOP_ICON_PATHS: Record<string, string> = {
  nature: 'M18 6c-2 0-3.5 1.5-3.5 3.5c0 1.2.6 2.3 1.5 3v.5h4v-.5c.9-.7 1.5-1.8 1.5-3C21.5 7.5 20 6 18 6zm-2 10v4h4v-4h2v6h-8v-6h2z', // Tree
  access: 'M18 8a2 2 0 1 0 0-4a2 2 0 0 0 0 4zm2 3h-4a1 1 0 0 0-1 1v4h2v8h2v-8h2v-4a1 1 0 0 0-1-1z', // Person
  parking: 'M12 6h5a4 4 0 0 1 0 8h-3v6h-2V6zm2 6h3a2 2 0 1 0 0-4h-3v4z', // P
  info: 'M18 6a2 2 0 1 0 0 4a2 2 0 0 0 0-4zm-1 6h2v10h-2V12z', // i
  home: 'M18 6l-8 6v12h5v-6h6v6h5V12l-8-6z', // House
  food: 'M11 6v8h2v10h2V14h2V6h-2v6h-2V6h-2zm10 0v18h2V6h-2z', // Fork & knife
  play: 'M10 6v18l14-9L10 6z', // Play triangle
  water: 'M18 6c-4 4-6 7-6 10a6 6 0 1 0 12 0c0-3-2-6-6-10z', // Water drop
  start: 'M18 6l2 4l4.5.7l-3.3 3.2l.8 4.5L18 16l-4 2.4l.8-4.5l-3.3-3.2L16 10l2-4z', // Star
  view: 'M18 8c-5 0-9 4-9 8s4 8 9 8s9-4 9-8s-4-8-9-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6s6 2.7 6 6s-2.7 6-6 6zm0-10a4 4 0 1 0 0 8a4 4 0 0 0 0-8z', // Eye
}

// Picker entries. 'number' is the default: the stop shows its sequence number.
export const TOUR_STOP_ICONS: { id: string; label: string }[] = [
  { id: 'number', label: 'Number' },
  { id: 'nature', label: 'Nature' },
  { id: 'access', label: 'Access' },
  { id: 'parking', label: 'Parking' },
  { id: 'info', label: 'Info' },
  { id: 'home', label: 'Building' },
  { id: 'food', label: 'Food' },
  { id: 'play', label: 'Recreation' },
  { id: 'water', label: 'Water' },
  { id: 'start', label: 'Start' },
  { id: 'view', label: 'Viewpoint' },
]

export function isTourStopIcon(id: unknown): id is string {
  return typeof id === 'string' && id in TOUR_STOP_ICON_PATHS
}
