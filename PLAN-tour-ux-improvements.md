# Tour Editor UX Improvements Plan

## Current Issues
1. **Small map** - The current h-64 (256px) map is too small for precision work
2. **Disconnected workflow** - Click map → fill form → draw highlight → save (steps feel disjointed)
3. **No spotlight effect** - Highlights don't darken the rest of the map
4. **No live preview** - Can't see what the tour will look like during creation
5. **Hard to edit existing stops** - Small modal, no map view

## Proposed Improvements

### 1. Spotlight/Mask Effect for Highlights
When a highlight polygon is drawn or displayed, shade the rest of the map dark to create a "spotlight" effect that draws attention to the highlighted area.

**Implementation:**
- Create a large outer polygon covering the entire visible world
- Add the highlight polygon as a "hole" in the outer polygon
- This creates the inverted mask effect
- Use semi-transparent dark fill (rgba(0,0,0,0.5)) for the masked area

```typescript
// Outer bounds covering the world
const worldBounds = [
  { lat: -85, lng: -180 },
  { lat: -85, lng: 180 },
  { lat: 85, lng: 180 },
  { lat: 85, lng: -180 },
]

// Highlight as a hole (coordinates in reverse order)
const highlightHole = highlightCoords.map(c => ({ lat: c[1], lng: c[0] })).reverse()

// Pass both paths to PolygonF
<PolygonF paths={[worldBounds, highlightHole]} options={{
  fillColor: '#000000',
  fillOpacity: 0.5,
  strokeWeight: 0,
}} />
```

### 2. Improved Step-by-Step Workflow

Replace the current form-based approach with a guided wizard:

**Step 1: Position**
- Large full-width map (h-96 or larger)
- Click to place the stop marker
- Show existing stops as numbered markers
- "Next" button enabled once position is set

**Step 2: Frame the View**
- Adjust zoom level with slider + live preview
- Optional: Adjust center offset
- Map shows exactly what the user will see at this stop

**Step 3: Highlight Area (Optional)**
- Toggle to enable highlight mode
- Draw polygon on map
- Spotlight effect shows immediately
- Clear/redraw options
- Skip if no highlight needed

**Step 4: Content**
- Title, description, image URL
- Preview card shows how it will appear in tour player
- Save button

### 3. Visual Layout Changes

```
┌─────────────────────────────────────────────────────────────┐
│ Tours Tab                                                   │
├─────────────────────────────────────────────────────────────┤
│ [Tour List - Collapsible cards with stops]                  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ + Add Stop                                              │ │
│ │                                                         │ │
│ │  ┌──────────────────────────────────────┐ ┌──────────┐ │ │
│ │  │                                      │ │ Step 1   │ │ │
│ │  │         LARGE MAP AREA               │ │ Position │ │ │
│ │  │         (h-96 / 384px)               │ │          │ │ │
│ │  │                                      │ │ ○ Step 2 │ │ │
│ │  │    [Click to place marker]           │ │ Frame    │ │ │
│ │  │    [Existing stops shown]            │ │          │ │ │
│ │  │                                      │ │ ○ Step 3 │ │ │
│ │  │                                      │ │ Highlight│ │ │
│ │  │                                      │ │          │ │ │
│ │  └──────────────────────────────────────┘ │ ○ Step 4 │ │ │
│ │                                           │ Content  │ │ │
│ │  [Step controls / form below map]         └──────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4. Edit Stop Experience

Instead of a modal, open an inline editor similar to the "Add Stop" flow:
- Map centers on the stop's position
- Shows the stop's highlight (with spotlight effect)
- All fields editable in the same step-by-step interface
- Can redraw highlight

### 5. Implementation Tasks

1. **Add spotlight mask to InteractiveMap** (or create new prop)
   - New `spotlightHighlight` prop that takes a polygon
   - Renders the inverted mask polygon

2. **Create StopEditor component**
   - Manages the step-by-step wizard state
   - Handles position, zoom, highlight, content steps
   - Reusable for both add and edit flows

3. **Update tours.tsx layout**
   - Larger map area
   - Side panel for step indicators
   - Inline editing instead of modals

4. **Update TourMap.tsx for embed**
   - Add highlight support with spotlight effect
   - Pass current stop's highlight to the map

5. **Update TourPlayer to emit highlight**
   - Include highlight data in navigation callback
   - Parent page passes to TourMap

## Files to Modify

1. `src/components/InteractiveMap.tsx` - Add spotlight mask rendering
2. `src/app/projects/[id]/tours.tsx` - Complete UI overhaul
3. `src/app/embed/[id]/tour/TourMap.tsx` - Add highlight/spotlight support
4. `src/app/embed/[id]/TourPlayer.tsx` - Include highlight in navigation
5. `src/app/embed/[id]/tour/page.tsx` - Pass highlight to TourMap

## Estimated Scope
- InteractiveMap spotlight: Small change
- Tours.tsx overhaul: Medium-large change
- Embed tour updates: Small-medium change

## Questions for User
1. Should the wizard be strict (must complete steps in order) or flexible (can jump between steps)?
2. For the edit flow, should we allow repositioning the stop marker, or just editing other properties?
3. Any specific colors/opacity preferences for the spotlight effect?
