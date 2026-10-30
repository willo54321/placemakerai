// Tour stop marker icons, shared by the admin editor (picker + map markers),
// the public embed (stop markers and plan-layer icons) and the tour player
// (stop badges).
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
  entrance: 'M20 7h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6v-2.5h5.5v-13H20zM8 14.7h8.2l-3.1-3.1l1.8-1.8l6.2 6.2l-6.2 6.2l-1.8-1.8l3.1-3.1H8z', // Arrow into a doorway
  power: 'M20.5 4.5L11 17.5h6l-2 10l10-14h-6l1.5-9z', // Lightning bolt
  walk: 'M19.8 4.6a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6ZM16.74 10.45L15.34 17.05A1.7 1.7 0 0 0 18.66 17.75L20.06 11.15A1.7 1.7 0 0 0 16.74 10.45ZM17.49 11.51L19.99 14.71A1.15 1.15 0 0 0 21.81 13.29L19.31 10.09A1.15 1.15 0 0 0 17.49 11.51ZM20.43 15.05L23.13 16.25A1.15 1.15 0 0 0 24.07 14.15L21.37 12.95A1.15 1.15 0 0 0 20.43 15.05ZM17.59 9.99L14.79 12.79A1.15 1.15 0 0 0 16.41 14.41L19.21 11.61A1.15 1.15 0 0 0 17.59 9.99ZM14.54 13.15L13.34 15.95A1.15 1.15 0 0 0 15.46 16.85L16.66 14.05A1.15 1.15 0 0 0 14.54 13.15ZM15.84 18.18L18.54 22.18A1.4 1.4 0 0 0 20.86 20.62L18.16 16.62A1.4 1.4 0 0 0 15.84 18.18ZM18.35 21.77L19.65 26.57A1.4 1.4 0 0 0 22.35 25.83L21.05 21.03A1.4 1.4 0 0 0 18.35 21.77ZM15.7 16.87L13.9 21.27A1.4 1.4 0 0 0 16.5 22.33L18.3 17.93A1.4 1.4 0 0 0 15.7 16.87ZM14.12 20.9L11.12 24.5A1.4 1.4 0 0 0 13.28 26.3L16.28 22.7A1.4 1.4 0 0 0 14.12 20.9Z', // Walker
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
  { id: 'entrance', label: 'Entrance' },
  { id: 'power', label: 'Power' },
  { id: 'walk', label: 'Footpath' },
]

export function isTourStopIcon(id: unknown): id is string {
  return typeof id === 'string' && id in TOUR_STOP_ICON_PATHS
}
